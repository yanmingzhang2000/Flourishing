import { describe, expect, it } from 'vitest';
import type { ExperienceLevel } from '@flourish/contracts';
import { getDifficultyRange, isDifficultyInRange } from './progression';

describe('getDifficultyRange (SAFE-03a)', () => {
  it('T-SAFE-03-01: beginner maps to D1-2, 2-3 sets, 8-12 reps, 60s rest', () => {
    const range = getDifficultyRange('beginner');
    expect(range).toEqual({
      minDifficulty: 1,
      maxDifficulty: 2,
      minSets: 2,
      maxSets: 3,
      minReps: 8,
      maxReps: 12,
      restSeconds: 60,
    });
  });

  it('T-SAFE-03-02: intermediate maps to D2-3, 3 sets, 12-15 reps, 45s rest', () => {
    const range = getDifficultyRange('intermediate');
    expect(range).toEqual({
      minDifficulty: 2,
      maxDifficulty: 3,
      minSets: 3,
      maxSets: 3,
      minReps: 12,
      maxReps: 15,
      restSeconds: 45,
    });
  });

  it('T-SAFE-03-03: advanced maps to D3-4, 3-4 sets, 15-20 reps, 30s rest', () => {
    const range = getDifficultyRange('advanced');
    expect(range).toEqual({
      minDifficulty: 3,
      maxDifficulty: 4,
      minSets: 3,
      maxSets: 4,
      minReps: 15,
      maxReps: 20,
      restSeconds: 30,
    });
  });

  it('returns null for null input (user has not declared experience level)', () => {
    expect(getDifficultyRange(null)).toBeNull();
  });

  it('covers all three experience levels from contracts', () => {
    const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
    for (const level of levels) {
      const range = getDifficultyRange(level);
      expect(range).not.toBeNull();
      expect(range!.minDifficulty).toBeGreaterThanOrEqual(1);
      expect(range!.maxDifficulty).toBeLessThanOrEqual(5);
      expect(range!.minDifficulty).toBeLessThanOrEqual(range!.maxDifficulty);
    }
  });
});

describe('isDifficultyInRange', () => {
  it('returns true for difficulty within beginner range (D1-2)', () => {
    expect(isDifficultyInRange(1, 'beginner')).toBe(true);
    expect(isDifficultyInRange(2, 'beginner')).toBe(true);
  });

  it('returns false for difficulty outside beginner range', () => {
    expect(isDifficultyInRange(3, 'beginner')).toBe(false);
    expect(isDifficultyInRange(4, 'beginner')).toBe(false);
  });

  it('returns true for difficulty within intermediate range (D2-3)', () => {
    expect(isDifficultyInRange(2, 'intermediate')).toBe(true);
    expect(isDifficultyInRange(3, 'intermediate')).toBe(true);
  });

  it('returns false for difficulty outside intermediate range', () => {
    expect(isDifficultyInRange(1, 'intermediate')).toBe(false);
    expect(isDifficultyInRange(4, 'intermediate')).toBe(false);
  });

  it('returns true for difficulty within advanced range (D3-4)', () => {
    expect(isDifficultyInRange(3, 'advanced')).toBe(true);
    expect(isDifficultyInRange(4, 'advanced')).toBe(true);
  });

  it('returns false for difficulty outside advanced range', () => {
    expect(isDifficultyInRange(2, 'advanced')).toBe(false);
    expect(isDifficultyInRange(5, 'advanced')).toBe(false);
  });

  it('returns true for null experience level (permissive: no constraint)', () => {
    expect(isDifficultyInRange(1, null)).toBe(true);
    expect(isDifficultyInRange(3, null)).toBe(true);
    expect(isDifficultyInRange(5, null)).toBe(true);
  });
});
