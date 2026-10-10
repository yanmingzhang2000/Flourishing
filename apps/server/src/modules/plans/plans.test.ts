import { todayPlanResponseSchema } from '@flourish/contracts';
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
