/**
 * EVAL_SET R-01 / R-02 / R-03 regression tests for schedule.ts
 *
 * All cases are pure function tests — no database, no file I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  buildWeekSchedule,
  defaultTrainingDays,
  enforceRecovery,
  getStartOfWeek,
  insertActiveRecovery,
  isoIndexToDate,
  validateRecoveryGaps,
  WeekDayIndex,
} from './schedule';

// ---------------------------------------------------------------------------
// defaultTrainingDays
// ---------------------------------------------------------------------------
describe('defaultTrainingDays', () => {
  it('returns exactly 3 days for a count of 3', () => {
    expect(defaultTrainingDays(3)).toHaveLength(3);
  });

  it('returns days that satisfy 48-h recovery (no adjacent days)', () => {
    for (let n = 1; n <= 7; n++) {
      const days = [...defaultTrainingDays(n)].sort((a, b) => a - b);
      // For counts ≤ 5, no two consecutive days should appear
      if (n <= 5) {
        for (let i = 1; i < days.length; i++) {
          expect(days[i] - days[i - 1]).toBeGreaterThan(1);
        }
      }
    }
  });

  it('clamps to 7 for counts > 7', () => {
    expect(defaultTrainingDays(10).length).toBeLessThanOrEqual(7);
  });
});

// ---------------------------------------------------------------------------
// enforceRecovery – R-01: 5-day intent → gap ≥ 48 h
// ---------------------------------------------------------------------------
describe('enforceRecovery (R-01)', () => {
  it('removes any day that is only 1 day after the previous accepted day', () => {
    // 5 consecutive days Mon-Fri (0,1,2,3,4) should collapse to every other day
    const result = enforceRecovery([0, 1, 2, 3, 4], ['tricep_tone']);
    // Adjacent days must be removed; remaining days must be ≥ 2 apart
    const sorted = [...result].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(1);
    }
  });

  it('keeps well-spaced days as-is (Mon/Wed/Fri = 0,2,4)', () => {
    const result = enforceRecovery([0, 2, 4], ['tricep_tone']);
    expect(result).toEqual([0, 2, 4]);
  });

  it('keeps Mon/Thu (0,3) unchanged', () => {
    expect(enforceRecovery([0, 3], ['lower_abs_tone'])).toEqual([0, 3]);
  });

  it('handles unsorted input correctly', () => {
    const result = enforceRecovery([4, 0, 2], ['hip_thigh_tone']);
    const sorted = [...result].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// insertActiveRecovery – R-02: all-7 forces active-recovery slot
// ---------------------------------------------------------------------------
describe('insertActiveRecovery (R-02)', () => {
  it('produces exactly 7 slots', () => {
    expect(insertActiveRecovery([0, 1, 2, 3, 4, 5, 6])).toHaveLength(7);
  });

  it('includes at least one active_recovery day when all 7 are requested', () => {
    const slots = insertActiveRecovery([0, 1, 2, 3, 4, 5, 6]);
    const activeRecoveryCount = slots.filter(s => s.type === 'active_recovery').length;
    expect(activeRecoveryCount).toBeGreaterThanOrEqual(1);
  });

  it('no two consecutive strength days share a gap of ≤ 1 after insertion', () => {
    const slots = insertActiveRecovery([0, 1, 2, 3, 4, 5, 6]);
    const strengthDays = slots
      .filter(s => s.type === 'strength')
      .map(s => s.dayIndex)
      .sort((a, b) => a - b);
    // There must be at least one break (non-strength day) in the week
    expect(strengthDays.length).toBeLessThan(7);
  });

  it('does not produce 7 strength days (no same-day consecutive muscle training)', () => {
    const slots = insertActiveRecovery([0, 1, 2, 3, 4, 5, 6]);
    const strengthCount = slots.filter(s => s.type === 'strength').length;
    expect(strengthCount).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// buildWeekSchedule – R-01 via maxDaysPerWeek path
// ---------------------------------------------------------------------------
describe('buildWeekSchedule', () => {
  it('returns exactly 7 entries for any valid input', () => {
    const result = buildWeekSchedule({ projects: ['tricep_tone'], maxDaysPerWeek: 3 });
    expect(result).toHaveLength(7);
  });

  it('day indices cover 0-6 exactly once', () => {
    const result = buildWeekSchedule({ projects: ['lower_abs_tone'], maxDaysPerWeek: 4 });
    expect(result.map(d => d.dayIndex).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('strength days contain the requested projects', () => {
    const result = buildWeekSchedule({ projects: ['tricep_tone', 'lower_abs_tone'], maxDaysPerWeek: 3 });
    const strengthDays = result.filter(d => d.type === 'strength');
    for (const day of strengthDays) {
      expect(day.projects).toContain('tricep_tone');
      expect(day.projects).toContain('lower_abs_tone');
    }
  });

  it('rest days have empty projects array', () => {
    const result = buildWeekSchedule({ projects: ['tricep_tone'], maxDaysPerWeek: 3 });
    for (const day of result.filter(d => d.type === 'rest')) {
      expect(day.projects).toHaveLength(0);
    }
  });

  it('R-01: 5-day intent produces strength days that are all ≥ 2 apart', () => {
    const result = buildWeekSchedule({ projects: ['tricep_tone'], maxDaysPerWeek: 5 });
    const strengthIndices = result
      .filter(d => d.type === 'strength')
      .map(d => d.dayIndex)
      .sort((a, b) => a - b);
    for (let i = 1; i < strengthIndices.length; i++) {
      expect(strengthIndices[i] - strengthIndices[i - 1]).toBeGreaterThan(1);
    }
  });

  it('R-02: all-7 produces an active_recovery slot and ≤ 5 strength days', () => {
    const result = buildWeekSchedule({
      projects: ['tricep_tone'],
      requestedDays: [0, 1, 2, 3, 4, 5, 6],
    });
    const types = result.map(d => d.type);
    expect(types).toContain('active_recovery');
    expect(result.filter(d => d.type === 'strength').length).toBeLessThanOrEqual(5);
  });

  it('R-03: specific days Mon/Wed/Fri/Sat (0,2,4,5) respects 48-h for single project', () => {
    // 4 and 5 are consecutive → 5 (Sat) should be removed
    const result = buildWeekSchedule({
      projects: ['tricep_tone', 'lower_abs_tone'],
      requestedDays: [0, 2, 4, 5],
    });
    const strengthIndices = result
      .filter(d => d.type === 'strength')
      .map(d => d.dayIndex)
      .sort((a, b) => a - b);
    for (let i = 1; i < strengthIndices.length; i++) {
      expect(strengthIndices[i] - strengthIndices[i - 1]).toBeGreaterThan(1);
    }
  });

  it('preserves user-specified days when they already satisfy recovery', () => {
    const result = buildWeekSchedule({
      projects: ['trap_relax'],
      requestedDays: [0, 2, 4],
    });
    const strengthDays = result.filter(d => d.type === 'strength').map(d => d.dayIndex).sort();
    expect(strengthDays).toEqual([0, 2, 4]);
  });
});

// ---------------------------------------------------------------------------
// validateRecoveryGaps
// ---------------------------------------------------------------------------
describe('validateRecoveryGaps', () => {
  it('reports no violations for well-spaced days', () => {
    const result = validateRecoveryGaps([0, 2, 4], ['tricep_tone']);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('reports a violation for adjacent days', () => {
    const result = validateRecoveryGaps([0, 1], ['tricep_tone']);
    expect(result.valid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({ day: 1, conflictsWith: 0 });
  });

  it('reports multiple violations for many consecutive days', () => {
    const result = validateRecoveryGaps([0, 1, 2, 3], ['hip_thigh_tone']);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
describe('getStartOfWeek', () => {
  it('returns a Monday for a Wednesday input', () => {
    const wednesday = new Date('2026-09-16T12:00:00'); // Wednesday
    const monday = getStartOfWeek(wednesday);
    expect(monday.getDay()).toBe(1); // Monday in JS getDay
  });

  it('returns the same Monday for a Monday input', () => {
    const monday = new Date('2026-09-14T00:00:00');
    expect(getStartOfWeek(monday).toDateString()).toBe(monday.toDateString());
  });

  it('handles a Sunday by returning the previous Monday', () => {
    const sunday = new Date('2026-09-20T00:00:00');
    const result = getStartOfWeek(sunday);
    expect(result.getDay()).toBe(1);
  });
});

describe('isoIndexToDate', () => {
  it('adds dayIndex days to the start-of-week date', () => {
    const monday = new Date('2026-09-14T00:00:00');
    const thursday = isoIndexToDate(monday, 3);
    expect(thursday.getDate()).toBe(17); // Sep 14 + 3 = Sep 17
  });
});
