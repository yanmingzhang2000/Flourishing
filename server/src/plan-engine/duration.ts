import { ProjectId } from '../exercise-library/types';

/** Main-training minutes from PRODUCT_LOGIC. Warmup/cooldown are separate. */
export const PROJECT_MAIN_MINUTES: Readonly<Record<ProjectId, number>> = {
  tricep_tone: 15,
  hip_thigh_tone: 20,
  lower_abs_tone: 15,
  trap_relax: 10,
  round_shoulder_fix: 15,
  full_body_basic: 25,
};

export const DEFAULT_WARMUP_MINUTES = 5;

export function calculateSessionMinutes(
  projectIds: readonly ProjectId[],
  warmupMinutes = DEFAULT_WARMUP_MINUTES,
): number {
  if (!Number.isInteger(warmupMinutes) || warmupMinutes < 0) {
    throw new Error('warmupMinutes must be a non-negative integer');
  }
  return projectIds.reduce((total, projectId) => total + PROJECT_MAIN_MINUTES[projectId], warmupMinutes);
}
