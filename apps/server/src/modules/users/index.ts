/**
 * User profile routes: GET/PUT /api/users/me/profile.
 *
 * Safety (04-SAFETY_RULES.md §4): every field is range-checked by the
 * shared contract (updateProfileInputSchema) before touching the DB —
 * negative/zero/NaN heights, weights, ages are rejected with 400.
 * Profile rows self-heal: a missing row is created with defaults so
 * legacy accounts (created before this endpoint) keep working.
 */

import {
  profileSchema,
  updateProfileInputSchema,
  DEFAULT_AVAILABLE_EQUIPMENT,
  type Profile,
} from '@flourish/contracts';
import { eq } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';
import { getDb } from '../../db';
import { userProfiles } from '../../db/schema';
import { toProfileContract } from '../../shared/mappers';
import { requireAuth, requireUserId } from '../../shared/security';
import { validateBody } from '../../shared/validation';

const usersRouter = Router();

function nowMs(): number {
  return Date.now();
}

/**
 * Load the profile row for a user; create a default row if missing
 * (self-healing for accounts that predate the profile endpoint).
 */
function getOrCreateProfileRow(userId: string): Profile {
  const db = getDb();
  const existing = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();
  if (existing) return toProfileContract(existing);

  const timestamp = nowMs();
  try {
    db.insert(userProfiles)
      .values({
        userId,
        injuries: [],
        availableEquipment: [...DEFAULT_AVAILABLE_EQUIPMENT],
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  } catch (err) {
    // Unique-violation race (concurrent GETs): the winner's row is fine.
    const code = (err as { code?: unknown }).code;
    if (!(typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT'))) throw err;
  }

  const row = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  if (!row) throw new Error('Profile row missing after insert');
  return toProfileContract(row);
}

/**
 * GET /api/users/me/profile
 * Returns the current user's profile (creating a default one if absent).
 */
usersRouter.get('/me/profile', requireAuth, (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const profile = getOrCreateProfileRow(userId);
  res.json({ success: true, data: profileSchema.parse(profile) });
});

/**
 * PUT /api/users/me/profile
 * Partial update: only fields present in the body change; `null` clears
 * a nullable field. All fields validated by contract before DB write.
 */
usersRouter.put(
  '/me/profile',
  requireAuth,
  validateBody(updateProfileInputSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const patch = req.body as Record<string, unknown>;
    const db = getDb();

    getOrCreateProfileRow(userId); // ensure the row exists before update

    db.update(userProfiles)
      .set({ ...patch, updatedAt: nowMs() })
      .where(eq(userProfiles.userId, userId))
      .run();

    const row = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
    if (!row) throw new Error('Profile row missing after update');
    const profile: Profile = toProfileContract(row);
    res.json({ success: true, data: profileSchema.parse(profile) });
  },
);

export { usersRouter };
