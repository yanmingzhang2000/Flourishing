import {
  todayPlanResponseSchema,
  planDaySchema,
  type TodayPlanResponse,
  type WeeklyPlan,
} from '@flourish/contracts';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../db';
import { trainingRecords, users, weeklyPlans } from '../../db/schema';
import { AppError } from '../../shared/errors';

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

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

plansRouter.get('/today', (_req: Request, res: Response) => {
  const db = getDb();

  // 任务 2 临时口径：无认证体系，固定读取演示用户；认证接入后替换为当前会话用户。
  const user = db.select().from(users).where(eq(users.id, DEMO_USER_ID)).get();
  if (!user) {
    res.json({ success: true, data: emptyResponse });
    return;
  }

  const activePlans = db
    .select()
    .from(weeklyPlans)
    .where(and(eq(weeklyPlans.userId, DEMO_USER_ID), eq(weeklyPlans.status, 'active')))
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
        eq(trainingRecords.userId, DEMO_USER_ID),
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
