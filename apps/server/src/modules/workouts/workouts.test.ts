/**
 * Follow-along closed loop tests (跟练闭环) — includes the mandatory
 * SAFE-05 joint-discomfort scenarios (04-SAFETY §2, 05-ACCEPTANCE §3.4):
 * hard block, re-verification, safe alternatives, rest guidance,
 * profile-update suggestion that is NEVER auto-written.
 *
 * The SAFE-05 assertions use an oracle: expected blocks are recomputed
 * from the canonical library + the controlled injury vocabulary, so the
 * test verifies the rule itself, not a hardcoded expectation.
 */

import {
  authSessionSchema,
  completeSessionResponseSchema,
  generatePlanResponseSchema,
  jointDiscomfortResponseSchema,
  todayPlanResponseSchema,
  trainingRecordSchema,
  workoutSessionSchema,
} from '@flourish/contracts';
import { safety } from '@flourish/training-domain';
import type { Server } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tmpDb = path.join(os.tmpdir(), `flourish-workouts-test-${process.pid}-${Date.now()}.db`);

let server: Server;
let baseUrl: string;
let closeDb: (typeof import('../../db'))['closeDb'];
let runMigrationsFn: (typeof import('../../db/migrate'))['runMigrations'];
let loadLibrary: (typeof import('../exercises'))['loadExerciseLibrary'];

let tokenA = ''; // main user (owns the plan/sessions)
let tokenB = ''; // second user (ownership attack scenarios)
let planId = '';
let planDates: string[] = []; // training dates from the generated plan (>= 3)

const DEFAULT_EQUIPMENT = ['bodyweight', 'mat_6mm'];

interface ApiResult {
  status: number;
  json: () => Promise<unknown>;
}

async function api(
  method: string,
  urlPath: string,
  token?: string,
  body?: unknown,
): Promise<ApiResult> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, json: () => res.json() };
}

/** Extract `data` from a { success, data } envelope (single json() call). */
async function getData(res: ApiResult): Promise<unknown> {
  const body = (await res.json()) as { data: unknown };
  return body.data;
}

async function getSession(token: string, sessionId: string) {
  const res = await api('GET', `/api/workouts/sessions/${sessionId}`, token);
  expect(res.status).toBe(200);
  return workoutSessionSchema.parse(await getData(res));
}

async function registerUser(label: string): Promise<string> {
  const res = await api('POST', '/api/auth/register', undefined, {
    email: `${label}-${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@flourish.local`,
    password: 'password-123',
  });
  expect(res.status).toBe(201);
  return authSessionSchema.parse(await getData(res)).token;
}

async function startSession(token: string, date: string, expectStatus = 201): Promise<ApiResult> {
  const res = await api('POST', '/api/workouts/sessions', token, { weekPlanId: planId, date });
  expect(res.status).toBe(expectStatus);
  return res;
}

beforeAll(async () => {
  process.env['DATABASE_PATH'] = tmpDb;
  ({ runMigrations: runMigrationsFn } = await import('../../db/migrate'));
  runMigrationsFn();
  ({ closeDb } = await import('../../db'));
  ({ loadExerciseLibrary: loadLibrary } = await import('../exercises'));
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

  tokenA = await registerUser('workout-a');
  tokenB = await registerUser('workout-b');

  // Generate a 3-day plan (mon/wed/fri) starting today, so /plans/today
  // (which only returns plans whose week contains today) sees it.
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const gen = await api('POST', '/api/plans/generate', tokenA, {
    startDate: todayIso,
    targetProjects: ['full_body_basic'],
    trainingDays: ['monday', 'wednesday', 'friday'],
  });
  expect(gen.status).toBe(201);
  const plan = generatePlanResponseSchema.parse(await getData(gen));
  planId = plan.plan.id;
  planDates = plan.plan.days.map((d) => d.date);
  expect(planDates.length).toBeGreaterThanOrEqual(3);
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  closeDb();
  fs.rmSync(tmpDb, { force: true });
  fs.rmSync(`${tmpDb}-wal`, { force: true });
  fs.rmSync(`${tmpDb}-shm`, { force: true });
});

