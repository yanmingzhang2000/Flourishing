import { describe, expect, it } from 'vitest';
import {
  CAPACITY_TOLERANCE_MINUTES,
  FIXED_WARMUP_MINUTES,
  TARGET_PROJECT_BASE_MINUTES,
  calculateSessionDuration,
  getCapacityRange,
  isWithinCapacity,
} from './duration-calculator';

describe('calculateSessionDuration (SAFE-04a)', () => {
  it('single project: 拜拜肉 (15min) + 5min warmup = 20min', () => {
    expect(calculateSessionDuration(['tricep_tone'])).toBe(20);
  });

  it('two projects: 拜拜肉(15) + 下腹(15) + 5min warmup = 35min', () => {
    expect(calculateSessionDuration(['tricep_tone', 'lower_abs_tone'])).toBe(35);
  });

  it('three projects: 假胯宽(20) + 下腹(15) + 圆肩(15) + 5min warmup = 55min', () => {
    expect(
      calculateSessionDuration(['hip_thigh_tone', 'lower_abs_tone', 'round_shoulder_fix']),
    ).toBe(55);
  });

  it('deduplicates repeated project IDs', () => {
    const withDupe = calculateSessionDuration(['tricep_tone', 'tricep_tone']);
    const withoutDupe = calculateSessionDuration(['tricep_tone']);
    expect(withDupe).toBe(withoutDupe);
  });

  it('empty project list returns just the fixed warmup', () => {
    expect(calculateSessionDuration([])).toBe(FIXED_WARMUP_MINUTES);
  });

  it('throws RangeError for unknown target project id', () => {
    expect(() => calculateSessionDuration(['unknown_project'])).toThrow(RangeError);
  });

  it('covers all 6 canonical target projects with correct base minutes', () => {
    expect(TARGET_PROJECT_BASE_MINUTES).toEqual({
      tricep_tone: 15,
      hip_thigh_tone: 20,
      lower_abs_tone: 15,
      trap_relax: 10,
      round_shoulder_fix: 15,
      full_body_basic: 25,
    });
  });
});

describe('isWithinCapacity (SAFE-04)', () => {
  it('T-SAFE-04-01: 30min target — 25-35min passes, outside fails (旧债修复验证)', () => {
    expect(isWithinCapacity(30, 30)).toBe(true);
    expect(isWithinCapacity(25, 30)).toBe(true); // lower boundary
    expect(isWithinCapacity(35, 30)).toBe(true); // upper boundary
    expect(isWithinCapacity(24, 30)).toBe(false);
    expect(isWithinCapacity(36, 30)).toBe(false);
    // 旧债修复：5分钟的训练绝不能通过 30分钟目标的容量校验
    expect(isWithinCapacity(5, 30)).toBe(false);
  });

  it('T-SAFE-04-02: 15min target — 10-20min passes', () => {
    expect(isWithinCapacity(15, 15)).toBe(true);
    expect(isWithinCapacity(10, 15)).toBe(true);
    expect(isWithinCapacity(20, 15)).toBe(true);
    expect(isWithinCapacity(9, 15)).toBe(false);
    expect(isWithinCapacity(21, 15)).toBe(false);
  });

  it('T-SAFE-04-03: 45min target — 40-50min passes', () => {
    expect(isWithinCapacity(45, 45)).toBe(true);
    expect(isWithinCapacity(40, 45)).toBe(true);
    expect(isWithinCapacity(50, 45)).toBe(true);
    expect(isWithinCapacity(39, 45)).toBe(false);
    expect(isWithinCapacity(51, 45)).toBe(false);
  });

  it('returns true (permissive) when user has not set a target', () => {
    expect(isWithinCapacity(5, null)).toBe(true);
    expect(isWithinCapacity(999, null)).toBe(true);
  });

  it('respects custom tolerance', () => {
    expect(isWithinCapacity(32, 30, 10)).toBe(true);
    expect(isWithinCapacity(32, 30, 1)).toBe(false);
  });

  it('default tolerance is ±5 minutes per TASK3_ALIGNMENT §2.5', () => {
    expect(CAPACITY_TOLERANCE_MINUTES).toBe(5);
  });
});

describe('getCapacityRange', () => {
  it('returns [25, 35] for 30min target with default tolerance', () => {
    expect(getCapacityRange(30)).toEqual({ min: 25, max: 35 });
  });

  it('returns [10, 20] for 15min target', () => {
    expect(getCapacityRange(15)).toEqual({ min: 10, max: 20 });
  });

  it('returns [40, 50] for 45min target', () => {
    expect(getCapacityRange(45)).toEqual({ min: 40, max: 50 });
  });

  it('clamps minimum to 0 (never negative)', () => {
    expect(getCapacityRange(3, 5)).toEqual({ min: 0, max: 8 });
  });

  it('respects custom tolerance', () => {
    expect(getCapacityRange(30, 10)).toEqual({ min: 20, max: 40 });
  });
});
