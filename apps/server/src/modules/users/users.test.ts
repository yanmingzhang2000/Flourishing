import { authSessionSchema, profileSchema } from '@flourish/contracts';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmpDb = path.join(os.tmpdir(), `flourish-users-test-${process.pid}-${Date.now()}.db`);

let server: Server;
let baseUrl: string;
let closeDb: (typeof import('../../db'))['closeDb'];
let runMigrationsFn: (typeof import('../../db/migrate'))['runMigrations'];
let token = '';

async function getProfile() {
  return fetch(`${baseUrl}/api/users/me/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function putProfile(payload: unknown) {
  return fetch(`${baseUrl}/api/users/me/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
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

  // Register a dedicated user for profile tests
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'profile-test@flourish.local', password: 'password-123' }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  token = authSessionSchema.parse(body.data).token;
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

describe('GET /api/users/me/profile', () => {
  it('requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/users/me/profile`);
    expect(res.status).toBe(401);
  });

  it('returns the default profile created at registration', async () => {
    const res = await getProfile();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const profile = profileSchema.parse(body.data);
    expect(profile.availableEquipment).toEqual(['bodyweight', 'mat_6mm']);
    expect(profile.injuries).toEqual([]);
    expect(profile.experienceLevel).toBeNull();
  });
});

describe('PUT /api/users/me/profile', () => {
  it('rejects height below safe range (04-SAFETY §4)', async () => {
    const res = await putProfile({ heightCm: 30 });
    expect(res.status).toBe(400);
  });

  it('rejects zero/negative weight', async () => {
    const res = await putProfile({ weightKg: -5 });
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (strict contract)', async () => {
    const res = await putProfile({ isAdmin: true });
    expect(res.status).toBe(400);
  });

  it('rejects empty availableEquipment (min 1)', async () => {
    const res = await putProfile({ availableEquipment: [] });
    expect(res.status).toBe(400);
  });

  it('updates valid fields and returns the new profile', async () => {
    const res = await putProfile({
      heightCm: 165,
      weightKg: 55.5,
      age: 30,
      experienceLevel: 'beginner',
      targetMinutesPerSession: 30,
      targetSessionsPerWeek: 3,
      injuries: ['膝'],
      availableEquipment: ['bodyweight', 'mat_6mm', 'dumbbell_2kg'],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const profile = profileSchema.parse(body.data);
    expect(profile.heightCm).toBe(165);
    expect(profile.weightKg).toBe(55.5);
    expect(profile.injuries).toEqual(['膝']);
    expect(profile.availableEquipment).toEqual([
      'bodyweight',
      'mat_6mm',
      'dumbbell_2kg',
    ]);

    // Persisted: subsequent GET sees the update
    const getRes = await getProfile();
    const getBody = (await getRes.json()) as { data: unknown };
    const again = profileSchema.parse(getBody.data);
    expect(again.heightCm).toBe(165);
  });

  it('supports partial update (only provided fields change)', async () => {
    const res = await putProfile({ age: 31 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown };
    const profile = profileSchema.parse(body.data);
    expect(profile.age).toBe(31);
    expect(profile.heightCm).toBe(165); // unchanged from previous test
  });
});
