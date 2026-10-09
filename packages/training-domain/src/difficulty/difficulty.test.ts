import { describe, expect, it } from 'vitest';
import { adjustDifficulty, clampDifficulty } from './index';

describe('clampDifficulty', () => {
  it('returns the same value when within 1-5', () => {
    expect(clampDifficulty(3)).toBe(3);
    expect(clampDifficulty(1)).toBe(1);
    expect(clampDifficulty(5)).toBe(5);
  });

  it('clamps values below 1 and above 5', () => {
    expect(clampDifficulty(0)).toBe(1);
    expect(clampDifficulty(-10)).toBe(1);
    expect(clampDifficulty(9)).toBe(5);
  });

  it('rounds fractional values', () => {
    expect(clampDifficulty(2.4)).toBe(2);
    expect(clampDifficulty(2.6)).toBe(3);
  });

  it('rejects non-finite values', () => {
    expect(() => clampDifficulty(Number.NaN)).toThrow(RangeError);
    expect(() => clampDifficulty(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('adjustDifficulty', () => {
  it('steps down on too_hard and up on too_easy', () => {
    expect(adjustDifficulty(3, 'too_hard')).toBe(2);
    expect(adjustDifficulty(3, 'too_easy')).toBe(4);
    expect(adjustDifficulty(3, 'just_right')).toBe(3);
  });

  it('never drops below 1 or rises above 5', () => {
    expect(adjustDifficulty(1, 'too_hard')).toBe(1);
    expect(adjustDifficulty(5, 'too_easy')).toBe(5);
  });
});
