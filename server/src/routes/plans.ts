import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { canonicalToClientExercise, normalizeProfile } from '../exercise-library/compatibility';
import { ExerciseLibraryService, PublishedLibraryUnavailableError } from '../exercise-library/service';
import { generateSelection, selectQualifiedExercise, SelectedExercise } from '../exercise-library/eligibility';
import { CanonicalExercise, NormalizedProfile, RequestSelection, WorkoutDaySnapshot } from '../exercise-library/types';

const router = Router();
router.use(authMiddleware);
const libraryService = new ExerciseLibraryService();
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function applyDifficultyLevel(sets: number, reps: number, level: number): { sets: number; reps: number } {
  if (level === 1) return { sets: Math.max(sets - 1, 1), reps: Math.max(Math.round(reps * 0.8), 6) };
  if (level === 3) return { sets: sets + 1, reps: Math.round(reps * 1.25) };
  return { sets, reps };
}
function getDifficultyLevel(userId: number | undefined): number {
  if (!userId) return 2;
  const recent = db.prepare('SELECT feedback FROM training_records WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 4').all(userId) as { feedback: string }[];
  if (!recent.length) return 2;
  if (recent.some(row => row.feedback === 'too_hard')) return 1;
  if (recent.filter(row => row.feedback === 'too_easy').length >= 2) return 3;
  return 2;
}
function generateSchedule(days: number): ('strength' | 'rest')[] {
  const schedule: ('strength' | 'rest')[] = Array(7).fill('rest');
  if (days >= 4) [1, 3, 5, 6].forEach(index => { schedule[index] = 'strength'; });
  else if (days === 3) [1, 3, 5].forEach(index => { schedule[index] = 'strength'; });
  else if (days === 2) [2, 5].forEach(index => { schedule[index] = 'strength'; });
  else [1, 4].forEach(index => { schedule[index] = 'strength'; });
  return schedule;
}
function readProfile(row: Record<string, unknown>): ReturnType<typeof normalizeProfile> {
  return normalizeProfile({
    experience: row.experience,
    injuries: row.injuries,
    equipment: row.equipment,
    selected_projects: row.selected_projects,
  });
}
function chooseCategory(projectId: NormalizedProfile['selected_projects'][number], category: CanonicalExercise['category'], profile: NormalizedProfile, library: ReturnType<ExerciseLibraryService['load']>): SelectedExercise | null {
  const candidates = library.exercises.filter(exercise => exercise.target_projects.includes(projectId) && exercise.category === category);
  for (const candidate of candidates) {
    const selected = selectQualifiedExercise(candidate, projectId, profile, library);
    if (selected) return selected;
  }
  return null;
}
function buildDays(startOfWeek: Date, profile: NormalizedProfile, library: ReturnType<ExerciseLibraryService['load']>, selection: RequestSelection, userId: number | undefined): WorkoutDaySnapshot[] {
  const schedule = generateSchedule(Math.min(profile.max_days_per_week || 3, 4));
  // Generation has already preflighted every requested project. Keep schedule
  // assembly side-effect free and never re-run request selection here.
  if (selection.unavailable) return [];
  if (profile.selected_projects.some(projectId => !chooseCategory(projectId, 'strength', profile, library))) return [];
  const difficultyLevel = getDifficultyLevel(userId);
  return schedule.map((type, index) => {
    const date = new Date(startOfWeek); date.setDate(startOfWeek.getDate() + index);
    if (type === 'rest') return { day: DAY_NAMES[date.getDay()], dayIndex: index, type: 'rest', exercises: [], warmup: [], cooldown: [] };
    const exercises: WorkoutDaySnapshot['exercises'] = [];
    const warmup: WorkoutDaySnapshot['warmup'] = [];
    const cooldown: WorkoutDaySnapshot['cooldown'] = [];
    for (const projectId of profile.selected_projects) {
      const strength = chooseCategory(projectId, 'strength', profile, library);
      if (strength) {
        const prescription = applyDifficultyLevel(2, 12, difficultyLevel);
        const snapshot = canonicalToClientExercise(strength.exercise, library.library_version, prescription);
        exercises.push({ exerciseId: snapshot.id, exercise: snapshot, sets: prescription.sets, reps: prescription.reps, restBetweenSet: snapshot.rest_between_set, completed: false });
      }
      const warmupSelection = chooseCategory(projectId, 'warmup', profile, library);
      if (warmupSelection) warmup.push(canonicalToClientExercise(warmupSelection.exercise, library.library_version, { sets: 1, reps: 10 }));
      const cooldownSelection = chooseCategory(projectId, 'stretch', profile, library);
      if (cooldownSelection) cooldown.push(canonicalToClientExercise(cooldownSelection.exercise, library.library_version, { sets: 1, reps: 10 }));
    }
    return { day: DAY_NAMES[date.getDay()], dayIndex: index, type: 'strength', exercises, warmup, cooldown };
  });
}
function getStartOfWeek(date = new Date()): Date {
  const start = new Date(date); start.setHours(0, 0, 0, 0); start.setDate(date.getDate() - date.getDay() + 1); return start;
}
function loadNormalized(userId: number | undefined): { profile: NormalizedProfile; library: ReturnType<ExerciseLibraryService['load']> } | { response: PlanGenerationResponse } | { serviceError: PublishedLibraryUnavailableError } | { missingProfile: true } {
  const profileRow = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!profileRow) return { missingProfile: true };

  // Normalize the persisted profile exactly once at the compatibility boundary.
  const normalized = readProfile(profileRow);
  if (normalized.unavailable || !normalized.profile) {
    return {
      response: normalized.unavailable || {
        outcome: 'temporarily_unavailable',
        display_message: '暂不可生成',
        requested_project_ids: [],
        failed_eligibility_categories_by_project: {},
        unknown_input_values: [],
        experience: null,
      },
    };
  }

  try {
    return {
      profile: {
        ...normalized.profile,
        max_days_per_week: Number(profileRow.max_days_per_week) || 3,
        session_max_min: Number(profileRow.session_max_min) || 30,
      },
      library: libraryService.load(),
    };
  } catch (error) {
    if (error instanceof PublishedLibraryUnavailableError) return { serviceError: error };
    throw error;
  }
}

