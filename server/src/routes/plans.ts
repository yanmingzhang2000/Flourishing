import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authMiddleware);

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function loadExercises() {
  const p = path.join(__dirname, '../../../src/data/exercises.json');
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, any>;
}

function generateSchedule(days: number): ('strength' | 'rest')[] {
  const s: ('strength' | 'rest')[] = Array(7).fill('rest');
  if (days >= 4) { s[1] = 'strength'; s[3] = 'strength'; s[5] = 'strength'; s[6] = 'strength'; }
  else if (days === 3) { s[1] = 'strength'; s[3] = 'strength'; s[5] = 'strength'; }
  else if (days === 2) { s[2] = 'strength'; s[5] = 'strength'; }
  else { s[1] = 'strength'; s[4] = 'strength'; }
  return s;
}

// 生成当周计划
router.post('/generate', (req: AuthRequest, res: Response) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as any;
  if (!profile) return res.status(400).json({ error: '请先完善个人信息' });

  const selectedProjects: string[] = JSON.parse(profile.selected_projects || '["tricep_tone"]');
  const allExercises = loadExercises();
  const projectId = selectedProjects[0] || 'tricep_tone';
  const projectExercises = allExercises[projectId];

  if (!projectExercises) return res.status(400).json({ error: '项目动作库不存在' });

  const injuries: string[] = JSON.parse(profile.injuries || '[]');
  const trainingDays = Math.min(profile.max_days_per_week || 3, 4);
  const schedule = generateSchedule(trainingDays);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const days = schedule.map((type, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayLabel = DAY_NAMES[date.getDay()];

    if (type === 'rest') {
      return { day: dayLabel, dayIndex: i, type: 'rest', exercises: [], warmup: [], cooldown: [] };
    }

    const filtered = projectExercises.exercises.filter((ex: any) =>
      !injuries.some((inj: string) => ex.warning?.toLowerCase().includes(inj.toLowerCase()))
    ).slice(0, 5);

    return {
      day: dayLabel,
      dayIndex: i,
      type: 'strength',
      exercises: filtered.map((ex: any) => ({
        exerciseId: ex.id,
        exercise: ex,
        sets: ex.sets,
        reps: ex.reps,
        restBetweenSet: ex.rest_between_set,
        completed: false,
      })),
      warmup: projectExercises.warmup.slice(0, 2),
      cooldown: projectExercises.cooldown.slice(0, 2),
    };
  });

  // 查找当前周计划
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

// 获取当前周计划
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
    days: JSON.parse(plan.days)
  });
});

// 获取指定月份的所有周计划
router.get('/month/:year/:month', (req: AuthRequest, res: Response) => {
  const year = req.params.year as string;
  const month = req.params.month as string;
  const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endOfMonth = new Date(parseInt(year), parseInt(month), 0);

  const plans = db.prepare(
    'SELECT * FROM weekly_plans WHERE user_id = ? AND start_date >= ? AND start_date <= ? ORDER BY start_date'
  ).all(
    req.userId,
    startOfMonth.toISOString().split('T')[0],
    endOfMonth.toISOString().split('T')[0]
  ) as any[];

  return res.json(plans.map(p => ({
    id: p.id,
    weekNumber: p.week_number,
    startDate: p.start_date,
    days: JSON.parse(p.days)
  })));
});

// 批量生成指定月份的所有周计划
router.post('/month/:year/:month/generate', (req: AuthRequest, res: Response) => {
  const year = req.params.year as string;
  const month = req.params.month as string;
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId) as any;
  if (!profile) return res.status(400).json({ error: '请先完善个人信息' });

  const selectedProjects: string[] = JSON.parse(profile.selected_projects || '["tricep_tone"]');
  const allExercises = loadExercises();
  const projectId = selectedProjects[0] || 'tricep_tone';
  const projectExercises = allExercises[projectId];

  if (!projectExercises) return res.status(400).json({ error: '项目动作库不存在' });

  const injuries: string[] = JSON.parse(profile.injuries || '[]');
  const trainingDays = Math.min(profile.max_days_per_week || 3, 4);
  const schedule = generateSchedule(trainingDays);

  const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
  const endOfMonth = new Date(parseInt(year), parseInt(month), 0);

  // 找到月初所在周的周一
  const firstMonday = new Date(startOfMonth);
  firstMonday.setDate(startOfMonth.getDate() - startOfMonth.getDay() + 1);

  const generatedPlans: any[] = [];
  let currentMonday = new Date(firstMonday);

  // 生成该月所有周的计划（包括跨月的周）
  while (currentMonday <= endOfMonth) {
    const startDate = currentMonday.toISOString().split('T')[0];

    // 检查是否已存在
    const existing = db.prepare(
      'SELECT id FROM weekly_plans WHERE user_id = ? AND start_date = ?'
    ).get(req.userId, startDate) as any;

    if (!existing) {
      const days = schedule.map((type, i) => {
        const date = new Date(currentMonday);
        date.setDate(currentMonday.getDate() + i);
        const dayLabel = DAY_NAMES[date.getDay()];

        if (type === 'rest') {
          return { day: dayLabel, dayIndex: i, type: 'rest', exercises: [], warmup: [], cooldown: [] };
        }

        const filtered = projectExercises.exercises.filter((ex: any) =>
          !injuries.some((inj: string) => ex.warning?.toLowerCase().includes(inj.toLowerCase()))
        ).slice(0, 5);

        return {
          day: dayLabel,
          dayIndex: i,
          type: 'strength',
          exercises: filtered.map((ex: any) => ({
            exerciseId: ex.id,
            exercise: ex,
            sets: ex.sets,
            reps: ex.reps,
            restBetweenSet: ex.rest_between_set,
            completed: false,
          })),
          warmup: projectExercises.warmup.slice(0, 2),
          cooldown: projectExercises.cooldown.slice(0, 2),
        };
      });

      const result = db.prepare(
        'INSERT INTO weekly_plans (user_id, week_number, start_date, days) VALUES (?, ?, ?, ?)'
      ).run(req.userId, 1, startDate, JSON.stringify(days));

      generatedPlans.push({
        id: result.lastInsertRowid,
        startDate,
        days
      });
    }

    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return res.json({ generated: generatedPlans.length, plans: generatedPlans });
});

export default router;
