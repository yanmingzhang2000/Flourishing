/**
 * Workout session service — the follow-along (跟练) closed loop.
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §2): joint-discomfort handling is fully
 * deterministic and rule-driven (training-domain/safety). No LLM decides
 * whether it is safe to continue:
 *   1. stop the reported exercise (skipped + reason + discomfort record)
 *   2. re-verify remaining pending exercises against the new tags (SAFE-05a)
 *   3. offer safe alternatives (SAFE-05b) + severity-based rest advice
 *   4. suggest profile limitation update — NEVER auto-written (user must
 *      confirm via PUT /api/users/me/profile)
 *
 * A blocked exercise can never be completed (409 'safety_blocked'): the
 * hard block lives here in the service layer, not in the UI.
 */

import { randomUUID } from 'node:crypto';
import {
  DEFAULT_AVAILABLE_EQUIPMENT,
  planDaySchema,
  type CompleteSessionInput,
  type CompleteSessionResponse,
  type CreateSessionInput,
  type Exercise,
  type ExerciseSnapshot,
  type JointDiscomfortInput,
  type JointDiscomfortResponse,
  type SessionExercise,
  type SessionExerciseActionInput,
  type WorkoutSession,
} from '@flourish/contracts';
import { exercises as exercisesDomain, safety as safetyDomain } from '@flourish/training-domain';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { trainingRecords, userProfiles, weeklyPlans, workoutSessions } from '../../db/schema';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors';
import { loadExerciseLibrary } from '../exercises';

type SessionRow = typeof workoutSessions.$inferSelect;

/** Deterministic severity -> guidance table (PRODUCT_LOGIC 7.2 step 4). */
const REST_ADVICE: Record<JointDiscomfortInput['severity'], string> = {
  mild: '轻微不适：暂停该动作并放松拉伸后观察；若持续不适请降低强度。',
  moderate: '中度不适：建议停止本次训练中的相关动作，休息 1-2 天观察，必要时就医。',
  severe: '强烈不适：立即停止训练并尽快就医，恢复前不要继续相关动作。',
};

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
}

function toSessionContract(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.userId,
    weekPlanId: row.weekPlanId,
    date: row.date,
    status: row.status as WorkoutSession['status'],
    exercises: row.exercises,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

/** Load session and enforce ownership (404 unknown, 403 someone else's). */
function loadOwnedSession(userId: string, sessionId: string): SessionRow {
  const db = getDb();
  const row = db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .get();
  if (!row) throw new NotFoundError('Workout session not found');
  if (row.userId !== userId) {
    throw new ForbiddenError('You do not own this workout session');
  }
  return row;
}

function saveSession(row: SessionRow): WorkoutSession {
  const db = getDb();
  db.update(workoutSessions)
    .set({
      exercises: row.exercises,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      updatedAt: nowMs(),
    })
    .where(eq(workoutSessions.id, row.id))
    .run();
  return toSessionContract(row);
}

function getAvailableEquipment(userId: string): string[] {
  const db = getDb();
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();
  return profile?.availableEquipment ?? [...DEFAULT_AVAILABLE_EQUIPMENT];
}

function getProfileInjuries(userId: string): string[] {
  const db = getDb();
  const profile = db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();
  return profile?.injuries ?? [];
}

function findLibraryExercise(
  library: { exercises: Exercise[] },
  exerciseId: string,
): Exercise | undefined {
  return exercisesDomain.findById(library.exercises, exerciseId);
}

/**
 * Start (or idempotently return) the session for one planned day.
 * Requires the plan to belong to the caller (04-SAFETY §4 anti-hijack).
 */
export function startSession(
  userId: string,
  input: CreateSessionInput,
): { session: WorkoutSession; created: boolean } {
  const db = getDb();

  const planRow = db
    .select()
    .from(weeklyPlans)
    .where(eq(weeklyPlans.id, input.weekPlanId))
    .get();
  if (!planRow) throw new NotFoundError('Training plan not found');
  if (planRow.userId !== userId) {
    throw new ForbiddenError('You do not own this training plan');
  }

  const daysParsed = planDaySchema.array().safeParse(planRow.days);
  if (!daysParsed.success) {
    throw new AppError(500, 'plan_corrupt', 'Stored plan days failed contract validation');
  }
  const day = daysParsed.data.find((d) => d.date === input.date);
  if (!day) throw new NotFoundError('Training day not found in this plan');

  // Idempotent: refresh/retry returns the existing session for this plan-day.
  const existing = db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.weekPlanId, input.weekPlanId),
        eq(workoutSessions.date, input.date),
      ),
    )
    .get();
  if (existing) return { session: toSessionContract(existing), created: false };

  const exercises: SessionExercise[] = day.exercises.map((exerciseSnapshot) => ({
    exerciseSnapshot,
    status: 'pending',
    reason: null,
    discomfort: null,
  }));

  const id = randomUUID();
  const timestamp = nowMs();
  try {
    db.insert(workoutSessions)
      .values({
        id,
        userId,
        weekPlanId: input.weekPlanId,
        date: input.date,
        status: 'in_progress',
        exercises,
        startedAt: nowIso(),
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Lost a create race -> return the winner's row.
      const winner = db
        .select()
        .from(workoutSessions)
        .where(
          and(
            eq(workoutSessions.userId, userId),
            eq(workoutSessions.weekPlanId, input.weekPlanId),
            eq(workoutSessions.date, input.date),
          ),
        )
        .get();
      if (winner) return { session: toSessionContract(winner), created: false };
    }
    throw err;
  }

  const row = db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).get();
  if (!row) throw new Error('Session missing right after insert');
  return { session: toSessionContract(row), created: true };
}

