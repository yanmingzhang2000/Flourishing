import { describe, expect, it } from 'vitest';
import { calculateSessionMinutes } from './duration';
import { P0_EVAL_CASES } from './p0-eval-cases';

describe('P0 evaluation baseline', () => {
  it('contains unique IDs across all four categories', () => {
    const ids = P0_EVAL_CASES.map(testCase => testCase.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(P0_EVAL_CASES.map(testCase => testCase.category))).toEqual(
      new Set(['contraindication', 'duration', 'recovery', 'composition']),
    );
  });

  it('executes the duration baseline cases', () => {
    const durationCases = P0_EVAL_CASES.filter(testCase => testCase.category === 'duration');
    for (const testCase of durationCases) {
      expect(calculateSessionMinutes(testCase.input.projects)).toBe(testCase.expected.sessionMinutes);
    }
  });
});
