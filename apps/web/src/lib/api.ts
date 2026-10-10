import type { ZodType } from 'zod';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface Envelope {
  success?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string };
}

export async function apiGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } });

  let body: Envelope;
  try {
    body = (await res.json()) as Envelope;
  } catch {
    throw new ApiError('invalid_response', `Invalid JSON response from ${path}`, res.status);
  }

  if (!res.ok || body.success !== true) {
    throw new ApiError(
      body.error?.code ?? 'http_error',
      body.error?.message ?? `Request failed: ${path}`,
      res.status,
    );
  }

  return schema.parse(body.data);
}
