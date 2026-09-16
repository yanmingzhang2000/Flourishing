import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authMiddleware);

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 伤病 tag → warning 关键字映射（前端存英文 tag，warning 是中文）
const INJURY_KEYWORDS: Record<string, string[]> = {
  shoulder: ['肩'],
  elbow:    ['肘'],
  wrist:    ['腕', '手腕'],
  knee:     ['膝', '膝盖'],
  back:     ['腰', '背'],
};

function exerciseMatchesInjury(warning: string, injuries: string[]): boolean {
  return injuries.some(inj => {
    const keywords = INJURY_KEYWORDS[inj] || [inj];
    return keywords.some(kw => warning.includes(kw));
  });
}

// difficulty level: 1=降级 2=保持 3=升级
function applyDifficultyLevel(sets: number, reps: number, level: number): { sets: number; reps: number } {
  if (level === 1) return { sets: Math.max(sets - 1, 1), reps: Math.max(Math.round(reps * 0.8), 6) };
  if (level === 3) return { sets: sets + 1, reps: Math.round(reps * 1.25) };
  return { sets, reps };
}

// 根据最近反馈决定难度等级
function getDifficultyLevel(userId: number | undefined): number {
  if (!userId) return 2;
  const recent = db.prepare(
    `SELECT feedback FROM training_records WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 4`
  ).all(userId) as { feedback: string }[];
  if (recent.length === 0) return 2;
  const tooEasy = recent.filter(r => r.feedback === 'too_easy').length;
  const tooHard = recent.filter(r => r.feedback === 'too_hard').length;
  if (tooHard >= 1) return 1;
  if (tooEasy >= 2) return 3;
  return 2;
}

function loadExercises() {
  const p = path.join(__dirname, '../../../src/data/exercises.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, any>;
}

/**
 * 生成 7 天的排期数组（index 0=周日 … 6=周六）
 * - 优先使用用户自定义的 trainingDays（如 [1,3,5]）
 * - 否则按 count 自动排期
 */
function generateSchedule(trainingDays: number[] | null, count: number): ('strength' | 'rest')[] {
  const s: ('strength' | 'rest')[] = Array(7).fill('rest');
  if (trainingDays && trainingDays.length > 0) {
    trainingDays.forEach(d => { if (d >= 0 && d <= 6) s[d] = 'strength'; });
  } else {
    const days = Math.min(count || 3, 4);
    if (days >= 4) { s[1] = 'strength'; s[3] = 'strength'; s[5] = 'strength'; s[6] = 'strength'; }
    else if (days === 3) { s[1] = 'strength'; s[3] = 'strength'; s[5] = 'strength'; }
    else if (days === 2) { s[2] = 'strength'; s[5] = 'strength'; }
    else { s[1] = 'strength'; s[4] = 'strength'; }
  }
  return s;
}

/**
 * 将 selectedProjects 轮换分配到当周的各训练日。
 * weekOffset = 基于周一日期计算的周序号 mod 项目数，保证每周顺移一位。
 */
function buildWeekDays(
  schedule: ('strength' | 'rest')[],
  startOfWeek: Date,
  selectedProjects: string[],
  allExercises: Record<string, any>,
  injuries: string[],
  diffLevel: number,
): any[] {
  // 本周是第几个自然周（从 epoch 算），用于项目轮换偏移
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const weekIndex = Math.floor(startOfWeek.getTime() / WEEK_MS);
  const projectCount = selectedProjects.length || 1;

  // 收集训练日的 slot 序号（第 0、1、2… 个训练日）
  let slotCounter = 0;

  return schedule.map((type, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayLabel = DAY_NAMES[date.getDay()];

    if (type === 'rest') {
      return { day: dayLabel, dayIndex: i, type: 'rest', projectId: null, exercises: [], warmup: [], cooldown: [] };
    }

    // 本训练日对应的项目：(slotIndex + weekOffset) % projectCount
    const projectId = selectedProjects[(slotCounter + weekIndex) % projectCount];
    slotCounter++;

    const projectExercises = allExercises[projectId];
    if (!projectExercises) {
      return { day: dayLabel, dayIndex: i, type: 'strength', projectId, exercises: [], warmup: [], cooldown: [] };
    }

    const filtered = projectExercises.exercises.filter((ex: any) =>
      !exerciseMatchesInjury(ex.warning || '', injuries)
    ).slice(0, 5);

    return {
      day: dayLabel,
      dayIndex: i,
      type: 'strength',
      projectId,
      exercises: filtered.map((ex: any) => {
        const { sets, reps } = applyDifficultyLevel(ex.sets, ex.reps, diffLevel);
        return {
          exerciseId: ex.id,
          exercise: ex,
          sets,
          reps,
          restBetweenSet: ex.rest_between_set,
          completed: false,
        };
      }),
      warmup: projectExercises.warmup.slice(0, 2),
      cooldown: projectExercises.cooldown.slice(0, 2),
    };
  });
}

// ── 生成当周计划 ───────────────────────────────────────────────────────────────
router.post('/generate', (req: AuthRequest, res: Response) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as any;
  if (!profile) return res.status(400).json({ error: '请先完善个人信息' });

  const selectedProjects: string[] = JSON.parse(profile.selected_projects || '["tricep_tone"]');
  const allExercises = loadExercises();
  const injuries: string[] = JSON.parse(profile.injuries || '[]');
  const trainingDays: number[] | null = profile.training_days ? JSON.parse(profile.training_days) : null;
  const schedule = generateSchedule(trainingDays, profile.max_days_per_week || 3);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  const diffLevel = getDifficultyLevel(req.userId);
  const days = buildWeekDays(schedule, startOfWeek, selectedProjects, allExercises, injuries, diffLevel);

  const weekNumber = req.body.weekNumber || 1;
  const startDate = startOfWeek.toISOString().split('T')[0];

  const existing = db.prepare(
    'SELECT id FROM weekly_plans WHERE user_id = ? AND start_date = ?'
  ).get(req.userId, startDate) as any;

  let planId: number;
  if (existing) {
    db.prepare('UPDATE weekly_plans SET days = ? WHERE id = ?').run(JSON.stringify(days), existing.id);
    planId = existing.id;
  } else {
    const result = db.prepare(
      'INSERT INTO weekly_plans (user_id, week_number, start_date, days) VALUES (?, ?, ?, ?)'
    ).run(req.userId, weekNumber, startDate, JSON.stringify(days));
    planId = result.lastInsertRowid as number;
  }

  return res.json({ id: planId, weekNumber, startDate, days });
});

