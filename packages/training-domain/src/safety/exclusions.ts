/**
 * Contraindication filtering (SAFE-01): deterministic exclusion of
 * exercises based on a user's injury/limitation tags.
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): this logic MUST be deterministic
 * and 100% accurate. It MUST NOT call an LLM or any probabilistic model.
 *
 * Pure functions only. Callers supply the already-loaded Exercise[]
 * (see exercises/loader.ts) — this module performs no I/O.
 */

import type { Exercise } from '@flourish/contracts';
import { excludeByIds } from '../exercises/repository';

export interface ExclusionResult {
  /** IDs of exercises excluded due to contraindication match. */
  excludedIds: Set<string>;
  /** Exercises remaining after exclusion (safe to include in a plan). */
  safeExercises: Exercise[];
  /** For traceability: excluded exercise id → tags that triggered exclusion. */
  reasons: Record<string, string[]>;
}

/**
 * Given the full exercise pool and a set of user injury tags (already
 * mapped via `mapInjuryOptionsToTags`), return which exercises must be
 * excluded and which remain safe.
 *
 * Rule (PRODUCT_LOGIC §6.4):
 *   1. Multiple injuries combine via UNION (not intersection).
 *   2. An exercise is excluded if ANY of its contraindications intersects
 *      the user's injury tag set.
 *   3. No injuries → zero exclusions (never over-exclude).
 */
export function getExcludedExercises(
  exercises: Exercise[],
  userInjuryTags: readonly string[],
): ExclusionResult {
  const injurySet = new Set(userInjuryTags);
  const excludedIds = new Set<string>();
  const reasons: Record<string, string[]> = {};

  if (injurySet.size > 0) {
    for (const exercise of exercises) {
      const matched = exercise.contraindications.filter((tag) => injurySet.has(tag));
      if (matched.length > 0) {
        excludedIds.add(exercise.exerciseId);
        reasons[exercise.exerciseId] = matched;
      }
    }
  }

  const safeExercises = excludeByIds(exercises, excludedIds);

  return { excludedIds, safeExercises, reasons };
}

/**
 * Convenience wrapper: returns only the safe exercises
 * (drops traceability metadata).
 */
export function filterSafeExercises(
  exercises: Exercise[],
  userInjuryTags: readonly string[],
): Exercise[] {
  return getExcludedExercises(exercises, userInjuryTags).safeExercises;
}
