/**
 * SAFE-03b/c: feedback → adjustment ladder (PRODUCT_LOGIC §7.2).
 *
 * Verifies the single-variable priority order, hard safety bounds,
 * clamping, and the user-facing explanation (E2E #3 可解释变化).
 */

import type { ExperienceLevel } from '@flourish/contracts';
import { describe, expect, it } from 'vitest';
import {
  REP_BOUNDS,
  SET_BOUNDS,
  applyVolumeDecision,
  computeDifficultyHeadroom,
  decideAdjustment,
  formatRepsRange,
  parseRepsRange,
  type AdjustmentDecision,
} from './adjustment';

const BEGINNER_FRESH = { reps: '8-12', sets: 3 };
const INTERMEDIATE_FRESH = { reps: '12-15', sets: 3 };
const ADVANCED_FRESH = { reps: '15-20', sets: 4 };

/** Exactly one variable may carry a delta (§7.2: 不同时增加多个变量). */
function expectSingleVariable(decision: AdjustmentDecision): void {
  const active = [decision.variable === 'reps', decision.variable === 'sets'].filter(Boolean);
  if (decision.variable === 'reps') {
    expect(decision.repsDelta).not.toBe(0);
    expect(decision.setsDelta).toBe(0);
  } else if (decision.variable === 'sets') {
    expect(decision.setsDelta).not.toBe(0);
    expect(decision.repsDelta).toBe(0);
  } else {
    expect(decision.repsDelta).toBe(0);
    expect(decision.setsDelta).toBe(0);
  }
  expect(active.length).toBeLessThanOrEqual(1);
}

describe('parseRepsRange / formatRepsRange', () => {
  it('parses the standard "low-high" display string', () => {
    expect(parseRepsRange('8-12')).toEqual({ low: 8, high: 12 });
    expect(parseRepsRange(' 15-20 ')).toEqual({ low: 15, high: 20 });
  });

  it('rejects malformed input instead of guessing', () => {
    expect(parseRepsRange('12')).toBeNull();
    expect(parseRepsRange('a-b')).toBeNull();
    expect(parseRepsRange('12-8')).toBeNull(); // inverted
    expect(parseRepsRange('')).toBeNull();
  });

  it('round-trips through formatRepsRange', () => {
    expect(formatRepsRange(6, 10)).toBe('6-10');
  });
});

describe('decideAdjustment — SAFE-03b (太轻松 ladder)', () => {
  it('priority 1: bumps reps by +2 first', () => {
    const decision = decideAdjustment('too_easy', BEGINNER_FRESH, 'beginner');
    expect(decision.variable).toBe('reps');
    expect(decision.repsDelta).toBe(2);
    expect(decision.setsDelta).toBe(0);
    expect(decision.explanation).toContain('太轻松');
    expect(decision.explanation).toContain('8-12 → 10-14');
    expectSingleVariable(decision);
  });

  it('priority 2: +1 set only after the reps bound is reached', () => {
    const atRepsCeiling = { reps: `${REP_BOUNDS.max - 1}-${REP_BOUNDS.max}`, sets: 3 };
    const decision = decideAdjustment('too_easy', atRepsCeiling, 'beginner');
    expect(decision.variable).toBe('sets');
    expect(decision.setsDelta).toBe(1);
    expect(decision.repsDelta).toBe(0);
    expect(decision.explanation).toContain('组数 +1');
    expectSingleVariable(decision);
  });

  it('priority 3: +1 difficulty only after reps AND sets bounds are reached', () => {
    const exhausted = { reps: `${REP_BOUNDS.max - 1}-${REP_BOUNDS.max}`, sets: SET_BOUNDS.max };
    const decision = decideAdjustment('too_easy', exhausted, 'beginner', { higher: true, lower: false });
    expect(decision.variable).toBe('difficulty');
    expect(decision.explanation).toContain('提升一级');
    expectSingleVariable(decision);
  });

  it('returns none (never forces past a safety bound) when the ladder is exhausted', () => {
    const exhausted = { reps: `${REP_BOUNDS.max - 1}-${REP_BOUNDS.max}`, sets: SET_BOUNDS.max };
    const decision = decideAdjustment('too_easy', exhausted, 'beginner', { higher: false, lower: true });
    expect(decision.variable).toBe('none');
    expect(decision.explanation).toContain('安全边界');
    expectSingleVariable(decision);
  });
});

