import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';
import { exerciseSnapshotSchema } from './plan';
import { trainingFeedbackSchema } from './record';

export const sessionStatusSchema = z.enum(['in_progress', 'completed', 'aborted']);

/**
 * Per-exercise lifecycle inside a session.
 *
 * - pending:   not yet acted on
 * - completed: user finished it
 * - skipped:   user skipped it (reason required), or it was stopped due to
 *              reported joint discomfort (discomfort set, SAFE-05 step 1)
 * - blocked:   safety re-verification excluded it for this session
 *              (SAFE-05a) — completing a blocked exercise is a 409.
 */
export const sessionExerciseStatusSchema = z.enum([
  'pending',
  'completed',
  'skipped',
  'blocked',
]);

export const discomfortSeveritySchema = z.enum(['mild', 'moderate', 'severe']);

export const jointDiscomfortInputSchema = z.object({
  exerciseId: z.string().min(1).max(128),
  /** Body area from the controlled vocabulary (肩/肘/腕/腰/膝/颈). */
  bodyArea: z.string().min(1).max(64),
  severity: discomfortSeveritySchema,
});

export const sessionExerciseSchema = z.object({
  exerciseSnapshot: exerciseSnapshotSchema,
  status: sessionExerciseStatusSchema,
  /** Skip/block/discomfort explanation (shown in history). */
  reason: z.string().max(500).nullable(),
  /** Set when this exercise was stopped/excluded due to reported discomfort. */
  discomfort: jointDiscomfortInputSchema.nullable(),
});

export const workoutSessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  weekPlanId: idSchema,
  date: isoDateSchema,
  status: sessionStatusSchema,
  exercises: z.array(sessionExerciseSchema).min(1),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});

export const createSessionInputSchema = z.object({
  weekPlanId: idSchema,
  date: isoDateSchema,
});

export const sessionExerciseActionInputSchema = z.object({
  action: z.enum(['complete', 'skip']),
  reason: z.string().min(1).max(500).optional(),
});

export const completeSessionInputSchema = z
  .object({
    durationMinutes: z.number().int().min(0).max(600).optional(),
    feedback: trainingFeedbackSchema.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

/** One blocked exercise after safety re-verification (SAFE-05a). */
export const blockedExerciseSchema = z.object({
  exerciseId: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  /** Contraindication tags that triggered the block. */
  reasonTags: z.array(z.string().min(1).max(64)).min(1),
});

/** Safe substitute for a stopped/blocked exercise (SAFE-05b). */
export const alternativeSchema = z.object({
  forExerciseId: z.string().min(1).max(128),
  replacement: exerciseSnapshotSchema,
});

/**
 * Response of POST /api/workouts/sessions/:id/joint-discomfort.
 *
 * `suggestedInjuryOptions` are user-facing injury options (肩/肘/…).
 * The server NEVER writes them to the profile automatically — the user
 * must confirm via PUT /api/users/me/profile (04-SAFETY §2: 更新用户
 * 限制标记（需用户确认）).
 */
export const jointDiscomfortResponseSchema = z.object({
  session: workoutSessionSchema,
  reportedExerciseId: z.string().min(1).max(128),
  newlyBlocked: z.array(blockedExerciseSchema),
  alternatives: z.array(alternativeSchema),
  /** Deterministic rest/medical guidance (severity → advice table). */
  restAdvice: z.string().min(1).max(500),
  suggestedInjuryOptions: z.array(z.string().min(1).max(64)).min(1),
});

export const completeSessionResponseSchema = z.object({
  session: workoutSessionSchema,
  recordId: idSchema,
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type SessionExerciseStatus = z.infer<typeof sessionExerciseStatusSchema>;
export type JointDiscomfortInput = z.infer<typeof jointDiscomfortInputSchema>;
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type SessionExerciseActionInput = z.infer<typeof sessionExerciseActionInputSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionInputSchema>;
export type BlockedExercise = z.infer<typeof blockedExerciseSchema>;
export type Alternative = z.infer<typeof alternativeSchema>;
export type JointDiscomfortResponse = z.infer<typeof jointDiscomfortResponseSchema>;
export type CompleteSessionResponse = z.infer<typeof completeSessionResponseSchema>;
