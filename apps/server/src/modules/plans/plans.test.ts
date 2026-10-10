import { todayPlanResponseSchema, generatePlanResponseSchema } from '@flourish/contracts';
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

beforeAll(async () => {
  process.env['DATABASE_PATH'] = tmpDb;
  ({ runMigrations } = await import('../../db/migrate'));
  ({ seedDemoData } = await import('../../db/seed'));
  ({ closeDb } = await import('../../db'));
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

async function fetchToday() {
  const res = await fetch(`${baseUrl}/api/plans/today`);
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
  it('returns empty payload before seeding', async () => {
    const data = await fetchToday();
    expect(data.plan).toBeNull();
    expect(data.today).toBeNull();
    expect(data.weekProgress).toBeNull();
  });

  it('returns seeded plan with consistent week progress after seeding', async () => {
    await seedDemoData();
    const data = await fetchToday();

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
  it('generates a plan for the seeded demo user (profile already exists from seedDemoData)', async () => {
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  });

  it('rejects invalid input (missing targetProjects)', async () => {
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: '2026-01-05',
        targetProjects: ['full_body_basic'],
        trainingDays: ['notaday'],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('auto-adjusts consecutive training days per the 48h recovery rule (SAFE-02a)', async () => {
    const res = await fetch(`${baseUrl}/api/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
});
