import { type ExerciseSnapshot, type PlanDay } from '@flourish/contracts';
import { eq } from 'drizzle-orm';
import { loadExerciseLibrary } from '../modules/exercises';
import { users, userProfiles, weeklyPlans, trainingRecords } from './schema';
import { getDb } from './index';
import { runMigrations } from './migrate';
import { hashPassword } from '../shared/password';

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_PLAN_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_RECORD_ID = '00000000-0000-4000-8000-000000000003';

const DAY_ORDER = [
  'fb_standing_march',
  'fb_bodyweight_squat',
  'fb_glute_bridge',
  'fb_incline_pushup',
  'cat_cow_stretch',
] as const;

const PRESETS: Record<string, { sets: number; reps: string | null; durationSeconds: number | null }> = {
  fb_standing_march: { sets: 2, reps: null, durationSeconds: 45 },
  fb_bodyweight_squat: { sets: 3, reps: '12-15', durationSeconds: null },
  fb_glute_bridge: { sets: 3, reps: '15', durationSeconds: null },
  fb_incline_pushup: { sets: 3, reps: '8-10', durationSeconds: null },
  cat_cow_stretch: { sets: 2, reps: null, durationSeconds: 60 },
};

const RECOMMEND_REASON =
  '初学者全身基础：热身、力量到拉伸一节完整课；按你每周 3 次、每次 30 分钟的目标控制在 25 分钟，强度锁定在难度 2。';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function mondayOfThisWeek(now: Date): Date {
  const d = new Date(now);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function buildDayExercises(libraryVersion: string): ExerciseSnapshot[] {
  const lib = loadExerciseLibrary();
  return DAY_ORDER.map((exerciseId) => {
    const exercise = lib.exercises.find((e) => e.exerciseId === exerciseId);
    if (!exercise) {
      throw new Error(`Seed exercise missing from library: ${exerciseId}`);
    }
    const preset = PRESETS[exerciseId];
    if (!preset) {
      throw new Error(`Seed preset missing for exercise: ${exerciseId}`);
    }
    return {
      exerciseId,
      name: exercise.name,
      sets: preset.sets,
      reps: preset.reps,
      durationSeconds: preset.durationSeconds,
      restSeconds: exercise.restSeconds,
      difficulty: exercise.difficulty,
      warning: exercise.warning,
      libraryVersion,
    };
  });
}

export async function seedDemoData(): Promise<void> {
  runMigrations();
  const db = getDb();

  db.delete(users).where(eq(users.email, 'demo@flourish.local')).run();

  const now = Date.now();
  const passwordHash = await hashPassword('demo1234');

  db.insert(users)
    .values({
      id: DEMO_USER_ID,
      email: 'demo@flourish.local',
      passwordHash,
      displayName: 'Flourish 演示用户',
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(userProfiles)
    .values({
      userId: DEMO_USER_ID,
      experienceLevel: 'beginner',
      targetMinutesPerSession: 30,
      targetSessionsPerWeek: 3,
      injuries: [],
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const lib = loadExerciseLibrary();
  const today = new Date();
  const monday = mondayOfThisWeek(today);
  const sunday = addDays(monday, 6);
  const todayStr = isoDate(today);

  const past = addDays(today, -1);
  const future = addDays(today, 1);
  const pastStr = isoDate(past);
  const futureStr = isoDate(future);

  const dates: string[] = [];
  if (past >= monday) dates.push(pastStr);
  dates.push(todayStr);
  if (future <= sunday) dates.push(futureStr);

  const exercises = buildDayExercises(lib.libraryVersion);
  const days: PlanDay[] = dates.map((date) => ({
    date,
    exercises,
    estimatedDurationMinutes: 25,
    recommendReason: RECOMMEND_REASON,
  }));

  db.insert(weeklyPlans)
    .values({
      id: DEMO_PLAN_ID,
      userId: DEMO_USER_ID,
      startDate: isoDate(monday),
      status: 'active',
      days,
      libraryVersion: lib.libraryVersion,
      createdAt: now,
    })
    .run();

  if (past >= monday) {
    db.insert(trainingRecords)
      .values({
        id: DEMO_RECORD_ID,
        userId: DEMO_USER_ID,
        weekPlanId: DEMO_PLAN_ID,
        date: pastStr,
        completed: true,
        durationMinutes: 26,
        createdAt: now,
      })
      .run();
  }

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'demo_data_seeded',
      userId: DEMO_USER_ID,
      planId: DEMO_PLAN_ID,
      startDate: isoDate(monday),
      days: dates,
      completedRecord: past >= monday ? pastStr : null,
    }),
  );
}

if (require.main === module) {
  seedDemoData().catch((err) => {
    console.error(JSON.stringify({ level: 'error', msg: 'seed_failed', error: String(err) }));
    process.exit(1);
  });
}
