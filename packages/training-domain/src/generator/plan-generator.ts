/**
 * Weekly plan generation orchestration (Phase 7 main entry point).
 *
 * This is the single public entry point that ties together every pure
 * training-domain module into one deterministic plan-generation pipeline:
 *   1. scheduling/weekly-scheduler.ts  → which calendar dates train (SAFE-02a)
 *   2. composition/planner.ts         → what each training day contains (SAFE-01/03/04)
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1, §2): this module performs the
 * entire plan-defining decision deterministically. No LLM involvement.
 * The result produced here is the authoritative plan; any AI layer may
 * only explain it afterward, never alter its content.
 *
 * This module does not persist anything or assign infrastructure-level
 * fields (id, userId, createdAt, status) — those belong to the server
 * layer (apps/server/modules/plans), which wraps this output into the
 * `WeeklyPlan` contract shape.
 */

import type { Exercise, ExperienceLevel, TrainingDay } from '@flourish/contracts';
import { planDay, type PlannedExercise } from '../composition/planner';
import { buildWeeklySchedule } from '../scheduling/weekly-scheduler';

export interface GeneratePlanDaysInput {
  /** Full exercise pool (already loaded via exercises/loader.ts) */
  exercisePool: Exercise[];
  /** ISO date (YYYY-MM-DD) for the first day of the week */
  startDate: string;
  /** User-selected training weekdays (will be auto-adjusted for 48h rule, SAFE-02a) */
  trainingDays: readonly TrainingDay[];
  /** Selected target projects (1-6) */
  targetProjects: string[];
  /** User's available equipment tags */
  availableEquipment: string[];
  /** User's mapped injury/contraindication tags (already resolved via safety/contraindication-rules.ts) */
  injuryTags: readonly string[];
  /** User's declared experience level (null if not set) */
  experienceLevel: ExperienceLevel | null;
}

export interface GeneratedPlanDay {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  exercises: PlannedExercise[];
  estimatedDurationMinutes: number;
  /** Set when this calendar day was auto-converted to recovery (SAFE-02a) */
  recoveryReason?: string;
}

export interface GeneratePlanDaysResult {
  /** One entry per calendar day in the week that is an actual training day */
  trainingDays: GeneratedPlanDay[];
  /** Full 7-day schedule including recovery/rest days, for calendar display */
  fullWeekSchedule: {
    date: string;
    weekday: TrainingDay;
    isTrainingDay: boolean;
    recoveryReason?: string;
  }[];
}

/**
 * Generate a full week's worth of training days.
 *
 * Pipeline:
 *   1. Resolve which calendar dates actually train this week, applying
 *      the 48h recovery rule (SAFE-02a) to the user's requested weekdays.
 *   2. For each resolved training date, assemble a concrete day plan
 *      (exercise selection, safety exclusion, difficulty, duration) via
 *      composition/planner.ts.
 *
 * @throws RangeError if planDay() cannot assemble a safe day (propagated,
 *   not swallowed — a failed day must not silently produce an unsafe plan)
 */
export function generatePlanDays(input: GeneratePlanDaysInput): GeneratePlanDaysResult {
  const {
    exercisePool,
    startDate,
    trainingDays,
    targetProjects,
    availableEquipment,
    injuryTags,
    experienceLevel,
  } = input;

  const schedule = buildWeeklySchedule(startDate, trainingDays);

  const generatedDays: GeneratedPlanDay[] = [];

  for (const scheduledDay of schedule) {
    if (!scheduledDay.isTrainingDay) continue;

    const dayPlan = planDay({
      exercisePool,
      targetProjects,
      availableEquipment,
      injuryTags,
      experienceLevel,
    });

    generatedDays.push({
      date: scheduledDay.date,
      exercises: [...dayPlan.warmup, ...dayPlan.main, ...dayPlan.stretch],
      estimatedDurationMinutes: dayPlan.estimatedDurationMinutes,
    });
  }

  return {
    trainingDays: generatedDays,
    fullWeekSchedule: schedule.map((day) => ({
      date: day.date,
      weekday: day.weekday,
      isTrainingDay: day.isTrainingDay,
      ...(day.recoveryReason ? { recoveryReason: day.recoveryReason } : {}),
    })),
  };
}
