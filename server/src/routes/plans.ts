import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { normalizeProfile } from '../exercise-library/compatibility';
import { ExerciseLibraryService, PublishedLibraryUnavailableError } from '../exercise-library/service';
import { generateSelection } from '../exercise-library/eligibility';
import { NormalizedProfile, RequestSelection, WorkoutDaySnapshot } from '../exercise-library/types';
import { buildWeekSchedule, DAY_NAMES_ISO, WeekDayIndex } from '../plan-engine/schedule';
import { assembleTrainingDay } from '../plan-engine/composition';

const router = Router();
router.use(authMiddleware);
const libraryService = new ExerciseLibraryService();

// ---------------------------------------------------------------------------
// Difficulty level derived from recent feedback records
// ---------------------------------------------------------------------------
function getDifficultyLevel(userId: number | undefined): 1 | 2 | 3 {
  if (!userId) return 2;
  const recent = db.prepare(
    'SELECT feedback FROM training_records WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 4',
  ).all(userId) as { feedback: string }[];
  if (!recent.length) return 2;
  if (recent.some(row => row.feedback === 'too_hard')) return 1;
  if (recent.filter(row => row.feedback === 'too_easy').length >= 2) return 3;
  return 2;
}

// ---------------------------------------------------------------------------
// Profile loading helpers
// ---------------------------------------------------------------------------
function readProfile(row: Record<string, unknown>): ReturnType<typeof normalizeProfile> {
  return normalizeProfile({
    experience: row.experience,
    injuries: row.injuries,
    equipment: row.equipment,
    selected_projects: row.selected_projects,
  });
}

/**
 * Parse user-stored training days. The DB column stores either a JSON array of
 * 0-based ISO-week indices (0=Mon…6=Sun) or null/undefined (fall back to
 * max_days_per_week count).
 */
function parseTrainingDays(raw: unknown): WeekDayIndex[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (
      Array.isArray(parsed) &&
      parsed.every(v => Number.isInteger(v) && v >= 0 && v <= 6)
    ) {
      return parsed as WeekDayIndex[];
    }
  } catch {
    // ignore – fall back to count-based schedule
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Core plan builder – replaces the old generateSchedule + buildDays pair
// ---------------------------------------------------------------------------
function buildDays(
  startOfWeek: Date,
  profile: NormalizedProfile,
  library: ReturnType<ExerciseLibraryService['load']>,
  selection: RequestSelection,
  userId: number | undefined,
  requestedDays?: WeekDayIndex[],
): WorkoutDaySnapshot[] {
  // Generation has already preflighted every requested project. A partial
  // selection must never be written to the database.
  if (selection.unavailable) return [];

  const difficultyLevel = getDifficultyLevel(userId);

  // Build the 7-slot schedule using the new rule engine.
  const schedule = buildWeekSchedule({
    projects: profile.selected_projects,
    requestedDays,
    maxDaysPerWeek: profile.max_days_per_week || 3,
  });

  return schedule.map(slot => {
    // ISO day name: slot.dayIndex 0=Mon…6=Sun
    const dayName = DAY_NAMES_ISO[slot.dayIndex];

    if (slot.type !== 'strength') {
      return {
        day: dayName,
        dayIndex: slot.dayIndex,
        type: slot.type === 'active_recovery' ? ('rest' as const) : ('rest' as const),
        exercises: [],
        warmup: [],
        cooldown: [],
      };
    }

    // Assemble this day's exercises using the composition engine.
    const assembled = assembleTrainingDay(
      slot.projects,
      profile,
      library,
      difficultyLevel,
    );

    // If the composition layer couldn't find any exercises, treat as rest
    // rather than emitting an empty strength day.
    if (assembled.exercises.length === 0) {
      return { day: dayName, dayIndex: slot.dayIndex, type: 'rest' as const, exercises: [], warmup: [], cooldown: [] };
    }

    return {
      day: dayName,
      dayIndex: slot.dayIndex,
      type: 'strength' as const,
      exercises: assembled.exercises,
      warmup: assembled.warmup,
      cooldown: assembled.cooldown,
    };
  });
}
// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function getStartOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

// ---------------------------------------------------------------------------
// Profile loading
// ---------------------------------------------------------------------------
type LoadedContext = 
  | { profile: NormalizedProfile; library: ReturnType<ExerciseLibraryService['load']>; requestedDays: WeekDayIndex[] | undefined }
  | { response: PlanGenerationResponse }
  | { serviceError: PublishedLibraryUnavailableError }
  | { missingProfile: true };

function loadNormalized(userId: number | undefined): LoadedContext {
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
      requestedDays: parseTrainingDays(profileRow.training_days),
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
  const days = buildDays(startOfWeek, loaded.profile, loaded.library, selection, req.userId, loaded.requestedDays);
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
    const days = buildDays(new Date(monday), loaded.profile, loaded.library, selection, req.userId, loaded.requestedDays);
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
