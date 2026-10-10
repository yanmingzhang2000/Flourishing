import type { ZodType } from 'zod';

const TOKEN_KEY = 'flourish_token';

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

// Token storage helpers
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function buildHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

async function apiFetch<T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit,
  includeAuth = true,
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...buildHeaders(includeAuth), ...init.headers },
  });

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

export async function apiGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  return apiFetch(path, schema, { method: 'GET' });
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
  includeAuth = true,
): Promise<T> {
  return apiFetch(path, schema, { method: 'POST', body: JSON.stringify(body) }, includeAuth);
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  return apiFetch(path, schema, { method: 'PUT', body: JSON.stringify(body) });
}