export function getSession(userId: string, sessionId: string): WorkoutSession {
  return toSessionContract(loadOwnedSession(userId, sessionId));
}

/**
 * Record a per-exercise action (complete / skip).
 *
 * Transition rules (deterministic):
 * - pending -> completed | skipped
 * - blocked -> complete = 409 safety_blocked (HARD BLOCK, SAFE-05);
 *             skip = idempotent no-op (acknowledged)
 * - terminal states are idempotent on repeat of the same action;
 *   conflicting transitions are 409.
 */
export function recordExerciseAction(
  userId: string,
  sessionId: string,
  exerciseId: string,
  input: SessionExerciseActionInput,
): WorkoutSession {
  const row = loadOwnedSession(userId, sessionId);
  if (row.status !== 'in_progress') {
    throw new ConflictError('Workout session is not active');
  }

  const items = row.exercises;
  const targetIdx = items.findIndex((i) => i.exerciseSnapshot.exerciseId === exerciseId);
  if (targetIdx === -1) {
    throw new NotFoundError('Exercise not part of this session');
  }
  const item = items[targetIdx];
  if (!item) {
    throw new NotFoundError('Exercise not part of this session');
  }

  if (input.action === 'complete') {
    if (item.status === 'blocked') {
      // 04-SAFETY §2: the rule engine excluded this movement — a client
      // (or AI) can never flip it back to completed.
      throw new ConflictError('Exercise blocked by safety rules and cannot be completed');
    }
    if (item.status === 'completed') return toSessionContract(row); // idempotent
    if (item.status === 'skipped') {
      throw new ConflictError('Exercise was skipped and cannot be completed');
    }
    items[targetIdx] = { ...item, status: 'completed', reason: null };
  } else {
    if (item.status === 'completed') {
      throw new ConflictError('Exercise already completed and cannot be skipped');
    }
    if (item.status === 'skipped' || item.status === 'blocked') {
      return toSessionContract(row); // idempotent acknowledge
    }
    items[targetIdx] = {
      ...item,
      status: 'skipped',
      reason: input.reason ?? '用户跳过',
    };
  }

  row.exercises = items;
  return saveSession(row);
}

/**
 * SAFE-05: report joint discomfort during a session.
 *
 * Returns the updated session (reported exercise stopped, remaining
 * pending exercises re-verified and blocked where contraindicated),
 * plus safe alternatives and rest guidance.
 */
