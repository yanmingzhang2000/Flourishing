import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_DURATION_BUCKETS,
  getAllocation,
  getMidpointCounts,
  snapToBucket,
} from './exercise-selector';

describe('getAllocation (SAFE-04b)', () => {
  it('T-SAFE-04-sel-15: 15min → warmup 2-3, main 3-4, stretch 2, total 7-9', () => {
    const allocation = getAllocation(15);
    expect(allocation).toEqual({
      warmup: { min: 2, max: 3 },
      main: { min: 3, max: 4 },
      stretch: { min: 2, max: 2 },
      total: { min: 7, max: 9 },
    });
  });

  it('T-SAFE-04-sel-20: 20min → warmup 3, main 4-5, stretch 2, total 9-10', () => {
    const allocation = getAllocation(20);
    expect(allocation).toEqual({
      warmup: { min: 3, max: 3 },
      main: { min: 4, max: 5 },
      stretch: { min: 2, max: 2 },
      total: { min: 9, max: 10 },
    });
  });

  it('T-SAFE-04-sel-30: 30min → warmup 3, main 5-6, stretch 3, total 11-12', () => {
    const allocation = getAllocation(30);
    expect(allocation).toEqual({
      warmup: { min: 3, max: 3 },
      main: { min: 5, max: 6 },
      stretch: { min: 3, max: 3 },
      total: { min: 11, max: 12 },
    });
  });

  it('T-SAFE-04-sel-45: 45min → warmup 4, main 6-8, stretch 3, total 13-15', () => {
    const allocation = getAllocation(45);
    expect(allocation).toEqual({
      warmup: { min: 4, max: 4 },
      main: { min: 6, max: 8 },
      stretch: { min: 3, max: 3 },
      total: { min: 13, max: 15 },
    });
  });

  it('snaps non-exact durations to nearest bucket', () => {
    expect(getAllocation(16)).toEqual(getAllocation(15));
    expect(getAllocation(22)).toEqual(getAllocation(20));
    expect(getAllocation(28)).toEqual(getAllocation(30));
    expect(getAllocation(50)).toEqual(getAllocation(45));
  });
});

describe('snapToBucket', () => {
  it('snaps durations below 17.5 to 15', () => {
    expect(snapToBucket(10)).toBe(15);
    expect(snapToBucket(17)).toBe(15);
    expect(snapToBucket(17.4)).toBe(15);
  });

  it('snaps durations in [17.5, 25) to 20', () => {
    expect(snapToBucket(17.5)).toBe(20);
    expect(snapToBucket(20)).toBe(20);
    expect(snapToBucket(24.9)).toBe(20);
  });

  it('snaps durations in [25, 37.5) to 30', () => {
    expect(snapToBucket(25)).toBe(30);
    expect(snapToBucket(30)).toBe(30);
    expect(snapToBucket(37.4)).toBe(30);
  });

  it('snaps durations ≥37.5 to 45', () => {
    expect(snapToBucket(37.5)).toBe(45);
    expect(snapToBucket(45)).toBe(45);
    expect(snapToBucket(60)).toBe(45);
  });

  it('exact bucket values map to themselves', () => {
    for (const bucket of SUPPORTED_DURATION_BUCKETS) {
      expect(snapToBucket(bucket)).toBe(bucket);
    }
  });
});

describe('getMidpointCounts', () => {
  it('returns rounded midpoints for 15min allocation', () => {
    const allocation = getAllocation(15);
    expect(getMidpointCounts(allocation)).toEqual({ warmup: 3, main: 4, stretch: 2 });
  });

  it('returns rounded midpoints for 30min allocation', () => {
    const allocation = getAllocation(30);
    expect(getMidpointCounts(allocation)).toEqual({ warmup: 3, main: 6, stretch: 3 });
  });

  it('returns rounded midpoints for 45min allocation', () => {
    const allocation = getAllocation(45);
    expect(getMidpointCounts(allocation)).toEqual({ warmup: 4, main: 7, stretch: 3 });
  });
});
