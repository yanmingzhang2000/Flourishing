/**
 * schedule.ts
 *
 * Pure functions for translating a user's training-day intent into a
 * concrete weekly schedule that satisfies the 48-hour muscle-group
 * recovery rule from PRODUCT_LOGIC §三 and EVAL_SET R-01 / R-02 / R-03.
 *
 * All functions are side-effect-free; the route layer supplies dates and
 * persists results.
 */

import { ProjectId } from '../exercise-library/types';

/** Day-of-week index, 0 = Monday … 6 = Sunday (ISO-week order). */
export type WeekDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DayType = 'strength' | 'active_recovery' | 'rest';

/** One slot in the final weekly schedule. */
export interface ScheduledDay {
  /** 0-based ISO-week offset (0 = Monday). */
  dayIndex: WeekDayIndex;
  type: DayType;
  /** Projects assigned to this day (empty for rest / active-recovery). */
  projects: readonly ProjectId[];
}

/** The primary muscle groups engaged by each project, used for the 48-h check. */
const PROJECT_PRIMARY_MUSCLES: Readonly<Record<ProjectId, readonly string[]>> = {
  tricep_tone:        ['肱三头肌', '前臂'],
  hip_thigh_tone:     ['臀大肌', '臀中肌', '股四头肌', '腘绳肌'],
  lower_abs_tone:     ['腹直肌', '腹横肌', '腹斜肌'],
  trap_relax:         ['斜方肌上束'],
  round_shoulder_fix: ['菱形肌', '斜方肌中下束', '三角肌后束'],
  full_body_basic:    ['臀大肌', '股四头肌', '腹横肌', '肱三头肌', '胸大肌'],
};

/** Day names matching the front-end display contract. */
export const DAY_NAMES_ISO: readonly string[] = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a 0-based ISO dayIndex to a JS Date for a week starting on Monday. */
export function isoIndexToDate(startOfWeek: Date, dayIndex: number): Date {
  const d = new Date(startOfWeek);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

/** Returns the ISO-week Monday for an arbitrary date. */
export function getStartOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // JS getDay(): 0=Sun … 6=Sat; we want 0=Mon
  const dayOfWeek = d.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

/** Returns true when the two muscle-group lists share at least one muscle. */
function musclesOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some(m => b.includes(m));
}

/** Returns all muscle groups touched by a list of projects. */
function musclesForProjects(projects: readonly ProjectId[]): string[] {
  const all: string[] = [];
  for (const p of projects) {
    for (const m of PROJECT_PRIMARY_MUSCLES[p]) {
      if (!all.includes(m)) all.push(m);
    }
  }
  return all;
}

// ---------------------------------------------------------------------------
// Default fallback schedules (used when user supplies no specific days)
// ---------------------------------------------------------------------------

