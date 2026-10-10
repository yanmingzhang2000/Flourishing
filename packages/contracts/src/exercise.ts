import { z } from 'zod';

export const exerciseCategorySchema = z.enum(['strength', 'warmup', 'stretch', 'cardio']);

export const difficultySchema = z.number().int().min(1).max(5);

export const exerciseMediaSchema = z.object({
  coverImage: z.string().nullable().optional(),
  video: z.string().nullable().optional(),
});

export const exerciseSchema = z.object({
  exerciseId: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  nameEn: z.string().min(1).max(160),
  muscleGroup: z.object({
    primary: z.array(z.string().min(1).max(64)),
    secondary: z.array(z.string().min(1).max(64)),
  }),
  difficulty: difficultySchema,
  equipment: z.array(z.string().min(1).max(64)),
  function: z.object({
    primary: z.string().min(1).max(64),
    secondary: z.string().min(1).max(64),
  }),
  category: exerciseCategorySchema,
  targetProjects: z.array(z.string().min(1).max(64)),
  contraindications: z.array(z.string().min(1).max(64)),
  alternativeExerciseIds: z.array(z.string().min(1).max(128)),
  restSeconds: z.number().int().min(0).max(600),
  steps: z.array(z.string().min(1)).min(1),
  tips: z.array(z.string().min(1)),
  warning: z.string().min(1),
  media: exerciseMediaSchema.optional(),
});

export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>;

export const exerciseListResponseSchema = z.object({
  libraryVersion: z.string().min(1).max(64),
  exercises: z.array(exerciseSchema),
});

export type ExerciseListResponse = z.infer<typeof exerciseListResponseSchema>;
