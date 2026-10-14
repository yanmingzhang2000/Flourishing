import {
  activePlanResponseSchema,
  todayPlanResponseSchema,
  planAdjustmentSchema,
  planDaySchema,
  generatePlanInputSchema,
  generatePlanResponseSchema,
  isoDateSchema,
  type TodayPlanResponse,
  type WeeklyPlan,
  type GeneratePlanInput,
} from '@flourish/contracts';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { composition, safety } from '@flourish/training-domain';
import { getDb } from '../../db';
import { trainingRecords, users, weeklyPlans } from '../../db/schema';
import { AppError, ValidationError } from '../../shared/errors';
import { optionalAuth, requireAuth, requireUserId } from '../../shared/security';
import { generatePlan } from './plans.service';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDaysIso(iso: string, days: number): string {
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

const emptyResponse: TodayPlanResponse = { plan: null, today: null, weekProgress: null };

/**
 * Map internal contraindication tags (e.g. shoulder_impingement) back to
 * the user-facing injury options stored in the profile (肩/肘/腕/腰/膝/颈),
 * using the single-source mapping table in training-domain (SAFE-01a).
 * Used for error attribution messages shown to the user.
 */
function injuryTagUserLabels(tags: readonly string[]): string[] {
  const wanted = new Set(tags);
  const labels: string[] = [];
  for (const [option, optionTags] of Object.entries(safety.INJURY_OPTION_TAG_MAP)) {
    if (optionTags.some((t) => wanted.has(t))) labels.push(option);
  }
  return labels;
}

/**
 * Newest active plan covering `date` (startDate..startDate+6), tie-broken
 * by createdAt. Single source of this selection rule: /today and /active
 * must never diverge (calendar browsing shows the same plan as home).
 */
function findActivePlanRow(userId: string, date: string) {
  const db = getDb();
  const activePlans = db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.status, 'active')))
    // Same startDate (e.g. regenerated this week) → newest generation wins,
    // so /today always reflects the latest adjustment (E2E #3).
    .orderBy(desc(weeklyPlans.startDate), desc(weeklyPlans.createdAt))
    .all();

  return (
    activePlans.find((p) => date >= p.startDate && date <= addDaysIso(p.startDate, 6)) ?? null
  );
}

function toWeeklyPlanContract(row: typeof weeklyPlans.$inferSelect): WeeklyPlan {
  const daysParsed = planDaySchema.array().safeParse(row.days);
  if (!daysParsed.success) {
    throw new AppError(500, 'plan_corrupt', 'Stored plan days failed contract validation');
  }

  // Adjustment is user-facing but cosmetic: invalid stored JSON degrades to
  // "no explanation" instead of failing the whole response.
  const adjustmentParsed = planAdjustmentSchema.safeParse(row.adjustment);
  const adjustment = adjustmentParsed.success ? adjustmentParsed.data : undefined;

  return {
    id: row.id,
    userId: row.userId,
    startDate: row.startDate,
    status: row.status as WeeklyPlan['status'],
    days: daysParsed.data,
    libraryVersion: row.libraryVersion,
    createdAt: new Date(row.createdAt).toISOString(),
    ...(adjustment ? { adjustment } : {}),
  };
}

const plansRouter = Router();

/**
 * POST /api/plans/generate
 * 生成一周训练计划
 *
 * 权限：requireAuth — 计划必须归属当前会话用户（04-SAFETY §4）。
 */
