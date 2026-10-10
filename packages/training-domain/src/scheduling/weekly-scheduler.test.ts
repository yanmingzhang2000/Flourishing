import { describe, expect, it } from 'vitest';
import { buildWeeklySchedule, isFullWeekSelected } from './weekly-scheduler';

// Monday 2026-01-05 is a known Monday (verified: Jan 2026 starts on Thursday,
// so Jan 5 is a Monday). All test dates are UTC-anchored.
const MONDAY_START = '2026-01-05';

describe('buildWeeklySchedule (SAFE-02a)', () => {
  it('maps calendar dates to correct weekday names starting from Monday', () => {
    const schedule = buildWeeklySchedule(MONDAY_START, ['monday']);
    expect(schedule).toHaveLength(7);
    expect(schedule.map((d) => d.weekday)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    expect(schedule.map((d) => d.date)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
      '2026-01-11',
    ]);
  });

  it('non-consecutive selection (Mon/Wed/Fri) passes through unchanged', () => {
    const schedule = buildWeeklySchedule(MONDAY_START, ['monday', 'wednesday', 'friday']);
    const trainingDays = schedule.filter((d) => d.isTrainingDay).map((d) => d.weekday);
    expect(trainingDays).toEqual(['monday', 'wednesday', 'friday']);
    for (const day of schedule) {
      expect(day.recoveryReason).toBeUndefined();
    }
  });

  it('T-SAFE-02a-01: consecutive days (Mon/Tue) — Tuesday demoted to recovery', () => {
    const schedule = buildWeeklySchedule(MONDAY_START, ['monday', 'tuesday']);
    const monday = schedule.find((d) => d.weekday === 'monday')!;
    const tuesday = schedule.find((d) => d.weekday === 'tuesday')!;

    expect(monday.isTrainingDay).toBe(true);
    expect(tuesday.isTrainingDay).toBe(false);
    expect(tuesday.recoveryReason).toBeDefined();
  });

  it('T-SAFE-02a-02: 7天全选 forces alternating train/recovery pattern', () => {
    const allDays: Array<
      'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    > = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = buildWeeklySchedule(MONDAY_START, allDays);

    expect(isFullWeekSelected(allDays)).toBe(true);

    // Expect alternating pattern starting from Monday (index 0,2,4,6 train)
    const trainingFlags = schedule.map((d) => d.isTrainingDay);
    expect(trainingFlags).toEqual([true, false, true, false, true, false, true]);

    // Every demoted day must carry a recovery reason
    for (const day of schedule) {
      if (!day.isTrainingDay) {
        expect(day.recoveryReason).toBeDefined();
      }
    }
  });

  it('never schedules two training days with less than 48h between them', () => {
    const allDays: Array<
      'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
    > = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = buildWeeklySchedule(MONDAY_START, allDays);

    const trainingIndexes = schedule
      .map((d, i) => (d.isTrainingDay ? i : null))
      .filter((i): i is number => i !== null);

    for (let i = 1; i < trainingIndexes.length; i++) {
      const gapDays = trainingIndexes[i]! - trainingIndexes[i - 1]!;
      expect(gapDays * 24).toBeGreaterThanOrEqual(48);
    }
  });

  it('single training day never gets demoted', () => {
    const schedule = buildWeeklySchedule(MONDAY_START, ['wednesday']);
    const wednesday = schedule.find((d) => d.weekday === 'wednesday')!;
    expect(wednesday.isTrainingDay).toBe(true);
    expect(wednesday.recoveryReason).toBeUndefined();
  });

  it('throws TypeError for invalid startDate', () => {
    expect(() => buildWeeklySchedule('not-a-date', ['monday'])).toThrow(TypeError);
  });

  it('preserves the earliest preferred day when demoting conflicts (first-come priority)', () => {
    // Mon, Tue, Wed all selected: Mon trains, Tue demoted (24h), Wed trains (48h from Mon)
    const schedule = buildWeeklySchedule(MONDAY_START, ['monday', 'tuesday', 'wednesday']);
    const flags = schedule
      .filter((d) => ['monday', 'tuesday', 'wednesday'].includes(d.weekday))
      .map((d) => d.isTrainingDay);
    expect(flags).toEqual([true, false, true]);
  });
});

describe('isFullWeekSelected', () => {
  it('returns true when all 7 unique weekdays are selected', () => {
    expect(
      isFullWeekSelected([
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]),
    ).toBe(true);
  });

  it('returns false for partial selection', () => {
    expect(isFullWeekSelected(['monday', 'wednesday', 'friday'])).toBe(false);
  });

  it('deduplicates before checking (defensive)', () => {
    expect(isFullWeekSelected(['monday', 'monday'])).toBe(false);
  });
});