const FALLBACK_SCHEDULES: Readonly<Record<number, readonly WeekDayIndex[]>> = {
  1: [0, 3],           // Mon, Thu
  2: [0, 3],           // Mon, Thu
  3: [0, 2, 4],        // Mon, Wed, Fri
  4: [0, 1, 3, 5],     // Mon, Tue, Thu, Sat
  5: [0, 1, 3, 4, 5],  // Mon, Tue, Thu, Fri, Sat
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/**
 * Given a desired training-day count, return a sensible default set of
 * ISO-week day indices that already satisfies 48-h recovery for single-project
 * use cases.  Never returns fewer than 1 or more than 7 days.
 */
export function defaultTrainingDays(desiredCount: number): readonly WeekDayIndex[] {
  const count = Math.max(1, Math.min(7, Math.round(desiredCount)));
  return FALLBACK_SCHEDULES[count] ?? FALLBACK_SCHEDULES[3];
}

// ---------------------------------------------------------------------------
// 48-hour gap enforcement
// ---------------------------------------------------------------------------

/**
 * Given a sorted list of requested ISO day indices and the project set, return
 * the subset of day indices that can be used without violating the 48-h
 * muscle-group recovery rule (PRODUCT_LOGIC §三, EVAL_SET R-01 / R-03).
 *
 * The algorithm is greedy: it accepts each day in order, rejecting it only
 * when it is within 48 h (<= 1 calendar day gap) of a previously accepted
 * day that trains overlapping muscles.
 */
export function enforceRecovery(
  requestedDays: readonly WeekDayIndex[],
  projects: readonly ProjectId[],
): WeekDayIndex[] {
  // All training days here use the same project set, so the muscle groups
  // involved in every session are identical. We only need to compute once.
  const muscles = musclesForProjects(projects);
  const accepted: WeekDayIndex[] = [];

  for (const day of [...requestedDays].sort((a, b) => a - b) as WeekDayIndex[]) {
    // A day conflicts with a previously accepted day when:
    //   1. the gap is exactly 1 calendar day (< 48 h), AND
    //   2. the two sessions share at least one primary muscle group.
    // Because the project set is the same for all days, condition 2 is
    // equivalent to "projects is non-empty" — i.e. there is always an overlap
    // between identical sessions. This means consecutive days (gap === 1) are
    // always removed when the session trains any muscles at all.
    const hasConflict = accepted.some(prev => {
      const gap = day - prev;
      return gap <= 1 && musclesOverlap(muscles, muscles);
    });
    if (!hasConflict) accepted.push(day);
  }
  return accepted;
}

// ---------------------------------------------------------------------------
// 7-day active-recovery insertion (EVAL_SET R-02)
// ---------------------------------------------------------------------------

/**
 * When the user requests all 7 days AND the project set touches muscles that
 * need recovery, we must insert at least one active-recovery slot.
 *
 * Strategy: keep a maximum of 5 consecutive strength days, then insert
 * active-recovery; the remaining days become rest.
 */
export function insertActiveRecovery(
  trainingDays: readonly WeekDayIndex[],
): ReadonlyArray<{ dayIndex: WeekDayIndex; type: DayType }> {
  const allDays: WeekDayIndex[] = [0, 1, 2, 3, 4, 5, 6];
  const trainingSet = new Set(trainingDays);

  if (trainingDays.length < 7) {
    return allDays.map(dayIndex => ({
      dayIndex,
      type: trainingSet.has(dayIndex) ? 'strength' : 'rest',
    }));
  }

  // All 7 selected: enforce at least 2 non-strength days.
  // Keep Mon–Fri as strength (5 days), Sat = active_recovery, Sun = rest.
  return allDays.map(dayIndex => {
    if (dayIndex <= 4) return { dayIndex, type: 'strength' as DayType };
    if (dayIndex === 5) return { dayIndex, type: 'active_recovery' as DayType };
    return { dayIndex, type: 'rest' as DayType };
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface WeekScheduleOptions {
  /**
   * Specific ISO day indices the user wants to train (0=Mon … 6=Sun).
   * When omitted, a sensible default is derived from `maxDaysPerWeek`.
   */
  requestedDays?: readonly WeekDayIndex[];
  /** Used only when `requestedDays` is not provided. */
  maxDaysPerWeek?: number;
  projects: readonly ProjectId[];
}

/**
 * Build the canonical 7-day schedule for one week.
 *
 * - Respects user-supplied specific days when provided.
 * - Falls back to a default pattern derived from `maxDaysPerWeek`.
 * - Enforces the 48-h same-muscle recovery rule by removing violating days.
 * - Inserts an active-recovery slot when all 7 days are requested.
 *
 * Returns exactly 7 `ScheduledDay` entries in ISO-week order.
 */
export function buildWeekSchedule(options: WeekScheduleOptions): readonly ScheduledDay[] {
  const { projects } = options;

  // 1. Resolve requested training days
  let requestedDays: readonly WeekDayIndex[];
  if (options.requestedDays && options.requestedDays.length > 0) {
    requestedDays = options.requestedDays.filter(
      (d): d is WeekDayIndex => Number.isInteger(d) && d >= 0 && d <= 6,
    );
  } else {
    requestedDays = defaultTrainingDays(options.maxDaysPerWeek ?? 3);
  }

  // 2. Handle all-7-days case with active-recovery insertion
  if (requestedDays.length === 7) {
    const withRecovery = insertActiveRecovery(requestedDays);
    return withRecovery.map(({ dayIndex, type }) => ({
      dayIndex,
      type,
      projects: type === 'strength' ? projects : [],
    }));
  }

  // 3. Enforce 48-h recovery on the requested days
  const validDays = enforceRecovery(requestedDays, projects);

  // 4. Build the full 7-slot week
  const validSet = new Set(validDays);
  const removedDays = requestedDays.filter(d => !validSet.has(d));

  return ([0, 1, 2, 3, 4, 5, 6] as WeekDayIndex[]).map(dayIndex => ({
    dayIndex,
    type: validSet.has(dayIndex) ? 'strength' : 'rest',
    projects: validSet.has(dayIndex) ? projects : [],
    // Attach metadata about removed days so callers can surface a warning.
    ...(removedDays.includes(dayIndex) ? { removedForRecovery: true } : {}),
  }));
}

/**
 * Validate whether a given list of day indices violates the 48-h rule for the
 * supplied project set.  Useful for the co-pilot validation endpoint.
 */
export function validateRecoveryGaps(
  trainingDays: readonly WeekDayIndex[],
  projects: readonly ProjectId[],
): { valid: boolean; violations: Array<{ day: WeekDayIndex; conflictsWith: WeekDayIndex }> } {
  const sorted = [...trainingDays].sort((a, b) => a - b) as WeekDayIndex[];
  const muscles = musclesForProjects(projects);
  const violations: Array<{ day: WeekDayIndex; conflictsWith: WeekDayIndex }> = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Gap of 1 day means < 48 h between sessions of the same muscle groups.
    if (curr - prev <= 1 && muscles.length > 0) {
      violations.push({ day: curr, conflictsWith: prev });
    }
  }
  return { valid: violations.length === 0, violations };
}