plansRouter.post('/generate', requireAuth, (req: Request, res: Response) => {
  const userId = requireUserId(req);

  // 解析并验证输入
  const input = generatePlanInputSchema.safeParse(req.body);
  if (!input.success) {
    throw new AppError(400, 'invalid_input', `Invalid request body: ${input.error.message}`);
  }

  try {
    const plan = generatePlan(userId, input.data);
    const response = generatePlanResponseSchema.parse({
      plan,
      libraryVersion: plan.libraryVersion,
    });
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // Structured insufficient-safe-exercises failure (training-domain
    // planner): attach deterministic attribution details so the frontend
    // can tell the user it was the injury filter that emptied a category
    // — not a generic failure (P0 test-report fix).
    if (error instanceof composition.InsufficientSafeExercisesError) {
      throw new AppError(400, 'insufficient_safe_exercises', error.message, {
        emptyCategories: [...error.emptyCategories],
        injuryTags: [...error.injuryTags],
        injuryLabels: injuryTagUserLabels(error.injuryTags),
        excludedCount: error.excludedCount,
      });
    }
    // Other RangeErrors from the training-domain (e.g. unknown project in
    // the duration formula) are still client-attributable → 400.
    if (error instanceof RangeError) {
      throw new AppError(400, 'insufficient_safe_exercises', error.message);
    }
    // Log internal errors for debugging (structured JSON, matching seed.ts pattern)
    console.error(JSON.stringify({
      level: 'error',
      msg: 'plan_generation_failed',
      error: error instanceof Error ? error.message : String(error),
    }));
    throw new AppError(500, 'plan_generation_failed', `Failed to generate plan: ${error instanceof Error ? error.message : String(error)}`);
  }
});

plansRouter.get('/today', optionalAuth, (req: Request, res: Response) => {
  // Guest read path (04-SAFETY §5: 游客与登录态遵循相同安全规则):
  // no session → empty payload, never someone else's plan.
  if (!req.auth) {
    res.json({ success: true, data: emptyResponse });
    return;
  }
  const userId = requireUserId(req);
  const db = getDb();

  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    res.json({ success: true, data: emptyResponse });
    return;
  }

  const todayStr = localIsoDate();
  const planRow = findActivePlanRow(userId, todayStr);
  if (!planRow) {
    res.json({ success: true, data: emptyResponse });
    return;
  }

  const plan = toWeeklyPlanContract(planRow);
  const today = plan.days.find((day) => day.date === todayStr) ?? null;

  const weekEnd = addDaysIso(planRow.startDate, 6);
  const completedRows = db
    .select({ date: trainingRecords.date })
    .from(trainingRecords)
    .where(
      and(
        eq(trainingRecords.userId, userId),
        eq(trainingRecords.completed, true),
        gte(trainingRecords.date, planRow.startDate),
        lte(trainingRecords.date, weekEnd),
      ),
    )
    .all();
  const completedDates = new Set(completedRows.map((row) => row.date));

  const data = todayPlanResponseSchema.parse({
    plan,
    today,
    weekProgress: {
      startDate: planRow.startDate,
      scheduled: plan.days.length,
      completed: completedDates.size,
      days: plan.days.map((day) => ({
        date: day.date,
        completed: completedDates.has(day.date),
        isToday: day.date === todayStr,
      })),
    },
  });

  res.json({ success: true, data });
});

/**
 * GET /api/plans/active?date=YYYY-MM-DD
 * 按日期查询覆盖该日期的最新 active 计划（日历页浏览用，02-DESIGN §3）。
 *
 * 权限：requireAuth — 计划归属当前会话用户（04-SAFETY §4）。
 * 选择规则与 /today 同源（findActivePlanRow），避免日历与首页展示漂移。
 */
plansRouter.get('/active', requireAuth, (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const dateParam = typeof req.query['date'] === 'string' ? req.query['date'] : undefined;
  const parsedDate = isoDateSchema.safeParse(dateParam);
  if (!parsedDate.success) {
    throw new ValidationError('Query parameter "date" must be a valid ISO date (YYYY-MM-DD)');
  }

  const row = findActivePlanRow(userId, parsedDate.data);
  const plan = row ? toWeeklyPlanContract(row) : null;
  const data = activePlanResponseSchema.parse({ plan });
  res.json({ success: true, data });
});

export { plansRouter };
