import { z } from 'zod';
import { idSchema } from './common';
import { exerciseSnapshotSchema } from './plan';

export const sessionStatusSchema = z.enum(['in_progress', 'completed', 'aborted']);

export const jointDiscomfortInputSchema = z.object({
  exerciseId: z.string().min(1).max(128),
  bodyArea: z.string().min(1).max(64),
  severity: z.enum(['mild', 'moderate', 'severe']),
});

export const workoutSessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  weekPlanId: idSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: sessionStatusSchema,
  exercises: z.array(
    z.object({
      exerciseSnapshot: exerciseSnapshotSchema,
      completed: z.boolean(),
      skipped: z.boolean(),
      skipReason: z.string().max(500).nullable(),
    }),
  ),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
});

export type SessionStatus = z.infer<typeof sessionStatusSchema>;
export type JointDiscomfortInput = z.infer<typeof jointDiscomfortInputSchema>;
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;
