import { z } from 'zod';
import { idSchema, isoDateSchema, isoTimestampSchema } from './common';

export const trainingFeedbackSchema = z.enum(['too_hard', 'just_right', 'too_easy']);

export const trainingRecordSchema = z.object({
  id: idSchema,
  userId: idSchema,
  weekPlanId: idSchema,
  date: isoDateSchema,
  completed: z.boolean(),
  durationMinutes: z.number().int().min(0).max(600).nullable(),
  feedback: trainingFeedbackSchema.nullable(),
  notes: z.string().max(2000).nullable(),
  createdAt: isoTimestampSchema,
});

export const createTrainingRecordInputSchema = z.object({
  weekPlanId: idSchema,
  date: isoDateSchema,
  completed: z.boolean(),
  durationMinutes: z.number().int().min(0).max(600).nullable().optional(),
  feedback: trainingFeedbackSchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type TrainingFeedback = z.infer<typeof trainingFeedbackSchema>;
export type TrainingRecord = z.infer<typeof trainingRecordSchema>;
export type CreateTrainingRecordInput = z.infer<typeof createTrainingRecordInputSchema>;
