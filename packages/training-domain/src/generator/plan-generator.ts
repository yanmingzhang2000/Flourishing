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
import { planDay, type DayPlanResult, type PlannedExercise } from '../composition/planner';
import {
  applyVolumeDecision,
  computeDifficultyHeadroom,
  decideAdjustment,
  type AdjustmentDecision,
  type VolumeParams,
} from '../difficulty/adjustment';
import type { DifficultyFeedback } from '../difficulty/index';
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
  /**
   * Feedback-driven adjustment from the latest completed session
   * (SAFE-03b/c, 决议 8). Omit/null = no feedback → keep the previous
   * plan's volume if any, otherwise the fresh experience baseline.
   */
  adjustment?: {
    feedback: DifficultyFeedback;
    /**
     * Volume params of the plan this one replaces, so progression
     * accumulates across regenerations. Null = no previous plan.
     */
    previousVolume?: VolumeParams | null;
  } | null;
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
  /**
   * The single-variable decision actually applied for this plan
   * (explanation persisted with the plan, E2E #3 可解释变化).
   * Null when there was no directional feedback to act on.
   */
  adjustment: AdjustmentDecision | null;
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
 *   3. If directional feedback exists, apply ONE adjustment variable per
 *      the §7.2 ladder (SAFE-03b/c): reps → sets → difficulty, building
 *      on the previous plan's volume so progression accumulates.
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
    adjustment,
  } = input;

  const schedule = buildWeeklySchedule(startDate, trainingDays);

  interface ComposedDay {
    date: string;
    plan: DayPlanResult;
  }

  const compose = (date: string, difficultyBias?: 1 | -1): ComposedDay => ({
    date,
    plan: planDay({
      exercisePool,
      targetProjects,
      availableEquipment,
      injuryTags,
      experienceLevel,
      ...(difficultyBias !== undefined ? { difficultyBias } : {}),
    }),
  });

  const applyVolume = (days: ComposedDay[], volume: VolumeParams): ComposedDay[] =>
    days.map((day) => {
      const override = (list: PlannedExercise[]): PlannedExercise[] =>
        list.map((ex) => ({ ...ex, reps: volume.reps, sets: volume.sets }));
      return {
        ...day,
        plan: {
          ...day.plan,
          warmup: override(day.plan.warmup),
          main: override(day.plan.main),
          stretch: override(day.plan.stretch),
        },
      };
    });

  const trainingDates = schedule.filter((day) => day.isTrainingDay).map((day) => day.date);
  let composed: ComposedDay[] = trainingDates.map((date) => compose(date));

  let decision: AdjustmentDecision | null = null;
  const firstDay = composed[0];
  const firstMain = firstDay?.plan.main[0];

  if (adjustment && firstDay && firstMain) {
    const fresh: VolumeParams = { reps: firstMain.reps, sets: firstMain.sets };
    const base: VolumeParams = adjustment.previousVolume ?? fresh;

    if (adjustment.feedback === 'too_easy' || adjustment.feedback === 'too_hard') {
      const headroom = computeDifficultyHeadroom(
        firstDay.plan.main.map((planned) => planned.exercise.difficulty),
        experienceLevel,
      );
      decision = decideAdjustment(adjustment.feedback, base, experienceLevel, headroom);

      if (decision.variable === 'difficulty') {
        // Recompose all days with the deterministic bias (SAFE-03b/c step 3)
        const bias: 1 | -1 = adjustment.feedback === 'too_easy' ? 1 : -1;
        composed = trainingDates.map((date) => compose(date, bias));
        // Single variable: only selection changed — keep the current volume
        composed = applyVolume(composed, base);
      } else if (decision.variable === 'none') {
        // Ladder exhausted → stay at the previous level if there was one
        if (adjustment.previousVolume) {
          composed = applyVolume(composed, adjustment.previousVolume);
        }
      } else {
        composed = applyVolume(composed, applyVolumeDecision(base, decision));
      }
    } else if (adjustment.previousVolume) {
      // just_right / no directional feedback → keep the current level
      composed = applyVolume(composed, adjustment.previousVolume);
    }
  }

  return {
    trainingDays: composed.map(({ date, plan }) => ({
      date,
      exercises: [...plan.warmup, ...plan.main, ...plan.stretch],
      estimatedDurationMinutes: plan.estimatedDurationMinutes,
    })),
    fullWeekSchedule: schedule.map((day) => ({
      date: day.date,
      weekday: day.weekday,
      isTrainingDay: day.isTrainingDay,
      ...(day.recoveryReason ? { recoveryReason: day.recoveryReason } : {}),
    })),
    adjustment: decision,
  };
}
