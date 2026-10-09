import { z } from 'zod';
import { idSchema, isoTimestampSchema } from './common';

export const emailSchema = z.email().max(254);

export const passwordSchema = z.string().min(8).max(128);

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const userSchema = z.object({
  id: idSchema,
  email: emailSchema,
  displayName: z.string().min(1).max(80).nullable(),
  createdAt: isoTimestampSchema,
});

export const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);

export const injuryTagSchema = z.string().min(1).max(64);

export const profileSchema = z.object({
  userId: idSchema,
  heightCm: z.number().min(50).max(250).nullable(),
  weightKg: z.number().min(10).max(300).nullable(),
  age: z.number().int().min(10).max(100).nullable(),
  experienceLevel: experienceLevelSchema.nullable(),
  targetMinutesPerSession: z.number().int().min(5).max(180).nullable(),
  targetSessionsPerWeek: z.number().int().min(1).max(7).nullable(),
  injuries: z.array(injuryTagSchema),
  updatedAt: isoTimestampSchema,
});

export const updateProfileInputSchema = z
  .object({
    heightCm: profileSchema.shape.heightCm.optional(),
    weightKg: profileSchema.shape.weightKg.optional(),
    age: profileSchema.shape.age.optional(),
    experienceLevel: experienceLevelSchema.nullable().optional(),
    targetMinutesPerSession: profileSchema.shape.targetMinutesPerSession.optional(),
    targetSessionsPerWeek: profileSchema.shape.targetSessionsPerWeek.optional(),
    injuries: z.array(injuryTagSchema).optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type User = z.infer<typeof userSchema>;
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
