/**
 * Single source of truth for rendering an exercise's effort prescription
 * (sets × reps | sets × duration). Every surface (today card, workout
 * page, calendar) MUST use this helper — three divergent implementations
 * previously produced contradictory units for the same snapshot
 * (e.g. card "×45 秒" vs workout "×8-12 次" and degenerate "0 秒" /
 * "undefined 秒" displays).
 */
export interface EffortSnapshot {
  sets: number;
  reps: string | null;
  durationSeconds: number | null;
}

export function formatEffort(snapshot: EffortSnapshot): string {
  const { sets, reps, durationSeconds } = snapshot;
  if (reps) {
    return `${sets} 组 × ${reps} 次`;
  }
  if (durationSeconds !== null && durationSeconds !== undefined) {
    return `${sets} 组 × ${durationSeconds} 秒`;
  }
  return `${sets} 组`;
}
