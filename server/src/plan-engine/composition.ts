/**
 * composition.ts
 *
 * Pure functions for assembling multi-project training days.
 *
 * Implements:
 *  - PRODUCT_LOGIC §四 (multi-project combination, default = daily combined)
 *  - EVAL_SET C-01 (full_body + local deduplication)
 *  - EVAL_SET C-02 (daily combination default)
 *  - EVAL_SET C-03 (equipment filter passes through eligibility layer)
 *
 * No database access; no side effects.
 */

import { CanonicalExercise, NormalizedProfile, ProjectId } from '../exercise-library/types';
import { selectQualifiedExercise } from '../exercise-library/eligibility';
import { canonicalToClientExercise } from '../exercise-library/compatibility';
import { ClientExerciseSnapshot, WorkoutDaySnapshot } from '../exercise-library/types';

// ---------------------------------------------------------------------------
// Overlap detection for full_body + local deduplication (EVAL_SET C-01)
// ---------------------------------------------------------------------------

/**
 * Projects that are considered "full body" — they train multiple muscle groups
 * that overlap with the focused local projects.
 */
const FULL_BODY_PROJECTS: ReadonlySet<ProjectId> = new Set(['full_body_basic']);

/**
 * The primary muscle groups each project works, shared with schedule.ts logic.
 * Kept here to remain self-contained; the two copies must stay in sync.
 */
const PROJECT_PRIMARY_MUSCLES: Readonly<Record<ProjectId, readonly string[]>> = {
  tricep_tone:        ['肱三头肌', '前臂'],
  hip_thigh_tone:     ['臀大肌', '臀中肌', '股四头肌', '腘绳肌'],
  lower_abs_tone:     ['腹直肌', '腹横肌', '腹斜肌'],
  trap_relax:         ['斜方肌上束'],
  round_shoulder_fix: ['菱形肌', '斜方肌中下束', '三角肌后束'],
  full_body_basic:    ['臀大肌', '股四头肌', '腹横肌', '肱三头肌', '胸大肌'],
};

/** Returns true when muscle-group lists share at least one entry. */
function muscleGroupsOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some(m => b.includes(m));
}

export interface OverlapWarning {
  fullBodyProject: ProjectId;
  localProject: ProjectId;
  sharedMuscles: string[];
}

/**
 * Detect full-body + local muscle-group overlaps (C-01).
 * Returns one warning per (full-body, local) pair that shares muscles.
 */