describe('session lifecycle', () => {
  it('requires authentication', async () => {
    const res = await api('POST', '/api/workouts/sessions');
    expect(res.status).toBe(401);
  });

  it('starts a session with all exercises pending', async () => {
    const res = await startSession(tokenA, planDates[0]!);
    const session = workoutSessionSchema.parse(await getData(res));
    expect(session.status).toBe('in_progress');
    expect(session.exercises.length).toBeGreaterThanOrEqual(3);
    expect(session.exercises.every((e) => e.status === 'pending')).toBe(true);
    expect(session.startedAt).not.toBeNull();
  });

  it('is idempotent: second start returns the same session (refresh-safe)', async () => {
    const first = workoutSessionSchema.parse(await getData(await startSession(tokenA, planDates[0]!, 200)));
    const second = workoutSessionSchema.parse(await getData(await startSession(tokenA, planDates[0]!, 200)));
    expect(second.id).toBe(first.id);
  });

  it('rejects starting a session for a day not in the plan (404)', async () => {
    const res = await api('POST', '/api/workouts/sessions', tokenA, {
      weekPlanId: planId,
      date: '2026-01-06', // Tuesday — demoted by 48h rule, not in plan
    });
    expect(res.status).toBe(404);
  });

  it("rejects using another user's plan (403, anti-hijack)", async () => {
    const res = await api('POST', '/api/workouts/sessions', tokenB, {
      weekPlanId: planId,
      date: planDates[0]!,
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown plan and 403/404 for foreign sessions', async () => {
    const unknown = await api('POST', '/api/workouts/sessions', tokenA, {
      weekPlanId: '00000000-0000-4000-8000-00000000dead',
      date: '2026-01-05',
    });
    expect(unknown.status).toBe(404);

    const session = workoutSessionSchema.parse(
      await getData(await startSession(tokenA, planDates[0]!, 200)),
    );

    const foreign = await api('GET', `/api/workouts/sessions/${session.id}`, tokenB);
    expect(foreign.status).toBe(403);

    const missing = await api(
      'GET',
      '/api/workouts/sessions/00000000-0000-4000-8000-00000000dead',
      tokenA,
    );
    expect(missing.status).toBe(404);
  });
});

describe('per-exercise actions', () => {
  let sessionId = '';
  let firstExerciseId = '';
  let secondExerciseId = '';

  beforeAll(async () => {
    const res = await startSession(tokenA, planDates[0]!, 200);
    const session = workoutSessionSchema.parse(await getData(res));
    sessionId = session.id;
    firstExerciseId = session.exercises[0]!.exerciseSnapshot.exerciseId;
    secondExerciseId = session.exercises[1]!.exerciseSnapshot.exerciseId;
  });

  it('completes an exercise and is idempotent on repeat', async () => {
    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${firstExerciseId}`,
      tokenA,
      { action: 'complete' },
    );
    expect(res.status).toBe(200);
    const session = workoutSessionSchema.parse(await getData(res));
    expect(
      session.exercises.find((e) => e.exerciseSnapshot.exerciseId === firstExerciseId)?.status,
    ).toBe('completed');

    const repeat = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${firstExerciseId}`,
      tokenA,
      { action: 'complete' },
    );
    expect(repeat.status).toBe(200);
    const again = workoutSessionSchema.parse(await getData(repeat));
    expect(
      again.exercises.find((e) => e.exerciseSnapshot.exerciseId === firstExerciseId)?.status,
    ).toBe('completed');
  });

  it('skips an exercise with a reason; cannot complete it afterward (409)', async () => {
    const skip = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${secondExerciseId}`,
      tokenA,
      { action: 'skip', reason: '今天状态不好' },
    );
    expect(skip.status).toBe(200);
    const session = workoutSessionSchema.parse(await getData(skip));
    const item = session.exercises.find(
      (e) => e.exerciseSnapshot.exerciseId === secondExerciseId,
    );
    expect(item?.status).toBe('skipped');
    expect(item?.reason).toBe('今天状态不好');

    const lateComplete = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${secondExerciseId}`,
      tokenA,
      { action: 'complete' },
    );
    expect(lateComplete.status).toBe(409);
  });

  it('returns 404 for an exercise not in this session', async () => {
    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/not-a-real-exercise`,
      tokenA,
      { action: 'complete' },
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when another user acts on this session', async () => {
    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${firstExerciseId}`,
      tokenB,
      { action: 'complete' },
    );
    expect(res.status).toBe(403);
  });
});