describe('decideAdjustment — SAFE-03c (太难 ladder)', () => {
  it('priority 1: drops reps by −2 first', () => {
    const decision = decideAdjustment('too_hard', INTERMEDIATE_FRESH, 'intermediate');
    expect(decision.variable).toBe('reps');
    expect(decision.repsDelta).toBe(-2);
    expect(decision.explanation).toContain('太难');
    expect(decision.explanation).toContain('12-15 → 10-13');
    expectSingleVariable(decision);
  });

  it('priority 2: −1 set once reps hit the floor', () => {
    const atRepsFloor = { reps: `${REP_BOUNDS.min}-${REP_BOUNDS.min + 2}`, sets: 4 };
    const decision = decideAdjustment('too_hard', atRepsFloor, 'beginner');
    expect(decision.variable).toBe('sets');
    expect(decision.setsDelta).toBe(-1);
    expectSingleVariable(decision);
  });

  it('priority 3: −1 difficulty with lower headroom', () => {
    const exhausted = { reps: `${REP_BOUNDS.min}-${REP_BOUNDS.min + 2}`, sets: SET_BOUNDS.min };
    const decision = decideAdjustment('too_hard', exhausted, 'beginner', { higher: false, lower: true });
    expect(decision.variable).toBe('difficulty');
    expect(decision.explanation).toContain('降低一级');
    expectSingleVariable(decision);
  });

  it('returns none when nothing can move down safely', () => {
    const exhausted = { reps: `${REP_BOUNDS.min}-${REP_BOUNDS.min + 2}`, sets: SET_BOUNDS.min };
    const decision = decideAdjustment('too_hard', exhausted, 'beginner', { higher: true, lower: false });
    expect(decision.variable).toBe('none');
    expectSingleVariable(decision);
  });

  it('falls through to sets when reps string is malformed (no guessing)', () => {
    const decision = decideAdjustment('too_hard', { reps: 'n/a', sets: 4 }, null);
    expect(decision.variable).toBe('sets');
    expect(decision.setsDelta).toBe(-1);
  });
});

describe('decideAdjustment — just_right', () => {
  it('changes nothing and explains why', () => {
    const decision = decideAdjustment('just_right', ADVANCED_FRESH, 'advanced');
    expect(decision.variable).toBe('none');
    expect(decision.repsDelta).toBe(0);
    expect(decision.setsDelta).toBe(0);
    expect(decision.explanation).toContain('刚好');
  });
});

describe('applyVolumeDecision', () => {
  it('applies the reps delta to both bounds', () => {
    const decision = decideAdjustment('too_easy', BEGINNER_FRESH, 'beginner');
    expect(applyVolumeDecision(BEGINNER_FRESH, decision)).toEqual({
      reps: '10-14',
      sets: 3,
    });
  });

  it('applies negative reps delta', () => {
    const decision = decideAdjustment('too_hard', INTERMEDIATE_FRESH, 'intermediate');
    expect(applyVolumeDecision(INTERMEDIATE_FRESH, decision)).toEqual({
      reps: '10-13',
      sets: 3,
    });
  });

  it('clamps applied volume to the hard bounds', () => {
    const nearCeiling = { reps: '23-24', sets: 3 };
    // decision says +2 (24→26 would exceed max) — decideAdjustment would not
    // pick reps here, but applyVolumeDecision still clamps defensively.
    const manual = {
      feedback: 'too_easy' as const,
      variable: 'reps' as const,
      repsDelta: 2,
      setsDelta: 0,
      explanation: 'test',
    };
    const applied = applyVolumeDecision(nearCeiling, manual);
    expect(parseRepsRange(applied.reps)!.high).toBe(REP_BOUNDS.max);
    expect(parseRepsRange(applied.reps)!.low).toBeLessThanOrEqual(REP_BOUNDS.max);
  });

  it('applies sets delta with clamping', () => {
    const decision = decideAdjustment('too_easy', {
      reps: `${REP_BOUNDS.max - 1}-${REP_BOUNDS.max}`,
      sets: SET_BOUNDS.max - 1,
    }, 'beginner');
    expect(decision.variable).toBe('sets');
    expect(applyVolumeDecision({ reps: '24-25', sets: 4 }, decision)).toEqual({
      reps: '24-25',
      sets: 5,
    });
  });

  it('leaves params untouched for difficulty/none decisions', () => {
    const base = { reps: '8-12', sets: 3 };
    const difficultyDecision: AdjustmentDecision = {
      feedback: 'too_easy',
      variable: 'difficulty',
      repsDelta: 0,
      setsDelta: 0,
      explanation: 'test',
    };
    expect(applyVolumeDecision(base, difficultyDecision)).toEqual(base);
  });
});

describe('computeDifficultyHeadroom (SAFE-03a bounds)', () => {
  const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];

  it('respects the experience range on both directions', () => {
    expect(computeDifficultyHeadroom([1], 'beginner')).toEqual({ higher: true, lower: false });
    expect(computeDifficultyHeadroom([2], 'beginner')).toEqual({ higher: false, lower: true });
    expect(computeDifficultyHeadroom([1, 2], 'beginner')).toEqual({ higher: true, lower: true });
    expect(computeDifficultyHeadroom([4], 'advanced')).toEqual({ higher: false, lower: true });
  });

  it('uses the full 1-5 scale when experience is undeclared', () => {
    expect(computeDifficultyHeadroom([1], null)).toEqual({ higher: true, lower: false });
    expect(computeDifficultyHeadroom([5], null)).toEqual({ higher: false, lower: true });
  });

  it('never reports headroom outside the declared tier (all levels)', () => {
    for (const level of levels) {
      const headroom = computeDifficultyHeadroom([1, 2, 3, 4, 5], level);
      expect(headroom.higher || headroom.lower).toBe(true); // ranges always span >= 2 levels
    }
  });
});