export function detectOverlaps(projects: readonly ProjectId[]): OverlapWarning[] {
  const warnings: OverlapWarning[] = [];
  const fullBodyOnes = projects.filter(p => FULL_BODY_PROJECTS.has(p));
  const localOnes = projects.filter(p => !FULL_BODY_PROJECTS.has(p));

  for (const fb of fullBodyOnes) {
    for (const local of localOnes) {
      const fbMuscles = PROJECT_PRIMARY_MUSCLES[fb];
      const localMuscles = PROJECT_PRIMARY_MUSCLES[local];
      const shared = fbMuscles.filter(m => muscleGroupsOverlap([m], localMuscles));      if (shared.length > 0) {
        warnings.push({ fullBodyProject: fb, localProject: local, sharedMuscles: shared });
      }
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Library interface (kept minimal so tests can supply a stub)
// ---------------------------------------------------------------------------

export interface ExerciseLibraryLike {
  readonly exercises: readonly CanonicalExercise[];
  readonly library_version: string;
}

// ---------------------------------------------------------------------------
// Single-project exercise selection by category
// ---------------------------------------------------------------------------

function pickExercise(
  projectId: ProjectId,
  category: CanonicalExercise['category'],
  profile: NormalizedProfile,
  library: ExerciseLibraryLike,
): CanonicalExercise | null {
  const candidates = library.exercises.filter(
    ex => ex.target_projects.includes(projectId) && ex.category === category,
  );
  for (const candidate of candidates) {
    const result = selectQualifiedExercise(candidate, projectId, profile, library);
    if (result) return result.exercise;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prescription helpers
// ---------------------------------------------------------------------------

function applyDifficulty(
  sets: number,
  reps: number,
  level: 1 | 2 | 3,
): { sets: number; reps: number } {
  if (level === 1) return { sets: Math.max(sets - 1, 1), reps: Math.max(Math.round(reps * 0.8), 6) };
  if (level === 3) return { sets: sets + 1, reps: Math.round(reps * 1.25) };
  return { sets, reps };
}

// ---------------------------------------------------------------------------
// Multi-project daily assembly
// ---------------------------------------------------------------------------

/**
 * Describes which projects contributed strength exercises to a training day,
 * and which were deduplicated away due to muscle-group overlap.
 */
export interface DayCompositionMeta {
  /** Projects that contributed at least one strength exercise. */
  included: ProjectId[];
  /** Projects whose strength exercise was skipped due to overlap with a
   *  full-body project (C-01 deduplication). */
  deduplicated: ProjectId[];
  overlapWarnings: OverlapWarning[];
}

export interface AssembledDay {
  exercises: WorkoutDaySnapshot['exercises'];
  warmup: ClientExerciseSnapshot[];
  cooldown: ClientExerciseSnapshot[];
  meta: DayCompositionMeta;
}

/**
 * Assemble the exercises for a single training day across all requested
 * projects (EVAL_SET C-02: default is daily combination).
 *
 * Deduplication rule (C-01):
 *   When `full_body_basic` is combined with a local project whose primary
 *   muscles overlap, the local project's strength exercise is skipped and a
 *   `deduplicated` entry is recorded in meta.  Warmup / cooldown are still
 *   included for every project regardless of deduplication.
 */
export function assembleTrainingDay(
  projects: readonly ProjectId[],
  profile: NormalizedProfile,
  library: ExerciseLibraryLike,
  difficultyLevel: 1 | 2 | 3 = 2,
): AssembledDay {
  const overlapWarnings = detectOverlaps(projects);
  const deduplicated: ProjectId[] = [];
  const included: ProjectId[] = [];
  const exercises: WorkoutDaySnapshot['exercises'] = [];
  const warmup: ClientExerciseSnapshot[] = [];
  const cooldown: ClientExerciseSnapshot[] = [];

  // Identify which local projects should have their strength exercise removed.
  const suppressedStrength = new Set<ProjectId>();
  for (const warning of overlapWarnings) {
    suppressedStrength.add(warning.localProject);
  }

  for (const projectId of projects) {
    // ── Strength ───────────────────────────────────────────────────────────
    if (!suppressedStrength.has(projectId)) {
      const ex = pickExercise(projectId, 'strength', profile, library);
      if (ex) {
        const prescription = applyDifficulty(2, 12, difficultyLevel);
        const snapshot = canonicalToClientExercise(ex, library.library_version, prescription);
        exercises.push({
          exerciseId: snapshot.id,
          exercise: snapshot,
          sets: prescription.sets,
          reps: prescription.reps,
          restBetweenSet: snapshot.rest_between_set,
          completed: false,
        });
        included.push(projectId);
      }
    } else {
      deduplicated.push(projectId);
    }

    // ── Warmup (always included, not deduplicated) ─────────────────────────
    const warmupEx = pickExercise(projectId, 'warmup', profile, library);
    if (warmupEx) {
      warmup.push(canonicalToClientExercise(warmupEx, library.library_version, { sets: 1, reps: 10 }));
    }

    // ── Cooldown / stretch ─────────────────────────────────────────────────
    const stretchEx = pickExercise(projectId, 'stretch', profile, library);
    if (stretchEx) {
      cooldown.push(canonicalToClientExercise(stretchEx, library.library_version, { sets: 1, reps: 10 }));
    }
  }

  return {
    exercises,
    warmup,
    cooldown,
    meta: { included, deduplicated, overlapWarnings },
  };
}

// ---------------------------------------------------------------------------
// Equipment filter assertion (for tests / co-pilot; C-03)
// ---------------------------------------------------------------------------

/**
 * Verify that every exercise in a day's snapshot only uses equipment the user
 * actually has (EVAL_SET C-03).  Returns the violating exercise IDs.
 */
export function checkEquipmentSubset(
  dayExercises: WorkoutDaySnapshot['exercises'],
  userEquipment: readonly string[],
): string[] {
  const violations: string[] = [];
  for (const slot of dayExercises) {
    const eq = slot.exercise.equipment;
    if (eq.length === 0) continue; // bodyweight — always allowed
    const hasAny = eq.includes('bodyweight') || eq.some(e => userEquipment.includes(e));
    if (!hasAny) violations.push(slot.exerciseId);
  }
  return violations;
}
