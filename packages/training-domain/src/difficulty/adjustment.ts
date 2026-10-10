/**
 * Feedback → plan adjustment ladder (SAFE-03b/c, PRODUCT_LOGIC §7.2).
 *
 * Deterministic single-variable rules (决议 8: 规则引擎执行调整, no AI):
 *   too_easy: +2 reps → +1 set → +1 difficulty
 *   too_hard: −2 reps → −1 set → −1 difficulty
 * Never applies more than one variable per adjustment ("不建议同时增加
 * 多个变量"). Volume changes are clamped to the hard safety bounds below;
 * difficulty changes must respect the experience-level range (SAFE-03a,
 * enforced by the caller via headroom hints and per-exercise clamping).
 *
 * ❗ RED LINE (04-SAFETY §1.1): this is a deterministic lookup ladder.
 * No LLM, no heuristics, no randomness.
 */

import type { ExperienceLevel } from '@flourish/contracts';
import type { DifficultyFeedback } from './index';
import { getDifficultyRange } from './progression';

export type AdjustmentVariable = 'reps' | 'sets' | 'difficulty' | 'none';

/** Hard safety bounds for the reps ladder (applies regardless of experience tier). */
export const REP_BOUNDS = { min: 4, max: 25 } as const;
/** Hard safety bounds for the sets ladder. */
export const SET_BOUNDS = { min: 2, max: 5 } as const;
/** Per-adjustment step sizes (PRODUCT_LOGIC §7.2: +2-3次, +1组). */
export const REPS_STEP = 2;
export const SETS_STEP = 1;

export interface VolumeParams {
  /** Rep range display string, e.g. "8-12" */
  reps: string;
  sets: number;
}

export interface AdjustmentDecision {
  feedback: DifficultyFeedback;
  variable: AdjustmentVariable;
  /** Signed reps delta — non-zero only when variable === 'reps' */
  repsDelta: number;
  /** Signed sets delta — non-zero only when variable === 'sets' */
  setsDelta: number;
  /** Human-readable Chinese explanation of the single applied change (可解释变化, E2E #3) */
  explanation: string;
}

export interface DifficultyHeadroom {
  /** At least one exercise can move +1 difficulty within the experience range */
  higher: boolean;
  /** At least one exercise can move −1 difficulty within the experience range */
  lower: boolean;
}

const FEEDBACK_LABEL: Record<DifficultyFeedback, string> = {
  too_easy: '太轻松',
  too_hard: '太难',
  just_right: '刚好',
};

export function parseRepsRange(reps: string): { low: number; high: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(reps.trim());
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) return null;
  return { low, high };
}

export function formatRepsRange(low: number, high: number): string {
  return `${low}-${high}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Decide the single variable to adjust for one feedback (SAFE-03b/c).
 *
 * Ladder order per PRODUCT_LOGIC §7.2:
 *   1. reps ±2 (within REP_BOUNDS)
 *   2. sets ±1 (within SET_BOUNDS)
 *   3. difficulty ±1 (only with headroom inside the experience range)
 *   4. none (already at a safety bound)
 *
 * @param current - the volume params the new plan should build upon
 *   (usually the previous plan's params, so progression accumulates;
 *   falls back to the fresh baseline when there is no previous plan)
 * @param headroom - whether any composed exercise can actually move one
 *   difficulty level within the user's experience range
 */
export function decideAdjustment(
  feedback: DifficultyFeedback,
  current: VolumeParams,
  experienceLevel: ExperienceLevel | null,
  headroom: DifficultyHeadroom = { higher: true, lower: true },
): AdjustmentDecision {
  if (feedback === 'just_right') {
    return {
      feedback,
      variable: 'none',
      repsDelta: 0,
      setsDelta: 0,
      explanation: '反馈"刚好"：下次计划保持当前强度。',
    };
  }

  const direction = feedback === 'too_easy' ? 1 : -1;
  const sign = direction > 0 ? '+' : '-';
  const label = FEEDBACK_LABEL[feedback];

  // Priority 1: reps ±2, within hard bounds
  const parsed = parseRepsRange(current.reps);
  if (parsed) {
    const nextLow = parsed.low + direction * REPS_STEP;
    const nextHigh = parsed.high + direction * REPS_STEP;
    if (nextLow >= REP_BOUNDS.min && nextHigh <= REP_BOUNDS.max) {
      return {
        feedback,
        variable: 'reps',
        repsDelta: direction * REPS_STEP,
        setsDelta: 0,
        explanation: `上次反馈"${label}"：每组次数 ${sign}${REPS_STEP}（${current.reps} → ${formatRepsRange(nextLow, nextHigh)}）`,
      };
    }
  }

  // Priority 2: sets ±1, within hard bounds
  const nextSets = current.sets + direction * SETS_STEP;
  if (nextSets >= SET_BOUNDS.min && nextSets <= SET_BOUNDS.max) {
    return {
      feedback,
      variable: 'sets',
      repsDelta: 0,
      setsDelta: direction,
      explanation: `上次反馈"${label}"：组数 ${sign}${SETS_STEP}（${current.sets} → ${nextSets} 组）`,
    };
  }

  // Priority 3: difficulty ±1, requires headroom inside the experience range
  if (direction > 0 ? headroom.higher : headroom.lower) {
    return {
      feedback,
      variable: 'difficulty',
      repsDelta: 0,
      setsDelta: 0,
      explanation:
        direction > 0
          ? `上次反馈"${label}"：提升一级动作难度（经验安全范围内）`
          : `上次反馈"${label}"：降低一级动作难度（经验安全范围内）`,
    };
  }

  // All three steps exhausted → keep current level (fail-safe, never force past a bound)
  return {
    feedback,
    variable: 'none',
    repsDelta: 0,
    setsDelta: 0,
    explanation: `上次反馈"${label}"：已到达安全边界，保持当前强度。`,
  };
}

/**
 * Apply a reps/sets decision to base params, clamped to the hard bounds.
 * For variable 'difficulty' / 'none' the base params are returned unchanged
 * (difficulty is applied at exercise-selection level, not here).
 */
export function applyVolumeDecision(
  base: VolumeParams,
  decision: AdjustmentDecision,
): VolumeParams {
  if (decision.variable === 'reps') {
    const parsed = parseRepsRange(base.reps);
    if (!parsed) return base;
    const low = clamp(parsed.low + decision.repsDelta, REP_BOUNDS.min, REP_BOUNDS.max);
    const high = clamp(parsed.high + decision.repsDelta, REP_BOUNDS.min, REP_BOUNDS.max);
    return { reps: formatRepsRange(Math.min(low, high), high), sets: base.sets };
  }
  if (decision.variable === 'sets') {
    return {
      reps: base.reps,
      sets: clamp(base.sets + decision.setsDelta, SET_BOUNDS.min, SET_BOUNDS.max),
    };
  }
  return base;
}

/**
 * Headroom helper: can any main exercise move ±1 difficulty while staying
 * inside the experience range (SAFE-03a)? A null experience tier allows
 * the full 1-5 scale (permissive, matching isDifficultyInRange).
 */
export function computeDifficultyHeadroom(
  difficulties: readonly number[],
  experienceLevel: ExperienceLevel | null,
): DifficultyHeadroom {
  const range = getDifficultyRange(experienceLevel);
  const min = range ? range.minDifficulty : 1;
  const max = range ? range.maxDifficulty : 5;
  return {
    higher: difficulties.some((d) => d + 1 <= max),
    lower: difficulties.some((d) => d - 1 >= min),
  };
}