export function reportJointDiscomfort(
  userId: string,
  sessionId: string,
  input: JointDiscomfortInput,
): JointDiscomfortResponse {
  // Controlled vocabulary check FIRST: bodyArea must map deterministically
  // to contraindication tags (unknown area -> cannot verify -> 400).
  // hasOwnProperty (not `in`): prototype keys like 'constructor' must not pass.
  if (!Object.prototype.hasOwnProperty.call(safetyDomain.INJURY_OPTION_TAG_MAP, input.bodyArea)) {
    throw new AppError(
      400,
      'invalid_body_area',
      `bodyArea must be one of: ${Object.keys(safetyDomain.INJURY_OPTION_TAG_MAP).join(', ')}`,
    );
  }

  const row = loadOwnedSession(userId, sessionId);
  if (row.status !== 'in_progress') {
    throw new ConflictError('Workout session is not active');
  }

  const library = loadExerciseLibrary();
  const items = row.exercises;
  const targetIdx = items.findIndex((i) => i.exerciseSnapshot.exerciseId === input.exerciseId);
  if (targetIdx === -1) throw new NotFoundError('Exercise not part of this session');

  const tags = safetyDomain.mapInjuryOptionsToTags([input.bodyArea]);
  if (tags.length === 0) {
    // Defensive: vocabulary key exists but maps to no tags — treat as
    // invalid input rather than silently skipping re-verification.
    throw new AppError(400, 'invalid_body_area', 'bodyArea does not map to safety tags');
  }

  // Step 1: stop the reported exercise (skip + discomfort + reason).
  const target = items[targetIdx];
  if (!target) throw new NotFoundError('Exercise not part of this session');
  if (target.status === 'pending' || target.status === 'completed') {
    items[targetIdx] = {
      ...target,
      status: 'skipped',
      reason: `关节不适（${input.bodyArea}·${input.severity}），已停止该动作`,
      discomfort: input,
    };
  }
  // already skipped/blocked -> leave as-is (idempotent re-report)

  // Step 2: SAFE-05a — re-verify remaining pending exercises.
  const newlyBlocked: JointDiscomfortResponse['newlyBlocked'] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || item.status !== 'pending') continue;

    const libExercise = findLibraryExercise(library, item.exerciseSnapshot.exerciseId);
    if (!libExercise) {
      // Fail-safe: exercise not found in library -> cannot verify -> block.
      items[i] = {
        ...item,
        status: 'blocked',
        reason: '安全重校验：动作库中无法核验，已按最严格策略阻断',
      };
      newlyBlocked.push({
        exerciseId: item.exerciseSnapshot.exerciseId,
        name: item.exerciseSnapshot.name,
        reasonTags: ['unverified'],
      });
      continue;
    }

    const matched = libExercise.contraindications.filter((t) => tags.includes(t));
    if (matched.length > 0) {
      items[i] = {
        ...item,
        status: 'blocked',
        reason: `安全重校验：命中禁忌 ${matched.join(', ')}`,
      };
      newlyBlocked.push({
        exerciseId: item.exerciseSnapshot.exerciseId,
        name: item.exerciseSnapshot.name,
        reasonTags: matched,
      });
    }
  }

  // Step 3: SAFE-05b — safe alternatives for the reported + blocked items.
  const availableEquipment = getAvailableEquipment(userId);
  const blockedIndices = [
    ...new Set([
      targetIdx,
      ...items
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.status === 'blocked')
        .map(({ idx }) => idx),
    ]),
  ];
  const sessionIds = new Set(items.map((it) => it.exerciseSnapshot.exerciseId));
  const excludedIds = new Set(newlyBlocked.map((b) => b.exerciseId));

  const alternatives: JointDiscomfortResponse['alternatives'] = [];
  const usedReplacementIds = new Set<string>();
  for (const idx of blockedIndices) {
    const item = items[idx];
    if (!item) continue;
    const original = findLibraryExercise(library, item.exerciseSnapshot.exerciseId);
    if (!original) continue;

    const replacement = findReplacement(
      library,
      original,
      tags,
      availableEquipment,
      new Set([...sessionIds, ...excludedIds, ...usedReplacementIds, original.exerciseId]),
    );
    if (!replacement) continue;
    usedReplacementIds.add(replacement.exerciseId);
    alternatives.push({
      forExerciseId: original.exerciseId,
      replacement: buildReplacementSnapshot(
        item.exerciseSnapshot,
        replacement,
        library.libraryVersion,
      ),
    });
  }

  row.exercises = items;
  const session = saveSession(row);

  const response: JointDiscomfortResponse = {
    session,
    reportedExerciseId: input.exerciseId,
    newlyBlocked,
    alternatives,
    restAdvice: REST_ADVICE[input.severity],
    suggestedInjuryOptions: [...new Set([input.bodyArea, ...getProfileInjuries(userId)])],
  };
  return response;
}

/**
 * Deterministic replacement picker (SAFE-05b):
 *   1. curated alternativeExerciseIds first (library field is currently
 *      empty everywhere — kept for forward compatibility)
 *   2. same category + shares a target project + equipment available
 *   3. fallback: same category + equipment available (still never
 *      contraindicated — exclusion always applies)
 * Candidates excluded by the new tags or already in this session are
 * never chosen.
 */
