/**
 * Workout session routes (跟练闭环).
 *
 * All routes require authentication; ownership is enforced in the service
 * (plan/session 403 for other users' resources — 04-SAFETY §4).
 * All request bodies pass through contract schemas (shared Zod).
 */

import {
  completeSessionInputSchema,
  completeSessionResponseSchema,
  createSessionInputSchema,
  jointDiscomfortInputSchema,
  jointDiscomfortResponseSchema,
  sessionExerciseActionInputSchema,
  workoutSessionSchema,
  type CompleteSessionInput,
} from '@flourish/contracts';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireUserId } from '../../shared/security';
import { validateBody, validateParams } from '../../shared/validation';
import {
  abortSession,
  completeSession,
  getSession,
  recordExerciseAction,
  reportJointDiscomfort,
  startSession,
} from './workouts.service';

const sessionParamsSchema = z.object({ id: z.string().min(1).max(128) });
const sessionExerciseParamsSchema = z.object({
  id: z.string().min(1).max(128),
  exerciseId: z.string().min(1).max(128),
});

const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

/** POST /api/workouts/sessions — start (or idempotently return) a session. */
workoutsRouter.post('/sessions', validateBody(createSessionInputSchema), (req, res) => {
  const userId = requireUserId(req);
  const result = startSession(userId, req.body as { weekPlanId: string; date: string });
  res
    .status(result.created ? 201 : 200)
    .json({ success: true, data: workoutSessionSchema.parse(result.session) });
});

/** GET /api/workouts/sessions/:id — read session state (refresh-safe). */
workoutsRouter.get(
  '/sessions/:id',
  validateParams(sessionParamsSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const session = getSession(userId, String(req.params['id']));
    res.json({ success: true, data: workoutSessionSchema.parse(session) });
  },
);

/** POST /api/workouts/sessions/:id/exercises/:exerciseId — complete/skip one action. */
workoutsRouter.post(
  '/sessions/:id/exercises/:exerciseId',
  validateParams(sessionExerciseParamsSchema),
  validateBody(sessionExerciseActionInputSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const session = recordExerciseAction(
      userId,
      String(req.params['id']),
      String(req.params['exerciseId']),
      req.body as { action: 'complete' | 'skip'; reason?: string },
    );
    res.json({ success: true, data: workoutSessionSchema.parse(session) });
  },
);

/**
 * POST /api/workouts/sessions/:id/joint-discomfort
 * SAFE-05 hard block + re-verification + safe alternatives.
 */
workoutsRouter.post(
  '/sessions/:id/joint-discomfort',
  validateParams(sessionParamsSchema),
  validateBody(jointDiscomfortInputSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = reportJointDiscomfort(
      userId,
      String(req.params['id']),
      req.body as {
        exerciseId: string;
        bodyArea: string;
        severity: 'mild' | 'moderate' | 'severe';
      },
    );
    res.json({ success: true, data: jointDiscomfortResponseSchema.parse(result) });
  },
);

/** POST /api/workouts/sessions/:id/complete — finish + persist training record. */
workoutsRouter.post(
  '/sessions/:id/complete',
  validateParams(sessionParamsSchema),
  validateBody(completeSessionInputSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = completeSession(
      userId,
      String(req.params['id']),
      req.body as CompleteSessionInput,
    );
    res.json({ success: true, data: completeSessionResponseSchema.parse(result) });
  },
);

/** POST /api/workouts/sessions/:id/abort — end this session. */
workoutsRouter.post(
  '/sessions/:id/abort',
  validateParams(sessionParamsSchema),
  (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const session = abortSession(userId, String(req.params['id']));
    res.json({ success: true, data: workoutSessionSchema.parse(session) });
  },
);

export { workoutsRouter };
