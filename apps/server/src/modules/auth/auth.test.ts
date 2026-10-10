import { authMeResponseSchema, authSessionSchema } from '@flourish/contracts';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmpDb = path.join(os.tmpdir(), `flourish-auth-test-${process.pid}-${Date.now()}.db`);

let server: Server;
let baseUrl: string;
let closeDb: (typeof import('../../db'))['closeDb'];
let runMigrationsFn: (typeof import('../../db/migrate'))['runMigrations'];

let uniqueCounter = 0;
function uniqueEmail(): string {
  uniqueCounter += 1;
  return `auth-${process.pid}-${Date.now()}-${uniqueCounter}@flourish.local`;
}

async function register(email: string, password: string) {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res;
}

async function login(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function me(token?: string) {
  return fetch(`${baseUrl}/api/auth/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeAll(async () => {
  process.env['DATABASE_PATH'] = tmpDb;
  ({ runMigrations: runMigrationsFn } = await import('../../db/migrate'));
  runMigrationsFn();
  ({ closeDb } = await import('../../db'));
  const { createApp } = await import('../../app');

  const app = createApp();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  closeDb();
  fs.rmSync(tmpDb, { force: true });
  fs.rmSync(`${tmpDb}-wal`, { force: true });
  fs.rmSync(`${tmpDb}-shm`, { force: true });
});

describe('POST /api/auth/register', () => {
  it('creates user + default profile and returns a bearer token', async () => {
    const res = await register(uniqueEmail(), 'password-123');
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);

    const session = authSessionSchema.parse(body.data);
    expect(session.token.length).toBeGreaterThan(0);
    expect(session.user.email).toContain('@flourish.local');
    expect(session.user.id).toMatch(/^[0-9a-f-]{36}$/);

    // Token is immediately usable
    const meRes = await me(session.token);
    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as { success: boolean; data: unknown };
    const payload = authMeResponseSchema.parse(meBody.data);
    expect(payload.user.id).toBe(session.user.id);
    // Default profile created at registration (equipment: bodyweight + mat)
    expect(payload.profile).not.toBeNull();
    expect(payload.profile?.availableEquipment).toEqual(['bodyweight', 'mat_6mm']);
    expect(payload.profile?.injuries).toEqual([]);
  });

  it('rejects duplicate email with 409', async () => {
    const email = uniqueEmail();
    const first = await register(email, 'password-123');
    expect(first.status).toBe(201);

    const second = await register(email, 'password-123');
    expect(second.status).toBe(409);
    const body = (await second.json()) as { success: boolean; error?: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('conflict');
  });

  it('rejects short password with 400', async () => {
    const res = await register(uniqueEmail(), 'short');
    expect(res.status).toBe(400);
  });

  it('rejects invalid email with 400', async () => {
    const res = await register('not-an-email', 'password-123');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token for correct credentials', async () => {
    const email = uniqueEmail();
    await register(email, 'password-123');

    const res = await login(email, 'password-123');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const session = authSessionSchema.parse(body.data);
    expect(session.user.email).toBe(email);
  });

  it('returns 401 for wrong password', async () => {
    const email = uniqueEmail();
    await register(email, 'password-123');

    const res = await login(email, 'wrong-password');
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email (no enumeration)', async () => {
    const res = await login('nobody@flourish.local', 'password-123');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await me();
    expect(res.status).toBe(401);
  });

  it('returns 401 for a garbage token', async () => {
    const res = await me('not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user and profile', async () => {
    const email = uniqueEmail();
    const regRes = await register(email, 'password-123');
    const session = authSessionSchema.parse(
      ((await regRes.json()) as { data: unknown }).data,
    );

    const res = await me(session.token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const payload = authMeResponseSchema.parse(body.data);
    expect(payload.user.email).toBe(email);
    expect(payload.profile?.userId).toBe(session.user.id);
  });
});
