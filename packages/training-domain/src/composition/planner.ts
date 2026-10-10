/**
 * Single-day plan assembly (SAFE-04): combines exercise filtering,
 * safety exclusion, difficulty range, and exercise-count allocation
 * into one concrete day of training.
 *
 * This module performs selection only. It does not calculate recovery
 * windows (scheduling/recovery.ts) or iterate across a week
 * (composition/weekly-planner.ts).
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): all selection decisions here
 * are deterministic rule-based lookups. No LLM involvement.
 */

import type { Exercise, ExperienceLevel } from '@flourish/contracts';
import { getDifficultyRange } from '../difficulty/progression';
import {
  filterByCategory,
  filterByEquipment,
  filterByTargetProjects,
} from '../exercises/repository';
import { filterSafeExercises } from '../safety/exclusions';
import { calculateSessionDuration } from './duration-calculator';
import { getAllocation, getMidpointCounts } from './exercise-selector';

export interface PlannedExercise {
  exercise: Exercise;
  /** Concrete set count chosen for this exercise (within experience range) */
  sets: number;
  /** Concrete rep count chosen for this exercise (within experience range), as a display string */
  reps: string;
  /** Rest seconds between sets (from experience level) */
  restSeconds: number;
}

export interface DayPlanResult {
  warmup: PlannedExercise[];
  main: PlannedExercise[];
  stretch: PlannedExercise[];
  /** Estimated total duration in minutes (from target projects formula) */
  estimatedDurationMinutes: number;
}

export interface PlanDayInput {
  /** Full exercise pool (already loaded via exercises/loader.ts) */
  exercisePool: Exercise[];
  /** Selected target projects for this plan */
  targetProjects: string[];
  /** User's available equipment tags */
  availableEquipment: string[];
  /** User's mapped injury/contraindication tags (already resolved) */
  injuryTags: readonly string[];
  /** User's declared experience level (null if not set) */
  experienceLevel: ExperienceLevel | null;
}

/**
 * Deterministically pick `count` items from a candidate pool.
 * Uses a stable order (array order from upstream filters) rather than
 * randomization, to keep output reproducible for testing and support.
 */
function pickExercises(pool: Exercise[], count: number): Exercise[] {
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Attach concrete sets/reps/rest metadata to a raw Exercise, using the
 * experience-level difficulty range (SAFE-03a). Falls back to a
 * conservative default when experienceLevel is null.
 */
function toPlannedExercise(
  exercise: Exercise,
  experienceLevel: ExperienceLevel | null,
): PlannedExercise {
  const range = getDifficultyRange(experienceLevel);

  if (range === null) {
    // No declared experience: use the exercise's own baseline difficulty
    // and a conservative default. This never blocks plan generation.
    return {
      exercise,
      sets: 2,
      reps: '8-12',
      restSeconds: exercise.restSeconds,
    };
  }

  return {
    exercise,
    sets: range.maxSets,
    reps: `${range.minReps}-${range.maxReps}`,
    restSeconds: range.restSeconds,
  };
}

/**
 * Assemble a single day's training plan.
 *
 * Pipeline (PRODUCT_LOGIC §6.3):
 *   1. Filter pool by target projects
 *   2. Filter by available equipment
 *   3. Exclude contraindicated exercises (SAFE-01, 100% accuracy)
 *   4. Compute session duration from target projects (SAFE-04a)
 *   5. Determine exercise-count allocation from duration (SAFE-04b)
 *   6. Pick concrete exercises per category (warmup/main/stretch)
 *   7. Attach sets/reps/rest from experience level (SAFE-03a)
 *
 * @throws RangeError if no safe exercises remain for a required category
 */
export function planDay(input: PlanDayInput): DayPlanResult {
  const { exercisePool, targetProjects, availableEquipment, injuryTags, experienceLevel } = input;

  // Step 1-3: filter candidate pool
  const byProject = filterByTargetProjects(exercisePool, targetProjects);
  const byEquipment = filterByEquipment(byProject, availableEquipment);
  const safePool = filterSafeExercises(byEquipment, injuryTags);

  // Step 4: duration from target projects formula
  const estimatedDurationMinutes = calculateSessionDuration(targetProjects);

  // Step 5: exercise count allocation from duration
  const allocation = getAllocation(estimatedDurationMinutes);
  const counts = getMidpointCounts(allocation);

  // Step 6: pick exercises per category from the safe pool.
  // Note: "main" training maps to the 'strength' ExerciseCategory
  // (PRODUCT_LOGIC §6.1 用 "主训练" 指代力量动作).
  const warmupPool = filterByCategory(safePool, 'warmup');
  const mainPool = filterByCategory(safePool, 'strength');
  const stretchPool = filterByCategory(safePool, 'stretch');

  const warmupPicked = pickExercises(warmupPool, counts.warmup);
  const mainPicked = pickExercises(mainPool, counts.main);
  const stretchPicked = pickExercises(stretchPool, counts.stretch);

  if (warmupPicked.length === 0 || mainPicked.length === 0 || stretchPicked.length === 0) {
    throw new RangeError(
      'Insufficient safe exercises to assemble a complete day plan (warmup/main/stretch each require at least 1 exercise)',
    );
  }

  // Step 7: attach sets/reps/rest from experience level
  return {
    warmup: warmupPicked.map((ex) => toPlannedExercise(ex, experienceLevel)),
    main: mainPicked.map((ex) => toPlannedExercise(ex, experienceLevel)),
    stretch: stretchPicked.map((ex) => toPlannedExercise(ex, experienceLevel)),
    estimatedDurationMinutes,
  };
}
