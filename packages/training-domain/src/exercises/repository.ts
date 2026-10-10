/**
 * Pure query functions over an already-loaded Exercise[] collection.
 *
 * No I/O here. Callers must load exercises via `loader.ts` first and
 * pass the resulting array into these functions.
 */

import type { Exercise, ExerciseCategory } from '@flourish/contracts';

/**
 * Filter exercises whose primary or secondary muscle group matches any
 * of the given muscle groups.
 */
export function filterByMuscleGroup(
  exercises: Exercise[],
  muscleGroups: string[],
): Exercise[] {
  if (muscleGroups.length === 0) return [];
  const wanted = new Set(muscleGroups);
  return exercises.filter((exercise) => {
    const all = [...exercise.muscleGroup.primary, ...exercise.muscleGroup.secondary];
    return all.some((group) => wanted.has(group));
  });
}

/**
 * Filter exercises that can be performed with the user's available
 * equipment. An exercise qualifies if every equipment item it requires
 * is present in `availableEquipment`.
 */
export function filterByEquipment(
  exercises: Exercise[],
  availableEquipment: string[],
): Exercise[] {
  const available = new Set(availableEquipment);
  return exercises.filter((exercise) => exercise.equipment.every((eq) => available.has(eq)));
}

/**
 * Filter exercises whose difficulty falls within [min, max] (inclusive).
 */
export function filterByDifficulty(
  exercises: Exercise[],
  min: number,
  max: number,
): Exercise[] {
  return exercises.filter((exercise) => exercise.difficulty >= min && exercise.difficulty <= max);
}

/**
 * Filter exercises by category (strength | warmup | stretch | cardio).
 */
export function filterByCategory(
  exercises: Exercise[],
  category: ExerciseCategory,
): Exercise[] {
  return exercises.filter((exercise) => exercise.category === category);
}

/**
 * Filter exercises that belong to any of the given target projects.
 */
export function filterByTargetProjects(
  exercises: Exercise[],
  targetProjects: string[],
): Exercise[] {
  if (targetProjects.length === 0) return [];
  const wanted = new Set(targetProjects);
  return exercises.filter((exercise) => exercise.targetProjects.some((p) => wanted.has(p)));
}

/**
 * Exclude exercises whose id is present in `excludedIds`.
 * Used by safety/exclusions.ts to apply contraindication filtering
 * without this module needing to know about injury-tag logic.
 */
export function excludeByIds(exercises: Exercise[], excludedIds: Set<string>): Exercise[] {
  if (excludedIds.size === 0) return exercises;
  return exercises.filter((exercise) => !excludedIds.has(exercise.exerciseId));
}

/**
 * Find a single exercise by id. Returns undefined if not found.
 */
export function findById(exercises: Exercise[], exerciseId: string): Exercise | undefined {
  return exercises.find((exercise) => exercise.exerciseId === exerciseId);
}
