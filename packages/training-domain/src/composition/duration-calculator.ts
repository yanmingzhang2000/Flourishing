/**
 * Duration calculation (SAFE-04a): computes total session duration from
 * selected target projects, and validates against user capacity settings.
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): single-use duration must fall
 * within the range implied by the user's profile. Deterministic formula
 * only, no LLM involvement.
 *
 * Formula (PRODUCT_LOGIC §2.2.3 / §2.2 维度3):
 *   总时长 = Σ(各选中项目的基础时长) + 固定热身 5min
 */

/** Fixed warmup duration added to every session (minutes). */
export const FIXED_WARMUP_MINUTES = 5;

/** Default capacity alignment tolerance in minutes (±5min, TASK3_ALIGNMENT §2.5). */
export const CAPACITY_TOLERANCE_MINUTES = 5;

export type TargetProjectId =
  | 'tricep_tone'
  | 'hip_thigh_tone'
  | 'lower_abs_tone'
  | 'trap_relax'
  | 'round_shoulder_fix'
  | 'full_body_basic';

/**
 * Base main-training duration (minutes) per target project
 * (PRODUCT_LOGIC §2.2 维度3 table).
 */
export const TARGET_PROJECT_BASE_MINUTES: Record<TargetProjectId, number> = {
  tricep_tone: 15,
  hip_thigh_tone: 20,
  lower_abs_tone: 15,
  trap_relax: 10,
  round_shoulder_fix: 15,
  full_body_basic: 25,
};

/**
 * Calculate total estimated session duration from a set of selected
 * target projects.
 *
 * total = Σ(base minutes of each selected project) + fixed warmup (5min)
 *
 * @param targetProjectIds - Selected target project IDs (deduplicated internally)
 * @returns Total estimated duration in minutes
 * @throws RangeError if any ID is not a known target project
 */
export function calculateSessionDuration(targetProjectIds: readonly string[]): number {
  const uniqueIds = Array.from(new Set(targetProjectIds));

  let mainMinutes = 0;
  for (const id of uniqueIds) {
    const base = TARGET_PROJECT_BASE_MINUTES[id as TargetProjectId];
    if (base === undefined) {
      throw new RangeError(`Unknown target project id: ${id}`);
    }
    mainMinutes += base;
  }

  return mainMinutes + FIXED_WARMUP_MINUTES;
}

/**
 * Check whether a calculated/actual duration falls within the user's
 * capacity range (SAFE-04).
 *
 * Rule: |actualMinutes - targetMinutesPerSession| <= tolerance
 *
 * @param actualMinutes - Computed or actual session duration
 * @param targetMinutesPerSession - User's profile target (nullable: no constraint set)
 * @param tolerance - Allowed deviation in minutes (default ±5min)
 * @returns true if within range, or if user has not set a target (permissive)
 */
export function isWithinCapacity(
  actualMinutes: number,
  targetMinutesPerSession: number | null,
  tolerance: number = CAPACITY_TOLERANCE_MINUTES,
): boolean {
  if (targetMinutesPerSession === null) return true;
  return Math.abs(actualMinutes - targetMinutesPerSession) <= tolerance;
}

/**
 * Get the acceptable duration range [min, max] for a user's target
 * minutes per session, given a tolerance.
 *
 * @param targetMinutesPerSession - User's profile target
 * @param tolerance - Allowed deviation in minutes (default ±5min)
 */
export function getCapacityRange(
  targetMinutesPerSession: number,
  tolerance: number = CAPACITY_TOLERANCE_MINUTES,
): { min: number; max: number } {
  return {
    min: Math.max(0, targetMinutesPerSession - tolerance),
    max: targetMinutesPerSession + tolerance,
  };
}
