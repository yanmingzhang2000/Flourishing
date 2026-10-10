/**
 * Experience level → difficulty range mapping (SAFE-03a, PRODUCT_LOGIC §6.2).
 *
 * Maps user-declared training experience to safe difficulty/volume ranges.
 * This is a deterministic lookup table, not AI-generated recommendations.
 */

import type { ExperienceLevel } from '@flourish/contracts';
import type { Difficulty } from './index';

export interface DifficultyRange {
  /** Minimum difficulty level for this experience tier */
  minDifficulty: Difficulty;
  /** Maximum difficulty level for this experience tier */
  maxDifficulty: Difficulty;
  /** Recommended sets (range) */
  minSets: number;
  maxSets: number;
  /** Recommended reps (range) */
  minReps: number;
  maxReps: number;
  /** Rest seconds between sets */
  restSeconds: number;
}

/**
 * Experience level → difficulty range mapping table
 * (TASK3_ALIGNMENT.md §2.4, derived from PRODUCT_LOGIC §6.2).
 *
 * | 经验等级 | 映射难度 | 组数 | 次数 | 组间休息 |
 * |----------|----------|------|------|----------|
 * | 零基础   | D1-2     | 2-3组 | 8-12次 | 60秒 |
 * | 偶尔练   | D2-3     | 3组   | 12-15次 | 45秒 |
 * | 经常练   | D3-4     | 3-4组 | 15-20次 | 30秒 |
 */
const EXPERIENCE_DIFFICULTY_MAP: Record<ExperienceLevel, DifficultyRange> = {
  beginner: {
    minDifficulty: 1,
    maxDifficulty: 2,
    minSets: 2,
    maxSets: 3,
    minReps: 8,
    maxReps: 12,
    restSeconds: 60,
  },
  intermediate: {
    minDifficulty: 2,
    maxDifficulty: 3,
    minSets: 3,
    maxSets: 3,
    minReps: 12,
    maxReps: 15,
    restSeconds: 45,
  },
  advanced: {
    minDifficulty: 3,
    maxDifficulty: 4,
    minSets: 3,
    maxSets: 4,
    minReps: 15,
    maxReps: 20,
    restSeconds: 30,
  },
};

/**
 * Get the safe difficulty/volume range for a given experience level.
 *
 * Deterministic mapping (SAFE-03a): no AI, no heuristics.
 * Returns null for null input (user has not declared experience level).
 */
export function getDifficultyRange(
  experienceLevel: ExperienceLevel | null,
): DifficultyRange | null {
  if (experienceLevel === null) return null;
  return EXPERIENCE_DIFFICULTY_MAP[experienceLevel];
}

/**
 * Check if a given difficulty is within the safe range for an experience level.
 * Returns true for null experienceLevel (permissive: no constraint beats over-constraining).
 */
export function isDifficultyInRange(
  difficulty: Difficulty,
  experienceLevel: ExperienceLevel | null,
): boolean {
  if (experienceLevel === null) return true;
  const range = EXPERIENCE_DIFFICULTY_MAP[experienceLevel];
  return difficulty >= range.minDifficulty && difficulty <= range.maxDifficulty;
}
