import {
  todayPlanResponseSchema,
  planDaySchema,
  generatePlanInputSchema,
  generatePlanResponseSchema,
  type TodayPlanResponse,
  type WeeklyPlan,
  type GeneratePlanInput,
} from '@flourish/contracts';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../db';
import { trainingRecords, users, weeklyPlans } from '../../db/schema';
import { AppError } from '../../shared/errors';
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

  const activePlans = db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, userId), eq(weeklyPlans.status, 'active')))
    .orderBy(desc(weeklyPlans.startDate))
    .all();

  const todayStr = localIsoDate();
  const planRow = activePlans.find(
    (p) => todayStr >= p.startDate && todayStr <= addDaysIso(p.startDate, 6),
  );
  if (!planRow) {
    res.json({ success: true, data: emptyResponse });
    return;
  }

  const daysParsed = planDaySchema.array().safeParse(planRow.days);
  if (!daysParsed.success) {
    throw new AppError(500, 'plan_corrupt', 'Stored plan days failed contract validation');
  }

  const plan: WeeklyPlan = {
    id: planRow.id,
    userId: planRow.userId,
    startDate: planRow.startDate,
    status: planRow.status as WeeklyPlan['status'],
    days: daysParsed.data,
    libraryVersion: planRow.libraryVersion,
    createdAt: new Date(planRow.createdAt).toISOString(),
  };

  const today = daysParsed.data.find((day) => day.date === todayStr) ?? null;

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
      scheduled: daysParsed.data.length,
      completed: completedDates.size,
      days: daysParsed.data.map((day) => ({
        date: day.date,
        completed: completedDates.has(day.date),
        isToday: day.date === todayStr,
      })),
    },
  });

  res.json({ success: true, data });
});

export { plansRouter };