describe('SAFE-05 joint discomfort (hard block + re-verification)', () => {
  const sessionDatesIdx = 1;
  let sessionId = '';
  let library: ReturnType<typeof loadLibrary>;

  interface Scenario {
    bodyArea: string;
    tags: string[];
    reportedId: string;
    expectedBlockedIds: string[];
    expectedPendingIds: string[];
  }

  /**
   * Build an oracle scenario from actual session contents: pick the
   * vocabulary area matching the most remaining pending exercises
   * (preferring an area that leaves some pending unblocked, so both
   * outcomes are observable).
   */
  function chooseScenario(session: {
    exercises: { exerciseSnapshot: { exerciseId: string }; status: string }[];
  }): Scenario {
    const pending = session.exercises.filter((e) => e.status === 'pending');
    expect(pending.length).toBeGreaterThanOrEqual(2);

    const libById = new Map(library.exercises.map((e) => [e.exerciseId, e]));
    let best: Scenario | null = null;
    let bestScore = -1;

    for (const bodyArea of Object.keys(safety.INJURY_OPTION_TAG_MAP)) {
      const tags = safety.mapInjuryOptionsToTags([bodyArea]);
      const matches = pending.filter((p) => {
        const lib = libById.get(p.exerciseSnapshot.exerciseId);
        return !!lib && lib.contraindications.some((t) => tags.includes(t));
      });
      if (matches.length === 0) continue;

      const nonMatches = pending.filter((p) => !matches.includes(p));
      const score = matches.length * 10 + Math.min(nonMatches.length, 1) * 5;
      if (score <= bestScore) continue;
      bestScore = score;

      // Report on a pending exercise that is NOT itself contraindicated
      // when possible, so "reported" and "blocked" are observably distinct.
      const reported = nonMatches[0] ?? matches[0]!;
      best = {
        bodyArea,
        tags,
        reportedId: reported.exerciseSnapshot.exerciseId,
        expectedBlockedIds: pending
          .filter((p) => p !== reported && matches.includes(p))
          .map((p) => p.exerciseSnapshot.exerciseId),
        expectedPendingIds: pending
          .filter((p) => p !== reported && !matches.includes(p))
          .map((p) => p.exerciseSnapshot.exerciseId),
      };
    }

    if (!best) {
      throw new Error('Test setup: no vocabulary area matches any pending exercise');
    }
    return best;
  }

  beforeAll(async () => {
    library = loadLibrary();
    const res = await startSession(tokenA, planDates[sessionDatesIdx]!);
    const session = workoutSessionSchema.parse(await getData(res));
    sessionId = session.id;
  });

  it('validates bodyArea against the controlled vocabulary (400, incl. prototype keys)', async () => {
    const session = await getSession(tokenA, sessionId);
    const someId = session.exercises[0]!.exerciseSnapshot.exerciseId;

    for (const bad of ['脚', 'constructor', 'toString']) {
      const res = await api(
        'POST',
        `/api/workouts/sessions/${sessionId}/joint-discomfort`,
        tokenA,
        { exerciseId: someId, bodyArea: bad, severity: 'mild' },
      );
      expect(res.status, `bodyArea=${bad}`).toBe(400);
    }
  });

  it('stops the reported exercise, blocks exactly the contraindicated remainder, offers safe alternatives (SAFE-05/05a/05b)', async () => {
    const before = await getSession(tokenA, sessionId);
    const scenario = chooseScenario(before);

    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/joint-discomfort`,
      tokenA,
      { exerciseId: scenario.reportedId, bodyArea: scenario.bodyArea, severity: 'moderate' },
    );
    expect(res.status).toBe(200);
    const payload = jointDiscomfortResponseSchema.parse(await getData(res));

    // Reported exercise: stopped with discomfort + reason
    const reported = payload.session.exercises.find(
      (e) => e.exerciseSnapshot.exerciseId === scenario.reportedId,
    );
    expect(reported?.status).toBe('skipped');
    expect(reported?.discomfort?.bodyArea).toBe(scenario.bodyArea);
    expect(reported?.discomfort?.severity).toBe('moderate');
    expect(reported?.reason).toContain(scenario.bodyArea);

    // SAFE-05a: blocked set matches the oracle exactly
    const actualBlocked = payload.session.exercises
      .filter((e) => e.status === 'blocked')
      .map((e) => e.exerciseSnapshot.exerciseId)
      .sort();
    expect(actualBlocked).toEqual([...scenario.expectedBlockedIds].sort());
    expect(payload.newlyBlocked.map((b) => b.exerciseId).sort()).toEqual(
      [...scenario.expectedBlockedIds].sort(),
    );
    for (const blocked of payload.newlyBlocked) {
      expect(blocked.reasonTags.length).toBeGreaterThanOrEqual(1);
      expect(scenario.tags.some((t) => blocked.reasonTags.includes(t))).toBe(true);
    }

    // Non-matching exercises stay pending (nothing over-blocked)
    const actualPending = payload.session.exercises
      .filter((e) => e.status === 'pending')
      .map((e) => e.exerciseSnapshot.exerciseId)
      .sort();
    expect(actualPending).toEqual([...scenario.expectedPendingIds].sort());

    // SAFE-05b: alternatives exist for reported + blocked, each is safe
    expect(payload.alternatives.length).toBeGreaterThanOrEqual(1);
    const sessionIds = new Set(before.exercises.map((e) => e.exerciseSnapshot.exerciseId));
    const libById = new Map(library.exercises.map((e) => [e.exerciseId, e]));
    const originalCategory = new Map(
      before.exercises.map((e) => [
        e.exerciseSnapshot.exerciseId,
        libById.get(e.exerciseSnapshot.exerciseId)?.category,
      ]),
    );
    for (const alt of payload.alternatives) {
      // Never a duplicate of anything already in this session
      expect(sessionIds.has(alt.replacement.exerciseId)).toBe(false);
      const lib = libById.get(alt.replacement.exerciseId);
      expect(lib).toBeDefined();
      // Never contraindicated for the reported area
      expect(lib!.contraindications.some((t) => scenario.tags.includes(t))).toBe(false);
      // Executable with the user's available equipment
      expect(lib!.equipment.every((eq) => DEFAULT_EQUIPMENT.includes(eq))).toBe(true);
      // Keeps the category of the exercise it replaces
      expect(lib!.category).toBe(originalCategory.get(alt.forExerciseId));
    }

    // Deterministic rest guidance + profile update is only SUGGESTED
    expect(payload.restAdvice.length).toBeGreaterThan(0);
    expect(payload.suggestedInjuryOptions).toContain(scenario.bodyArea);
    // ...and the profile was NOT silently mutated:
    const me = await api('GET', '/api/auth/me', tokenA);
    const meBody = (await getData(me)) as { profile: { injuries: string[] } | null };
    expect(meBody.profile?.injuries ?? []).not.toContain(scenario.bodyArea);
  });

  it('HARD BLOCK: a blocked exercise can never be completed (409)', async () => {
    const current = await getSession(tokenA, sessionId);
    const blocked = current.exercises.find((e) => e.status === 'blocked');
    expect(blocked).toBeDefined(); // previous test must have blocked >= 1

    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${blocked!.exerciseSnapshot.exerciseId}`,
      tokenA,
      { action: 'complete' },
    );
    expect(res.status).toBe(409);

    // Status unchanged after the attempt
    const after = await getSession(tokenA, sessionId);
    const still = after.exercises.find(
      (e) => e.exerciseSnapshot.exerciseId === blocked!.exerciseSnapshot.exerciseId,
    );
    expect(still?.status).toBe('blocked');
  });

  it('re-reporting the same discomfort is idempotent (no state churn)', async () => {
    const before = await getSession(tokenA, sessionId);
    const skipped = before.exercises.find((e) => e.status === 'skipped' && e.discomfort);
    expect(skipped).toBeDefined();

    const res = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/joint-discomfort`,
      tokenA,
      {
        exerciseId: skipped!.discomfort!.exerciseId,
        bodyArea: skipped!.discomfort!.bodyArea,
        severity: skipped!.discomfort!.severity,
      },
    );
    expect(res.status).toBe(200);
    const payload = jointDiscomfortResponseSchema.parse(await getData(res));
    expect(payload.session.status).toBe(before.status);
    expect(
      payload.session.exercises.map((e) => `${e.exerciseSnapshot.exerciseId}:${e.status}`),
    ).toEqual(before.exercises.map((e) => `${e.exerciseSnapshot.exerciseId}:${e.status}`));
  });

  it('rejects discomfort reporting on a non-active session (409)', async () => {
    // Session for the third plan day, aborted first
    const start = await startSession(tokenA, planDates[2]!);
    const session = workoutSessionSchema.parse(await getData(start));
    const abort = await api('POST', `/api/workouts/sessions/${session.id}/abort`, tokenA);
    expect(abort.status).toBe(200);

    const res = await api(
      'POST',
      `/api/workouts/sessions/${session.id}/joint-discomfort`,
      tokenA,
      {
        exerciseId: session.exercises[0]!.exerciseSnapshot.exerciseId,
        bodyArea: '膝',
        severity: 'mild',
      },
    );
    expect(res.status).toBe(409);
  });
});

describe('session completion + training record persistence', () => {
  let sessionId = '';

  beforeAll(async () => {
    const res = await startSession(tokenA, planDates[0]!, 200);
    const session = workoutSessionSchema.parse(await getData(res));
    sessionId = session.id;
  });

  it('completes the session and persists feedback exactly once', async () => {
    const res = await api('POST', `/api/workouts/sessions/${sessionId}/complete`, tokenA, {
      durationMinutes: 30,
      feedback: 'too_hard',
      notes: '深蹲有点吃力',
    });
    expect(res.status).toBe(200);
    const payload = completeSessionResponseSchema.parse(await getData(res));
    expect(payload.session.status).toBe('completed');
    expect(payload.session.completedAt).not.toBeNull();

    // Repeat completion → same record (no duplicate, refresh-safe)
    const repeat = await api('POST', `/api/workouts/sessions/${sessionId}/complete`, tokenA, {
      durationMinutes: 30,
      feedback: 'too_hard',
    });
    expect(repeat.status).toBe(200);
    const again = completeSessionResponseSchema.parse(await getData(repeat));
    expect(again.recordId).toBe(payload.recordId);

    // Record is queryable with the feedback persisted (E2E #3 input)
    const records = await api('GET', '/api/records', tokenA);
    expect(records.status).toBe(200);
    const list = ((await getData(records)) as unknown[]).map((r) =>
      trainingRecordSchema.parse(r),
    );
    const mine = list.find((r) => r.id === payload.recordId);
    expect(mine).toBeDefined();
    expect(mine?.feedback).toBe('too_hard');
    expect(mine?.completed).toBe(true);
    expect(mine?.durationMinutes).toBe(30);
    expect(mine?.weekPlanId).toBe(planId);
  });

  it('shows up in weekly progress (GET /api/plans/today)', async () => {
    const res = await api('GET', '/api/plans/today', tokenA);
    expect(res.status).toBe(200);
    const data = todayPlanResponseSchema.parse(await getData(res));
    expect(data.weekProgress).not.toBeNull();
    const day = data.weekProgress!.days.find((d) => d.date === planDates[0]!);
    expect(day?.completed).toBe(true);
  });

  it('blocks further exercise actions and discomfort reports on a completed session (409)', async () => {
    const session = await getSession(tokenA, sessionId);
    const item = session.exercises[0]!;

    const action = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/exercises/${item.exerciseSnapshot.exerciseId}`,
      tokenA,
      { action: 'skip', reason: 'too late' },
    );
    expect(action.status).toBe(409);

    const discomfort = await api(
      'POST',
      `/api/workouts/sessions/${sessionId}/joint-discomfort`,
      tokenA,
      { exerciseId: item.exerciseSnapshot.exerciseId, bodyArea: '膝', severity: 'mild' },
    );
    expect(discomfort.status).toBe(409);

    const abort = await api('POST', `/api/workouts/sessions/${sessionId}/abort`, tokenA);
    expect(abort.status).toBe(409);
  });

  it("does not leak other users' records (scoped query)", async () => {
    const records = await api('GET', '/api/records', tokenB);
    expect(records.status).toBe(200);
    const list = (await getData(records)) as unknown[];
    expect(list.length).toBe(0);
  });
});
