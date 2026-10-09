import { z } from 'zod';
import { idSchema, isoTimestampSchema } from './common';

export const copilotRoleSchema = z.enum(['user', 'assistant']);

export const copilotMessageSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  role: copilotRoleSchema,
  content: z.string().min(1).max(8000),
  createdAt: isoTimestampSchema,
});

export const copilotSessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string().min(1).max(200).nullable(),
  createdAt: isoTimestampSchema,
});

export const copilotChatInputSchema = z.object({
  sessionId: idSchema.optional(),
  message: z.string().min(1).max(4000),
});

export type CopilotRole = z.infer<typeof copilotRoleSchema>;
export type CopilotMessage = z.infer<typeof copilotMessageSchema>;
export type CopilotSession = z.infer<typeof copilotSessionSchema>;
export type CopilotChatInput = z.infer<typeof copilotChatInputSchema>;