// ── 获取当前周计划 ─────────────────────────────────────────────────────────────
router.get('/current', (req: AuthRequest, res: Response) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);
  const startDate = startOfWeek.toISOString().split('T')[0];

  const plan = db.prepare(
    'SELECT * FROM weekly_plans WHERE user_id = ? AND start_date = ? ORDER BY id DESC LIMIT 1'
  ).get(req.userId, startDate) as any;

  if (!plan) return res.json(null);

  return res.json({
    id: plan.id,
    weekNumber: plan.week_number,
    startDate: plan.start_date,
    days: JSON.parse(plan.days),
  });
});

// ── 获取指定月份的所有周计划 ───────────────────────────────────────────────────
router.get('/month/:year/:month', (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.year as string);
  const month = parseInt(req.params.month as string);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  const plans = db.prepare(
    'SELECT * FROM weekly_plans WHERE user_id = ? AND start_date >= ? AND start_date <= ? ORDER BY start_date'
  ).all(
    req.userId,
    startOfMonth.toISOString().split('T')[0],
    endOfMonth.toISOString().split('T')[0],
  ) as any[];

  return res.json(plans.map(p => ({
    id: p.id,
    weekNumber: p.week_number,
    startDate: p.start_date,
    days: JSON.parse(p.days),
  })));
});

// ── 批量生成指定月份的所有周计划 ──────────────────────────────────────────────
router.post('/month/:year/:month/generate', (req: AuthRequest, res: Response) => {
  const year = parseInt(req.params.year as string);
  const month = parseInt(req.params.month as string);
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as any;
  if (!profile) return res.status(400).json({ error: '请先完善个人信息' });

  const selectedProjects: string[] = JSON.parse(profile.selected_projects || '["tricep_tone"]');
  const allExercises = loadExercises();
  const injuries: string[] = JSON.parse(profile.injuries || '[]');
  const trainingDays: number[] | null = profile.training_days ? JSON.parse(profile.training_days) : null;
  const schedule = generateSchedule(trainingDays, profile.max_days_per_week || 3);
  const diffLevel = getDifficultyLevel(req.userId);

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  // 找到月初所在周的周一
  const firstMonday = new Date(startOfMonth);
  firstMonday.setDate(startOfMonth.getDate() - startOfMonth.getDay() + 1);
  firstMonday.setHours(0, 0, 0, 0);

  const generatedPlans: any[] = [];
  let currentMonday = new Date(firstMonday);

  while (currentMonday <= endOfMonth) {
    const startDate = currentMonday.toISOString().split('T')[0];

    const existing = db.prepare(
      'SELECT id FROM weekly_plans WHERE user_id = ? AND start_date = ?'
    ).get(req.userId, startDate) as any;

    if (!existing) {
      const days = buildWeekDays(schedule, new Date(currentMonday), selectedProjects, allExercises, injuries, diffLevel);

      const result = db.prepare(
        'INSERT INTO weekly_plans (user_id, week_number, start_date, days) VALUES (?, ?, ?, ?)'
      ).run(req.userId, 1, startDate, JSON.stringify(days));

      generatedPlans.push({ id: result.lastInsertRowid, startDate, days });
    }

    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return res.json({ generated: generatedPlans.length, plans: generatedPlans });
});

export default router;
