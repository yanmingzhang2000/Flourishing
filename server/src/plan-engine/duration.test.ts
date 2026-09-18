import { describe, expect, it } from 'vitest';
import { calculateSessionMinutes } from './duration';

describe('P0 session duration rules', () => {
  it.each([
    [['tricep_tone'], 20],
    [['tricep_tone', 'lower_abs_tone'], 35],
    [['hip_thigh_tone', 'lower_abs_tone', 'round_shoulder_fix'], 55],
    [['full_body_basic', 'trap_relax'], 40],
  ] as const)('calculates %j as %d minutes', (projects, expected) => {
    expect(calculateSessionMinutes(projects)).toBe(expected);
  });

  it('does not multiply the project count twice', () => {
    expect(calculateSessionMinutes(['tricep_tone', 'lower_abs_tone'])).toBe(35);
  });

  it('allows an explicit non-negative warmup adjustment', () => {
    expect(calculateSessionMinutes(['tricep_tone'], 0)).toBe(15);
    expect(() => calculateSessionMinutes(['tricep_tone'], -1)).toThrow(/warmupMinutes/);
  });
});
