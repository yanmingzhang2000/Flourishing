/**
 * Authentication routes: register / login / me (PRODUCT_LOGIC §10.1).
 *
 * Security rules (04-SAFETY_RULES.md §5):
 * - Passwords hashed with bcrypt (async, 12 rounds) — never logged.
 * - Registration race: single transaction + UNIQUE constraint on email;
 *   the constraint violation maps to 409 (no partial user+profile rows).
 * - Login failures are uniformly 401 (no user enumeration).
 * - JWT signed with config.jwtSecret (production requires a real secret,
 *   enforced in index.ts); tokens are Bearer-only over HTTPS.
 */

import {
  authMeResponseSchema,
  authSessionSchema,
  DEFAULT_AVAILABLE_EQUIPMENT,
  loginInputSchema,
  registerInputSchema,
} from '@flourish/contracts';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../../db';
import { userProfiles, users } from '../../db/schema';
import { config } from '../../config';
import { ConflictError, UnauthorizedError } from '../../shared/errors';
import { toProfileContract, toUserContract } from '../../shared/mappers';
import { hashPassword, verifyPassword } from '../../shared/password';
import { requireAuth, requireUserId } from '../../shared/security';
import { validateBody } from '../../shared/validation';

const TOKEN_EXPIRES_IN = '7d';

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: TOKEN_EXPIRES_IN });
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
}

/**
 * Precomputed dummy hash so unknown-email logins perform the same bcrypt
 * work as real ones (timing equalization, no enumeration).
 */
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('timing-equalizer-not-a-real-account');
  return dummyHashPromise;
}

const authRouter = Router();

/**
 * POST /api/auth/register
 * Creates user + default profile in one transaction, returns a bearer token.
 */
authRouter.post(
  '/register',
  validateBody(registerInputSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const userId = randomUUID();

    const db = getDb();
    try {
      db.transaction((tx) => {
        tx.insert(users)
          .values({
            id: userId,
            email,
            passwordHash,
            displayName: null,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        tx.insert(userProfiles)
          .values({
            userId,
            injuries: [],
            availableEquipment: [...DEFAULT_AVAILABLE_EQUIPMENT],
            createdAt: now,
            updatedAt: now,
          })
          .run();
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('An account with this email already exists');
      }
      throw err;
    }

    const userRow = db.select().from(users).where(eq(users.id, userId)).get();
    if (!userRow) {
      throw new Error('User disappeared right after insert'); // unreachable; keeps TS narrowing honest
    }

    const session = authSessionSchema.parse({
      token: signToken(userId),
      user: toUserContract(userRow),
    });
    res.status(201).json({ success: true, data: session });
  },
);

/**
 * POST /api/auth/login
 * Uniform 401 for unknown email and wrong password (no enumeration).
 */
authRouter.post('/login', validateBody(loginInputSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const db = getDb();
  const userRow = db.select().from(users).where(eq(users.email, email)).get();

  // Always run bcrypt compare (against a dummy hash for unknown emails)
  // so response timing does not reveal account existence.
  const hash = userRow ? userRow.passwordHash : await getDummyHash();
  const valid = await verifyPassword(password, hash);
  if (!userRow || !valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const session = authSessionSchema.parse({
    token: signToken(userRow.id),
    user: toUserContract(userRow),
  });
  res.json({ success: true, data: session });
});

/**
 * GET /api/auth/me
 * Returns the authenticated user + profile.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const db = getDb();

  const userRow = db.select().from(users).where(eq(users.id, userId)).get();
  if (!userRow) {
    // Token is valid but the account no longer exists.
    throw new UnauthorizedError('Account no longer exists');
  }

  const profileRow = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();

  const payload = authMeResponseSchema.parse({
    user: toUserContract(userRow),
    profile: profileRow ? toProfileContract(profileRow) : null,
  });
  res.json({ success: true, data: payload });
});

export { authRouter };
