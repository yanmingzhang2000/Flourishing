import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const exerciseSnapshotSchema = z.object({
  exerciseId: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(20),
  reps: z.string().min(1).max(64).nullable(),
  durationSeconds: z.number().int().min(1).max(7200).nullable(),
  restSeconds: z.number().int().min(0).max(600),
  difficulty: z.number().int().min(1).max(5),
  warning: z.string().min(1),
  libraryVersion: z.string().min(1).max(64),
});

export const planDaySchema = z.object({
  date: isoDateSchema,
  exercises: z.array(exerciseSnapshotSchema).min(1),
  estimatedDurationMinutes: z.number().int().min(1).max(600),
  recommendReason: z.string().min(1).max(300).optional(),
});

export const planStatusSchema = z.enum(['active', 'completed', 'superseded']);

export const weeklyPlanSchema = z.object({
  id: idSchema,
  userId: idSchema,
  startDate: isoDateSchema,
  status: planStatusSchema,
  days: z.array(planDaySchema).min(1).max(7),
  libraryVersion: z.string().min(1).max(64),
  createdAt: z.iso.datetime(),
});

export const generatePlanInputSchema = z.object({
  startDate: isoDateSchema,
});

export const weekProgressDaySchema = z.object({
  date: isoDateSchema,
  completed: z.boolean(),
  isToday: z.boolean(),
});

export const weekProgressSchema = z.object({
  startDate: isoDateSchema,
  scheduled: z.number().int().min(0).max(7),
  completed: z.number().int().min(0),
  days: z.array(weekProgressDaySchema).min(0).max(7),
});

export const todayPlanResponseSchema = z.object({
  plan: weeklyPlanSchema.nullable(),
  today: planDaySchema.nullable(),
  weekProgress: weekProgressSchema.nullable(),
});

export type ExerciseSnapshot = z.infer<typeof exerciseSnapshotSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;
export type GeneratePlanInput = z.infer<typeof generatePlanInputSchema>;
export type WeekProgressDay = z.infer<typeof weekProgressDaySchema>;
export type WeekProgress = z.infer<typeof weekProgressSchema>;
export type TodayPlanResponse = z.infer<typeof todayPlanResponseSchema>;
