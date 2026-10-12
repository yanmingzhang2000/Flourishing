import { z } from 'zod';

/**
 * Form-input helpers: RHF text inputs produce strings, but contract
 * schemas validate numbers. Ranges/messages come from the contract shape
 * (single source of truth) — these helpers only handle string→number
 * coercion and empty-field semantics.
 *
 * The `any` input generic is required because zod v4 primitive schemas
 * declare `Input = unknown` on their public ZodType surface.
 */

/** Required numeric field: empty/non-numeric fails with 请输入数字; null fails 必填. */
export function requiredNumber<Schema extends z.ZodType<number | null, any>>(
  fieldSchema: Schema,
) {
  return z
    .string()
    .transform((value, ctx) => {
      const trimmed = value.trim();
      const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: 'custom', message: '请输入数字' });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(fieldSchema)
    .refine((value) => value !== null, { message: '此项必填' });
}

/** Optional numeric field: empty input becomes null (clears the value). */
export function optionalNumber<Schema extends z.ZodType<number | null, any>>(
  fieldSchema: Schema,
) {
  return z
    .string()
    .transform((value, ctx) => {
      const trimmed = value.trim();
      if (trimmed === '') return null;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: 'custom', message: '请输入数字' });
        return z.NEVER;
      }
      return parsed;
    })
    .pipe(fieldSchema);
}
