import { describe, expect, it } from 'vitest';
import {
  MINIMUM_RECOVERY_HOURS,
  canScheduleMuscleGroup,
  checkRecoveryStatus,
  getNextAvailableTime,
} from './recovery';

describe('canScheduleMuscleGroup (SAFE-02)', () => {
  it('T-SAFE-02-01: blocks scheduling when interval < 48 hours', () => {
    const lastTrained = '2026-01-06T10:00:00Z'; // Monday 10:00
    const proposed = '2026-01-07T10:00:00Z'; // Tuesday 10:00 (24h later)
    expect(canScheduleMuscleGroup(lastTrained, proposed)).toBe(false);
  });

  it('T-SAFE-02-02: allows scheduling when interval ≥ 48 hours', () => {
    const lastTrained = '2026-01-06T10:00:00Z'; // Monday 10:00
    const proposed = '2026-01-08T11:00:00Z'; // Wednesday 11:00 (49h later)
    expect(canScheduleMuscleGroup(lastTrained, proposed)).toBe(true);
  });

  it('T-SAFE-02-03: allows scheduling for never-trained muscle (null lastTrainedAt)', () => {
    const proposed = '2026-01-08T10:00:00Z';
    expect(canScheduleMuscleGroup(null, proposed)).toBe(true);
  });

  it('allows exactly 48 hours (boundary condition)', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const proposed = '2026-01-08T10:00:00Z'; // exactly 48h later
    expect(canScheduleMuscleGroup(lastTrained, proposed)).toBe(true);
  });

  it('blocks 47.99 hours (just under threshold)', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const proposed = '2026-01-08T09:59:00Z'; // 47h 59min later
    expect(canScheduleMuscleGroup(lastTrained, proposed)).toBe(false);
  });

  it('respects custom minimum hours', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const proposed = '2026-01-07T10:00:00Z'; // 24h later
    expect(canScheduleMuscleGroup(lastTrained, proposed, 24)).toBe(true);
    expect(canScheduleMuscleGroup(lastTrained, proposed, 48)).toBe(false);
  });

  it('throws TypeError for invalid ISO timestamps', () => {
    expect(() => canScheduleMuscleGroup('not-a-date', '2026-01-08T10:00:00Z')).toThrow(TypeError);
    expect(() => canScheduleMuscleGroup('2026-01-06T10:00:00Z', 'invalid')).toThrow(TypeError);
  });
});

describe('getNextAvailableTime', () => {
  it('returns ISO timestamp exactly minimumHours after lastTrainedAt', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const next = getNextAvailableTime(lastTrained);
    expect(next).toBe('2026-01-08T10:00:00.000Z'); // 48h later
  });

  it('respects custom minimum hours', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const next = getNextAvailableTime(lastTrained, 24);
    expect(next).toBe('2026-01-07T10:00:00.000Z'); // 24h later
  });

  it('throws TypeError for invalid ISO timestamp', () => {
    expect(() => getNextAvailableTime('not-a-date')).toThrow(TypeError);
  });

  it('produces a timestamp that passes canScheduleMuscleGroup', () => {
    const lastTrained = '2026-01-06T10:00:00Z';
    const next = getNextAvailableTime(lastTrained);
    expect(canScheduleMuscleGroup(lastTrained, next)).toBe(true);
  });
});

describe('checkRecoveryStatus', () => {
  it('T-SAFE-02-04: correctly evaluates multiple muscle groups', () => {
    const lastTrainedMap = new Map([
      ['chest' as const, '2026-01-06T10:00:00Z'], // 24h ago
      ['legs' as const, '2026-01-04T10:00:00Z'], // 72h ago
      ['arms' as const, null], // never trained
    ]);
    const proposed = '2026-01-07T10:00:00Z';

    const status = checkRecoveryStatus(lastTrainedMap, proposed);

    expect(status.get('chest')).toBe(false); // 24h < 48h
    expect(status.get('legs')).toBe(true); // 72h ≥ 48h
    expect(status.get('arms')).toBe(true); // never trained
  });

  it('respects custom minimum hours', () => {
    const lastTrainedMap = new Map([['chest' as const, '2026-01-06T10:00:00Z']]);
    const proposed = '2026-01-07T10:00:00Z'; // 24h later

    const status24 = checkRecoveryStatus(lastTrainedMap, proposed, 24);
    const status48 = checkRecoveryStatus(lastTrainedMap, proposed, 48);

    expect(status24.get('chest')).toBe(true);
    expect(status48.get('chest')).toBe(false);
  });

  it('returns empty map for empty input', () => {
    const status = checkRecoveryStatus(new Map(), '2026-01-07T10:00:00Z');
    expect(status.size).toBe(0);
  });
});

describe('MINIMUM_RECOVERY_HOURS constant', () => {
  it('is set to 48 hours per 04-SAFETY §1.1', () => {
    expect(MINIMUM_RECOVERY_HOURS).toBe(48);
  });
});