router.post('/generate', (req: AuthRequest, res: Response) => {
  const loaded = loadNormalized(req.userId);
  if ('response' in loaded) return res.json(loaded.response);
  if ('missingProfile' in loaded) return res.status(400).json({ error: '请先完善个人信息' });
  if ('serviceError' in loaded) return res.status(503).json({ error: '动作库暂不可用', code: loaded.serviceError.code });
  const selection = generateSelection(loaded.profile.selected_projects, loaded.profile, loaded.library);
  if (selection.unavailable) return res.json(selection.unavailable);
  const startOfWeek = getStartOfWeek();
  const days = buildDays(startOfWeek, loaded.profile, loaded.library, selection, req.userId);
  if (!days.length) return res.json({ outcome: 'temporarily_unavailable', display_message: '暂不可生成', requested_project_ids: loaded.profile.selected_projects, failed_eligibility_categories_by_project: {}, unknown_input_values: [], experience: loaded.profile.experience });
  const startDate = startOfWeek.toISOString().split('T')[0];
  const weekNumber = Number(req.body.weekNumber) || 1;
  const existing = db.prepare('SELECT id FROM weekly_plans WHERE user_id = ? AND start_date = ?').get(req.userId, startDate) as { id: number } | undefined;
  let planId: number;
  if (existing) { db.prepare('UPDATE weekly_plans SET days = ?, week_number = ? WHERE id = ?').run(JSON.stringify(days), weekNumber, existing.id); planId = existing.id; }
  else { const result = db.prepare('INSERT INTO weekly_plans (user_id, week_number, start_date, days) VALUES (?, ?, ?, ?)').run(req.userId, weekNumber, startDate, JSON.stringify(days)); planId = Number(result.lastInsertRowid); }
  return res.json({ outcome: 'generated', id: planId, weekNumber, startDate, libraryVersion: loaded.library.library_version, days });
});

