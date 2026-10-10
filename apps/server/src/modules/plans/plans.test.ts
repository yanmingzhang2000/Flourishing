import {
  authSessionSchema,
  todayPlanResponseSchema,
  generatePlanResponseSchema,
  workoutSessionSchema,
} from '@flourish/contracts';
import { safety } from '@flourish/training-domain';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmpDb = path.join(os.tmpdir(), `flourish-plans-test-${process.pid}-${Date.now()}.db`);

let server: Server;
let baseUrl: string;
let runMigrations: (typeof import('../../db/migrate'))['runMigrations'];
let seedDemoData: (typeof import('../../db/seed'))['seedDemoData'];
let closeDb: (typeof import('../../db'))['closeDb'];
let loadLibrary: (typeof import('../exercises'))['loadExerciseLibrary'];

let uniqueCounter = 0;

beforeAll(async () => {
  process.env['DATABASE_PATH'] = tmpDb;
  ({ runMigrations } = await import('../../db/migrate'));
  ({ seedDemoData } = await import('../../db/seed'));
  ({ closeDb } = await import('../../db'));
  ({ loadExerciseLibrary: loadLibrary } = await import('../exercises'));
  const { createApp } = await import('../../app');

  runMigrations();
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

/** Register a fresh user (gets default profile) and return its bearer token. */
async function registerUser(): Promise<string> {
  uniqueCounter += 1;
  const email = `plans-${process.pid}-${Date.now()}-${uniqueCounter}@flourish.local`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password-123' }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { data: unknown };
  return authSessionSchema.parse(body.data).token;
}

/** Login as the seeded demo user (seedDemoData must have run first). */
async function loginDemo(): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@flourish.local', password: 'demo1234' }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: unknown };
  return authSessionSchema.parse(body.data).token;
}

async function fetchToday(token?: string) {
  const res = await fetch(`${baseUrl}/api/plans/today`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { success: boolean; data: unknown };
  expect(body.success).toBe(true);
  return todayPlanResponseSchema.parse(body.data);
}

function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

describe('GET /api/plans/today', () => {
  it('returns empty payload for guests (no session)', async () => {
    const data = await fetchToday();
    expect(data.plan).toBeNull();
    expect(data.today).toBeNull();
    expect(data.weekProgress).toBeNull();
  });

  it('returns 401 for an invalid token (never downgrades to guest data)', async () => {
    const res = await fetch(`${baseUrl}/api/plans/today`, {
      headers: { Authorization: 'Bearer garbage-token' },
    });
    expect(res.status).toBe(401);
  });

  it('returns seeded plan with consistent week progress for the demo session', async () => {
    await seedDemoData();
    const token = await loginDemo();
    const data = await fetchToday(token);

    expect(data.plan).not.toBeNull();
    expect(data.today).not.toBeNull();
    expect(data.weekProgress).not.toBeNull();

    expect(data.today?.date).toBe(localToday());
    expect((data.today?.exercises.length ?? 0)).toBeGreaterThanOrEqual(1);
    expect(data.today?.recommendReason).toBeTruthy();

    const progress = data.weekProgress;
    expect(progress?.scheduled).toBe(data.plan?.days.length);
    expect(progress?.completed).toBeLessThanOrEqual(progress?.scheduled ?? 0);
    expect(progress?.days.length).toBe(progress?.scheduled);
    expect(progress?.days.some((day) => day.isToday)).toBe(true);
  });
});

describe('POST /api/plans/generate', () => {
  it('requires authentication (401 without token)', async () => {
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: '2026-01-05',
        targetProjects: ['full_body_basic'],
        trainingDays: ['monday'],
      }),
    });
    expect(res.status).toBe(401);
  });

  it('generates a plan for the authenticated user (profile from registration)', async () => {
    const token = await registerUser();
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: '2026-01-05', // Monday
        targetProjects: ['full_body_basic'],
        trainingDays: ['monday', 'wednesday', 'friday'],
      }),
    });

    if (res.status !== 201) {
      const errorBody = await res.text();
      console.error(`Expected 201, got ${res.status}. Response: ${errorBody}`);
    }

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);

    const data = generatePlanResponseSchema.parse(body.data);
    expect(data.plan.days.length).toBeGreaterThan(0);
    expect(data.plan.status).toBe('active');
    expect(data.plan.startDate).toBe('2026-01-05');

    for (const day of data.plan.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      // full_body_basic (25min) + 5min warmup = 30min
      expect(day.estimatedDurationMinutes).toBe(30);
    }

    // Plan belongs to the requesting user (not a shared demo account)
    expect(data.plan.userId.length).toBeGreaterThan(0);
  });

  it('rejects invalid input (missing targetProjects)', async () => {
    const token = await registerUser();
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: '2026-01-05',
        trainingDays: ['monday'],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error?: { code: string } };
    expect(body.success).toBe(false);
  });

  it('rejects invalid trainingDays enum value', async () => {
    const token = await registerUser();
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: '2026-01-05',
        targetProjects: ['full_body_basic'],
        trainingDays: ['notaday'],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('auto-adjusts consecutive training days per the 48h recovery rule (SAFE-02a)', async () => {
    const token = await registerUser();
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: '2026-01-05', // Monday
        targetProjects: ['full_body_basic'],
        trainingDays: ['monday', 'tuesday'], // consecutive — Tuesday should be demoted
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const data = generatePlanResponseSchema.parse(body.data);

    // Only Monday should have an actual training day in the plan
    const dates = data.plan.days.map((d) => d.date);
    expect(dates).toContain('2026-01-05');
    expect(dates).not.toContain('2026-01-06');
  });

  it('SAFE-01 regression: profile injury option "膝" actually excludes knee-contraindicated exercises from the generated plan', async () => {
    const token = await registerUser();

    // Set the user-facing injury option (膝) on the profile
    const putRes = await fetch(`${baseUrl}/api/users/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ injuries: ['膝'] }),
    });
    expect(putRes.status).toBe(200);

    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: '2026-01-05',
        targetProjects: ['full_body_basic'],
        trainingDays: ['monday', 'wednesday', 'friday'],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: unknown };
    const data = generatePlanResponseSchema.parse(body.data);
    expect(data.plan.days.length).toBeGreaterThan(0);

    // Oracle: knee option maps to these contraindication tags
    const kneeTags = safety.mapInjuryOptionsToTags(['膝']);
    expect(kneeTags.length).toBeGreaterThan(0);

    const library = loadLibrary();
    const libById = new Map(library.exercises.map((e) => [e.exerciseId, e]));

    for (const day of data.plan.days) {
      for (const exercise of day.exercises) {
        const lib = libById.get(exercise.exerciseId);
        expect(lib, `exercise ${exercise.exerciseId} must exist in library`).toBeDefined();
        // The bug this guards against: profile stored '膝' but the generator
        // filtered on internal tags without mapping, so nothing was excluded.
        const hits = lib!.contraindications.filter((t) => kneeTags.includes(t));
        expect(
          hits,
          `${exercise.exerciseId} (${exercise.name}) must not be knee-contraindicated, got tags ${JSON.stringify(hits)}`,
        ).toEqual([]);
      }
    }
  });

  it('E2E #3: feedback "太难" → next plan adjusts a single variable with an explanation', async () => {
    const token = await registerUser();
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Beginner tier so the ladder expectations are fixed (sets 3, reps 8-12)
    const putProfile = await fetch(`${baseUrl}/api/users/me/profile`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ experienceLevel: 'beginner' }),
    });
    expect(putProfile.status).toBe(200);

    const generate = async () => {
      const res = await fetch(`${baseUrl}/api/plans/generate`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          startDate: localToday(), // must cover today so /plans/today sees it
          targetProjects: ['full_body_basic'],
          trainingDays: ['monday', 'wednesday', 'friday'],
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { success: boolean; data: unknown };
      return generatePlanResponseSchema.parse(body.data).plan;
    };

    // 1) Baseline: no feedback yet → no adjustment, experience baseline volume
    const baseline = await generate();
    expect(baseline.adjustment).toBeUndefined();
    const baselineFirst = baseline.days[0]!.exercises[0]!;
    expect(baselineFirst.reps).toBe('8-12');
    expect(baselineFirst.sets).toBe(3);

    // 2) Complete a real session with directional feedback (E2E #3 input)
    const startRes = await fetch(`${baseUrl}/api/workouts/sessions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ weekPlanId: baseline.id, date: baseline.days[0]!.date }),
    });
    expect(startRes.status).toBe(201);
    const session = workoutSessionSchema.parse(((await startRes.json()) as { data: unknown }).data);

    const completeRes = await fetch(
      `${baseUrl}/api/workouts/sessions/${session.id}/complete`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ durationMinutes: 30, feedback: 'too_hard' }),
      },
    );
    expect(completeRes.status).toBe(200);

    // 3) Regenerate → the rule engine adjusts exactly one variable, explainably
    const adjusted = await generate();
    expect(adjusted.adjustment).toBeDefined();
    expect(adjusted.adjustment!.feedback).toBe('too_hard');
    expect(adjusted.adjustment!.variable).toBe('reps');
    expect(adjusted.adjustment!.explanation).toContain('太难');

    const adjustedFirst = adjusted.days[0]!.exercises[0]!;
    expect(adjustedFirst.reps).toBe('6-10'); // 8-12 − 2 (SAFE-03c priority 1)
    expect(adjustedFirst.sets).toBe(3); // untouched — single variable rule
    expect(adjusted.days.length).toBe(baseline.days.length);

    // 4) The explanation is visible where the user looks (/plans/today)
    const today = await fetchToday(token);
    expect(today.plan?.id).toBe(adjusted.id); // newest generation wins
    expect(today.plan?.adjustment?.explanation).toContain('太难');
    expect(today.plan?.adjustment?.variable).toBe('reps');

    // 5) A user without any feedback never gets a phantom adjustment
    const otherToken = await registerUser();
    const otherRes = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify({
        startDate: '2026-01-05',
        targetProjects: ['full_body_basic'],
        trainingDays: ['monday'],
      }),
    });
    expect(otherRes.status).toBe(201);
    const otherPlan = generatePlanResponseSchema.parse(
      ((await otherRes.json()) as { data: unknown }).data,
    ).plan;
    expect(otherPlan.adjustment).toBeUndefined();
  });
});
