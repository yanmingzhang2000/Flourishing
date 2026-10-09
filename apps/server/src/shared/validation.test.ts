import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationError } from './errors';
import { validateBody } from './validation';

const schema = z.object({ name: z.string().min(1) });

function run(body: unknown): { error: unknown; nextCalled: boolean } {
  const middleware = validateBody(schema);
  let error: unknown;
  let nextCalled = false;
  middleware(
    { body } as Request,
    {} as Response,
    (err?: unknown) => {
      nextCalled = true;
      error = err;
    },
  );
  return { error, nextCalled };
}

describe('validateBody middleware', () => {
  it('passes valid payloads through without error', () => {
    const { error, nextCalled } = run({ name: 'Flourish' });
    expect(nextCalled).toBe(true);
    expect(error).toBeUndefined();
  });

  it('rejects invalid payloads with ValidationError and field details', () => {
    const { error, nextCalled } = run({ name: '' });
    expect(nextCalled).toBe(true);
    expect(error).toBeInstanceOf(ValidationError);
    const details = (error as ValidationError).details as Array<{ path: string }>;
    expect(details[0]?.path).toBe('name');
  });
});