function findReplacement(
  library: { exercises: Exercise[] },
  original: Exercise,
  tags: string[],
  availableEquipment: string[],
  disallowedIds: Set<string>,
): Exercise | undefined {
  const isSafe = (candidate: Exercise): boolean => {
    if (disallowedIds.has(candidate.exerciseId)) return false;
    if (candidate.contraindications.some((t) => tags.includes(t))) return false;
    return true;
  };
  const byEquipment = (candidates: Exercise[]): Exercise[] =>
    exercisesDomain.filterByEquipment(candidates, availableEquipment);

  // 1. curated alternatives
  for (const altId of original.alternativeExerciseIds) {
    const candidate = library.exercises.find((e) => e.exerciseId === altId);
    if (candidate && isSafe(candidate) && byEquipment([candidate]).length > 0) {
      return candidate;
    }
  }

  // 2. same category + shared target project
  const sameCategory = library.exercises.filter((e) => e.category === original.category);
  const sameProject = sameCategory.filter((e) =>
    e.targetProjects.some((p) => original.targetProjects.includes(p)),
  );
  const tier2 = byEquipment(sameProject).find(isSafe);
  if (tier2) return tier2;

  // 3. fallback: same category only
  return byEquipment(sameCategory).find(isSafe);
}

/** Build a display-ready snapshot for a replacement exercise (deterministic). */
function buildReplacementSnapshot(
  original: ExerciseSnapshot,
  replacement: Exercise,
  libraryVersion: string,
): ExerciseSnapshot {
  let durationSeconds: number;
  if (original.reps) {
    const repsNum = Number(original.reps.split('-')[0]) || 10;
    durationSeconds = (repsNum * 2 + replacement.restSeconds) * original.sets;
  } else if (original.durationSeconds) {
    durationSeconds = original.durationSeconds;
  } else {
    durationSeconds = (30 + replacement.restSeconds) * original.sets;
  }

  return {
    exerciseId: replacement.exerciseId,
    name: replacement.name,
    sets: original.sets,
    reps: original.reps,
    durationSeconds: Math.max(1, durationSeconds),
    restSeconds: replacement.restSeconds,
    difficulty: replacement.difficulty,
    warning: replacement.warning,
    libraryVersion,
  };
}

/**
 * Complete a session: persist the training record (feedback included)
 * exactly once per plan-day — repeat calls return the same record
 * (05-ACCEPTANCE §1 数据一致性: 不因重复提交丢失或重复).
 */
export function completeSession(
  userId: string,
  sessionId: string,
  input: CompleteSessionInput,
): CompleteSessionResponse {
  const db = getDb();
  const row = loadOwnedSession(userId, sessionId);

  const existingRecord = () =>
    db
      .select()
      .from(trainingRecords)
      .where(
        and(
          eq(trainingRecords.userId, userId),
          eq(trainingRecords.weekPlanId, row.weekPlanId),
          eq(trainingRecords.date, row.date),
        ),
      )
      .get();

  if (row.status === 'completed') {
    const record = existingRecord();
    if (record) return { session: toSessionContract(row), recordId: record.id };
    // Completed session without a record (legacy) -> backfill below.
  }
  if (row.status === 'aborted') {
    throw new ConflictError('Aborted session cannot be completed');
  }

  row.status = 'completed';
  row.completedAt = nowIso();
  const session = saveSession(row);

  const existing = existingRecord();
  let recordId: string;
  if (existing) {
    recordId = existing.id;
    db.update(trainingRecords)
      .set({
        completed: true,
        durationMinutes: input.durationMinutes ?? existing.durationMinutes,
        feedback: input.feedback !== undefined ? input.feedback : existing.feedback,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      })
      .where(eq(trainingRecords.id, existing.id))
      .run();
  } else {
    recordId = randomUUID();
    db.insert(trainingRecords)
      .values({
        id: recordId,
        userId,
        weekPlanId: row.weekPlanId,
        date: row.date,
        completed: true,
        durationMinutes: input.durationMinutes ?? null,
        feedback: input.feedback ?? null,
        notes: input.notes ?? null,
        createdAt: nowMs(),
      })
      .run();
  }

  return { session, recordId };
}

/** Abort the session (the "end this session" option in 04-SAFETY §2). */
export function abortSession(userId: string, sessionId: string): WorkoutSession {
  const row = loadOwnedSession(userId, sessionId);
  if (row.status === 'completed') {
    throw new ConflictError('Completed session cannot be aborted');
  }
  if (row.status === 'aborted') return toSessionContract(row); // idempotent

  row.status = 'aborted';
  row.completedAt = nowIso();
  const db = getDb();
  db.update(workoutSessions)
    .set({ status: row.status, completedAt: row.completedAt, updatedAt: nowMs() })
    .where(eq(workoutSessions.id, row.id))
    .run();
  return toSessionContract(row);
}
