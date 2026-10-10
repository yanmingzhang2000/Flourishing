/**
 * Exercise quantity allocation (SAFE-04b): maps session duration to
 * warmup/main/stretch exercise count ranges (PRODUCT_LOGIC §6.1).
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): deterministic lookup table,
 * no LLM or heuristics.
 */

export type ExerciseCategory = 'warmup' | 'main' | 'stretch';

export interface ExerciseAllocation {
  /** Number of warmup exercises (range [min, max]) */
  warmup: { min: number; max: number };
  /** Number of main training exercises (range [min, max]) */
  main: { min: number; max: number };
  /** Number of stretch exercises (range [min, max]) */
  stretch: { min: number; max: number };
  /** Total exercise count range (for sanity check) */
  total: { min: number; max: number };
}

/**
 * Duration bucket → exercise count mapping table
 * (PRODUCT_LOGIC §6.1 / TASK3_ALIGNMENT §2.5 表 2.5).
 *
 * | 时长    | 热身 | 主训练 | 拉伸 | 总动作数 |
 * |---------|------|--------|------|----------|
 * | 15分钟  | 2-3  | 3-4    | 2    | 7-9      |
 * | 20分钟  | 3    | 4-5    | 2    | 9-10     |
 * | 30分钟  | 3    | 5-6    | 3    | 11-12    |
 * | 45分钟  | 4    | 6-8    | 3    | 13-15    |
 */
const DURATION_ALLOCATION_MAP: Record<number, ExerciseAllocation> = {
  15: {
    warmup: { min: 2, max: 3 },
    main: { min: 3, max: 4 },
    stretch: { min: 2, max: 2 },
    total: { min: 7, max: 9 },
  },
  20: {
    warmup: { min: 3, max: 3 },
    main: { min: 4, max: 5 },
    stretch: { min: 2, max: 2 },
    total: { min: 9, max: 10 },
  },
  30: {
    warmup: { min: 3, max: 3 },
    main: { min: 5, max: 6 },
    stretch: { min: 3, max: 3 },
    total: { min: 11, max: 12 },
  },
  45: {
    warmup: { min: 4, max: 4 },
    main: { min: 6, max: 8 },
    stretch: { min: 3, max: 3 },
    total: { min: 13, max: 15 },
  },
};

/** Supported duration buckets (in minutes). */
export const SUPPORTED_DURATION_BUCKETS = Object.keys(DURATION_ALLOCATION_MAP).map(Number);

/**
 * Snap a raw duration (minutes) to the nearest supported bucket
 * (15, 20, 30, or 45 minutes).
 *
 * Snapping rules:
 * - < 17.5 → 15
 * - < 25 → 20
 * - < 37.5 → 30
 * - ≥ 37.5 → 45
 *
 * @param durationMinutes - Session duration to round
 * @returns Nearest supported bucket
 */
export function snapToBucket(durationMinutes: number): number {
  if (durationMinutes < 17.5) return 15;
  if (durationMinutes < 25) return 20;
  if (durationMinutes < 37.5) return 30;
  return 45;
}

/**
 * Get the exercise count allocation for a given session duration.
 * Automatically snaps the duration to the nearest bucket if it doesn't
 * exactly match one.
 *
 * @param durationMinutes - Target session duration (will be snapped to bucket)
 * @returns Exercise allocation ranges by category
 */
export function getAllocation(durationMinutes: number): ExerciseAllocation {
  const bucket = snapToBucket(durationMinutes);
  const allocation = DURATION_ALLOCATION_MAP[bucket];
  if (!allocation) {
    // This should never happen since snapToBucket returns one of 15/20/30/45
    throw new Error(`No allocation defined for bucket ${bucket}`);
  }
  return allocation;
}

/**
 * Get the mid-point target count for each category, useful for picking
 * a concrete count from a range.
 *
 * @param allocation - Exercise allocation object (from getAllocation)
 * @returns { warmup, main, stretch } mid-point counts
 */
export function getMidpointCounts(allocation: ExerciseAllocation): {
  warmup: number;
  main: number;
  stretch: number;
} {
  return {
    warmup: Math.round((allocation.warmup.min + allocation.warmup.max) / 2),
    main: Math.round((allocation.main.min + allocation.main.max) / 2),
    stretch: Math.round((allocation.stretch.min + allocation.stretch.max) / 2),
  };
}
