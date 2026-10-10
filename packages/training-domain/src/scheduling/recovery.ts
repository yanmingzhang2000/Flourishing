/**
 * Recovery interval validation (SAFE-02): ensures same muscle group is
 * not trained more frequently than the minimum recovery period (48 hours).
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): deterministic rules only,
 * no LLM involvement.
 *
 * Pure functions: callers supply timestamps, no system clock access.
 */

/**
 * Minimum recovery interval between training sessions for the same muscle
 * group (04-SAFETY §1.1: 48 hours).
 */
export const MINIMUM_RECOVERY_HOURS = 48;

/**
 * Check if a muscle group can be trained at a proposed time, given its
 * last training timestamp.
 *
 * Rule (SAFE-02, PRODUCT_LOGIC §3.2):
 * - Same muscle group: requires ≥ minimumHours interval
 * - Different muscle group: no constraint
 *
 * @param lastTrainedAt - ISO timestamp of last training session (or null if never trained)
 * @param proposedAt - ISO timestamp of proposed training session
 * @param minimumHours - Minimum hours between sessions (default 48)
 * @returns true if interval is sufficient or muscle was never trained
 */
export function canScheduleMuscleGroup(
  lastTrainedAt: string | null,
  proposedAt: string,
  minimumHours: number = MINIMUM_RECOVERY_HOURS,
): boolean {
  if (lastTrainedAt === null) return true;

  const lastDate = new Date(lastTrainedAt);
  const proposedDate = new Date(proposedAt);

  if (isNaN(lastDate.getTime()) || isNaN(proposedDate.getTime())) {
    throw new TypeError('Invalid ISO timestamp');
  }

  const intervalHours = (proposedDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  return intervalHours >= minimumHours;
}

/**
 * Calculate the earliest date/time a muscle group can be trained again.
 *
 * @param lastTrainedAt - ISO timestamp of last training session
 * @param minimumHours - Minimum hours between sessions (default 48)
 * @returns ISO timestamp of earliest next training opportunity
 */
export function getNextAvailableTime(
  lastTrainedAt: string,
  minimumHours: number = MINIMUM_RECOVERY_HOURS,
): string {
  const lastDate = new Date(lastTrainedAt);
  if (isNaN(lastDate.getTime())) {
    throw new TypeError('Invalid ISO timestamp');
  }

  const nextDate = new Date(lastDate.getTime() + minimumHours * 60 * 60 * 1000);
  return nextDate.toISOString();
}

/**
 * Check recovery status for multiple muscle groups.
 * Returns a map of muscle group → boolean (true = can train).
 *
 * @param lastTrainedMap - Map of muscle group → last trained ISO timestamp
 * @param proposedAt - ISO timestamp of proposed training session
 * @param minimumHours - Minimum hours between sessions (default 48)
 */
export function checkRecoveryStatus(
  lastTrainedMap: Map<string, string | null>,
  proposedAt: string,
  minimumHours: number = MINIMUM_RECOVERY_HOURS,
): Map<string, boolean> {
  const status = new Map<string, boolean>();
  for (const [muscleGroup, lastTrainedAt] of lastTrainedMap) {
    status.set(muscleGroup, canScheduleMuscleGroup(lastTrainedAt, proposedAt, minimumHours));
  }
  return status;
}
