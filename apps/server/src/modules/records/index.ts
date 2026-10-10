/**
 * Training record read API: GET /api/records (own records only).
 *
 * Records are scoped to the authenticated user (04-SAFETY §4: 记录归属
 * 校验) — there is no way to read someone else's training history.
 */

import { trainingRecordSchema, type TrainingRecord } from '@flourish/contracts';
import { and, desc, eq } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../db';
import { trainingRecords } from '../../db/schema';
import { requireAuth, requireUserId } from '../../shared/security';

const recordsRouter = Router();

function toRecordContract(row: typeof trainingRecords.$inferSelect): TrainingRecord {
  return {
    id: row.id,
    userId: row.userId,
    weekPlanId: row.weekPlanId,
    date: row.date,
    completed: row.completed,
    durationMinutes: row.durationMinutes,
    feedback: row.feedback as TrainingRecord['feedback'],
    notes: row.notes,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

recordsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const weekPlanId =
    typeof req.query['weekPlanId'] === 'string' ? req.query['weekPlanId'] : undefined;

  const filters = [eq(trainingRecords.userId, userId)];
  if (weekPlanId) filters.push(eq(trainingRecords.weekPlanId, weekPlanId));

  const db = getDb();
  const rows = db
    .select()
    .from(trainingRecords)
    .where(and(...filters))
    .orderBy(desc(trainingRecords.createdAt))
    .limit(200)
    .all();

  const data = rows.map((row) => trainingRecordSchema.parse(toRecordContract(row)));
  res.json({ success: true, data });
});

export { recordsRouter };
