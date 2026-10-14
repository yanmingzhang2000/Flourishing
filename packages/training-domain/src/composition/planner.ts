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
import { getExcludedExercises } from '../safety/exclusions';
import { calculateSessionDuration } from './duration-calculator';
import { getAllocation, getMidpointCounts } from './exercise-selector';

/**
 * Structured failure when contraindication/equipment filtering leaves a
 * required category empty. Extends RangeError so existing generic
 * RangeError handling keeps working, but carries deterministic
 * attribution data (which categories ran dry, how many exercises the
 * injury filter removed, which injury tags were applied) so the API
 * layer can tell the USER WHY generation failed — not just THAT it
 * failed (P0 test-report fix: "提示不告知是伤病导致").
 */
export class InsufficientSafeExercisesError extends RangeError {
  readonly emptyCategories: readonly string[];
  readonly injuryTags: readonly string[];
  readonly excludedCount: number;

  constructor(params: {
    emptyCategories: readonly string[];
    injuryTags: readonly string[];
    excludedCount: number;
  }) {
    super(
      `Insufficient safe exercises to assemble a complete day plan: no safe ${params.emptyCategories.join('/')} exercises remain after filtering by target projects, equipment, and injury contraindications.`,
    );
    this.name = 'InsufficientSafeExercisesError';
    this.emptyCategories = params.emptyCategories;
    this.injuryTags = params.injuryTags;
    this.excludedCount = params.excludedCount;
  }
}

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
  /**
   * Feedback-driven difficulty bias (SAFE-03b/c step 3: 换高级/简单动作).
   * When set, each main exercise is deterministically swapped for a
   * same-category candidate one difficulty level higher/lower, staying
   * inside the experience range. Warmup/stretch are untouched.
   */
  difficultyBias?: 1 | -1;
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
 * Deterministically swap main exercises one difficulty level up/down
 * (SAFE-03b/c ladder step 3). Each picked exercise tries to move to a
 * same-category, not-yet-picked candidate at the target difficulty,
 * clamped to the experience range; if no candidate exists the original
 * is kept (progression never forces an out-of-range exercise).
 */
function applyDifficultyBias(
  main: readonly Exercise[],
  pool: readonly Exercise[],
  experienceLevel: ExperienceLevel | null,
  bias: 1 | -1,
): Exercise[] {
  const range = getDifficultyRange(experienceLevel);
  const minDifficulty = range ? range.minDifficulty : 1;
  const maxDifficulty = range ? range.maxDifficulty : 5;

  const pickedIds = new Set(main.map((ex) => ex.exerciseId));
  return main.map((exercise) => {
    const target = exercise.difficulty + bias;
    if (target < minDifficulty || target > maxDifficulty) return exercise;
    const alternative = pool.find(
      (candidate) => candidate.difficulty === target && !pickedIds.has(candidate.exerciseId),
    );
    if (!alternative) return exercise;
    pickedIds.add(alternative.exerciseId);
    return alternative;
  });
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
 * @throws InsufficientSafeExercisesError (a RangeError subclass) with
 *   structured attribution when no safe exercises remain for a required
 *   category even after the global same-category fallback
 */
export function planDay(input: PlanDayInput): DayPlanResult {
  const { exercisePool, targetProjects, availableEquipment, injuryTags, experienceLevel } = input;

  // Step 1-3: filter candidate pool. Keep exclusion metadata (which
  // exercises the injury filter removed and why) for error attribution.
  const byProject = filterByTargetProjects(exercisePool, targetProjects);
  const byEquipment = filterByEquipment(byProject, availableEquipment);
  const exclusion = getExcludedExercises(byEquipment, injuryTags);
  const safePool = exclusion.safeExercises;

  // Step 4: duration from target projects formula
  const estimatedDurationMinutes = calculateSessionDuration(targetProjects);

  // Step 5: exercise count allocation from duration
  const allocation = getAllocation(estimatedDurationMinutes);
  const counts = getMidpointCounts(allocation);

  // Step 6: pick exercises per category from the safe pool.
  // Note: "main" training maps to the 'strength' ExerciseCategory
  // (PRODUCT_LOGIC §6.1 用 "主训练" 指代力量动作).
  //
  // Fallback policy: when a category pool is empty after
  // project∩equipment∩injury filtering, top up from the GLOBAL pool of
  // the same category (same equipment + injury filters still applied —
  // safety filtering is never bypassed, 04-SAFETY §1.1). Without this,
  // e.g. a lower-back-injury user on a project whose every stretch is
  // lower_back-contraindicated fails the whole day. Fallback only fills
  // empty pools; partially-covered pools keep project-specific picks.
  const globalByEquipment = filterByEquipment(exercisePool, availableEquipment);
  const globalSafe = getExcludedExercises(globalByEquipment, injuryTags).safeExercises;

  const mainPool = withGlobalFallback(
    filterByCategory(safePool, 'strength'),
    filterByCategory(globalSafe, 'strength'),
    counts.main,
  );
  const stretchPool = withGlobalFallback(
    filterByCategory(safePool, 'stretch'),
    filterByCategory(globalSafe, 'stretch'),
    counts.stretch,
  );
  const warmupPool = withGlobalFallback(
    filterByCategory(safePool, 'warmup'),
    filterByCategory(globalSafe, 'warmup'),
    counts.warmup,
  );

  const warmupPicked = pickExercises(warmupPool, counts.warmup);
  const mainPicked = pickExercises(mainPool, counts.main);
  const stretchPicked = pickExercises(stretchPool, counts.stretch);

  if (warmupPicked.length === 0 || mainPicked.length === 0 || stretchPicked.length === 0) {
    const emptyCategories: string[] = [];
    if (warmupPicked.length === 0) emptyCategories.push('warmup');
    if (mainPicked.length === 0) emptyCategories.push('main');
    if (stretchPicked.length === 0) emptyCategories.push('stretch');
    throw new InsufficientSafeExercisesError({
      emptyCategories,
      injuryTags,
      excludedCount: exclusion.excludedIds.size,
    });
  }

  // Step 7: attach sets/reps/rest from experience level (SAFE-03a),
  // with optional feedback-driven difficulty bias on main exercises.
  const mainSelected =
    input.difficultyBias !== undefined
      ? applyDifficultyBias(mainPicked, mainPool, experienceLevel, input.difficultyBias)
      : mainPicked;

  return {
    warmup: warmupPicked.map((ex) => toPlannedExercise(ex, experienceLevel)),
    main: mainSelected.map((ex) => toPlannedExercise(ex, experienceLevel)),
    stretch: stretchPicked.map((ex) => toPlannedExercise(ex, experienceLevel)),
    estimatedDurationMinutes,
  };
}

/**
 * Merge project-specific candidates with the global same-category pool
 * when the project pool cannot cover the requested count. Project
 * exercises stay first (project relevance); global ones only top up.
 * Both pools must already have passed equipment + injury filtering.
 */
function withGlobalFallback(projectPool: Exercise[], globalPool: Exercise[], needed: number): Exercise[] {
  if (projectPool.length >= needed || globalPool.length === 0) return projectPool;
  const seen = new Set(projectPool.map((ex) => ex.exerciseId));
  const merged = [...projectPool];
  for (const ex of globalPool) {
    if (!seen.has(ex.exerciseId)) {
      merged.push(ex);
      seen.add(ex.exerciseId);
    }
  }
  return merged;
}