router.get('/current', (req: AuthRequest, res: Response) => {
  const startDate = getStartOfWeek().toISOString().split('T')[0];
  const plan = db.prepare('SELECT * FROM weekly_plans WHERE user_id = ? AND start_date = ? ORDER BY id DESC LIMIT 1').get(req.userId, startDate) as Record<string, unknown> | undefined;
  if (!plan) return res.json(null);
  try { return res.json({ id: plan.id, weekNumber: plan.week_number, startDate: plan.start_date, days: JSON.parse(String(plan.days)) }); }
  catch { return res.status(500).json({ error: '计划快照无效', code: 'plan_snapshot_invalid' }); }
});

router.get('/month/:year/:month', (req: AuthRequest, res: Response) => {
  const year = Number(req.params.year); const month = Number(req.params.month);
  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]; const end = new Date(year, month, 0).toISOString().split('T')[0];
  const plans = db.prepare('SELECT * FROM weekly_plans WHERE user_id = ? AND start_date >= ? AND start_date <= ? ORDER BY start_date').all(req.userId, start, end) as Record<string, unknown>[];
  try { return res.json(plans.map(plan => ({ id: plan.id, weekNumber: plan.week_number, startDate: plan.start_date, days: JSON.parse(String(plan.days)) }))); }
  catch { return res.status(500).json({ error: '计划快照无效', code: 'plan_snapshot_invalid' }); }
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const plan = db.prepare('SELECT * FROM weekly_plans WHERE user_id = ? AND id = ?').get(req.userId, Number(req.params.id)) as Record<string, unknown> | undefined;
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  try { return res.json({ id: plan.id, weekNumber: plan.week_number, startDate: plan.start_date, days: JSON.parse(String(plan.days)) }); }
  catch { return res.status(500).json({ error: '计划快照无效', code: 'plan_snapshot_invalid' }); }
});

router.post('/month/:year/:month/generate', (req: AuthRequest, res: Response) => {
  const loaded = loadNormalized(req.userId);
  if ('response' in loaded) return res.json(loaded.response);
  if ('missingProfile' in loaded) return res.status(400).json({ error: '请先完善个人信息' });
  if ('serviceError' in loaded) return res.status(503).json({ error: '动作库暂不可用', code: loaded.serviceError.code });
  const selection = generateSelection(loaded.profile.selected_projects, loaded.profile, loaded.library);
  if (selection.unavailable) return res.json(selection.unavailable);
  const year = Number(req.params.year); const month = Number(req.params.month);
  const startOfMonth = new Date(year, month - 1, 1); const endOfMonth = new Date(year, month, 0);
  const firstMonday = getStartOfWeek(startOfMonth);
  const pending: Array<{ startDate: string; days: WorkoutDaySnapshot[] }> = [];
  for (let monday = new Date(firstMonday); monday <= endOfMonth; monday.setDate(monday.getDate() + 7)) {
    const days = buildDays(new Date(monday), loaded.profile, loaded.library, selection, req.userId);
    if (!days.length) return res.json({ outcome: 'temporarily_unavailable', display_message: '暂不可生成', requested_project_ids: loaded.profile.selected_projects, failed_eligibility_categories_by_project: {}, unknown_input_values: [], experience: loaded.profile.experience });
    pending.push({ startDate: new Date(monday).toISOString().split('T')[0], days });
  }
  const generatedPlans: Array<{ id: number; startDate: string; days: WorkoutDaySnapshot[] }> = [];
  const transaction = db.transaction(() => {
    for (const item of pending) {
      const existing = db.prepare('SELECT id FROM weekly_plans WHERE user_id = ? AND start_date = ?').get(req.userId, item.startDate) as { id: number } | undefined;
      if (existing) continue;
      const result = db.prepare('INSERT INTO weekly_plans (user_id, week_number, start_date, days) VALUES (?, ?, ?, ?)').run(req.userId, 1, item.startDate, JSON.stringify(item.days));
      generatedPlans.push({ id: Number(result.lastInsertRowid), startDate: item.startDate, days: item.days });
    }
  });
  transaction();
  return res.json({ outcome: 'generated', generated: generatedPlans.length, plans: generatedPlans, libraryVersion: loaded.library.library_version });
});

export default router;
