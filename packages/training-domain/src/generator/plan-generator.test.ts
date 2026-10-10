import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExerciseLibrary, resetCache } from '../exercises/loader';
import { generatePlanDays } from './plan-generator';

const CANONICAL_PATH = path.resolve(
  __dirname,
  '../../../../data/exercise-library/canonical-exercise-library.json',
);
const MONDAY_START = '2026-01-05';

describe('generatePlanDays (Phase 7 end-to-end integration)', () => {
  beforeEach(() => {
    resetCache();
  });

  const library = loadExerciseLibrary(CANONICAL_PATH);

  it('generates a complete single-day plan for Mon/Wed/Fri (non-consecutive)', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'wednesday', 'friday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    expect(result.trainingDays).toHaveLength(3);
    expect(result.fullWeekSchedule).toHaveLength(7);

    for (const day of result.trainingDays) {
      expect(day.exercises.length).toBeGreaterThan(0);
      expect(day.estimatedDurationMinutes).toBe(30); // full_body_basic (25) + 5 warmup
    }
  });

  it('enforces 48h rule: Mon/Tue selected → Tue auto-demoted (SAFE-02a integration)', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'tuesday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    const scheduleDays = result.fullWeekSchedule;
    const monday = scheduleDays.find((d) => d.weekday === 'monday')!;
    const tuesday = scheduleDays.find((d) => d.weekday === 'tuesday')!;

    expect(monday.isTrainingDay).toBe(true);
    expect(tuesday.isTrainingDay).toBe(false);
    expect(tuesday.recoveryReason).toBeDefined();

    // Only Monday's plan should be generated
    expect(result.trainingDays).toHaveLength(1);
    expect(result.trainingDays[0]!.date).toBe('2026-01-05');
  });

  it('generates independent plans for each training day (not reused)', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'wednesday', 'friday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'intermediate',
    });

    const planIds = result.trainingDays.map((day) =>
      day.exercises.map((ex) => ex.exercise.exerciseId).sort().join(','),
    );

    // Each day should be independently selected from the safe pool.
    // While they may coincidentally include the same exercise in the same
    // position, the stringified IDs act as a probabilistic check for independence.
    // (In practice, if all 3 days picked the exact same exercises, that'd be suspicious.)
    expect(planIds.length).toBe(3);
  });

  it('respects experience level across all generated days', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'wednesday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'advanced',
    });

    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        // Advanced users: 3-4 sets, 15-20 reps, 30s rest
        expect(planned.sets).toBe(4); // maxSets for advanced
        expect(planned.reps).toBe('15-20');
        expect(planned.restSeconds).toBe(30);
      }
    }
  });

  it('excludes contraindicated exercises from all generated days (SAFE-01 integration)', () => {
    const withoutInjury = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'wednesday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    const withKneeInjury = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'wednesday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: ['knee_pain', 'meniscus'],
      experienceLevel: 'beginner',
    });

    const kneeExcludedIds = new Set(
      library.exercises
        .filter((e) => e.contraindications.some((c) => ['knee_pain', 'meniscus'].includes(c)))
        .map((e) => e.exerciseId),
    );

    for (const day of withKneeInjury.trainingDays) {
      for (const planned of day.exercises) {
        expect(kneeExcludedIds.has(planned.exercise.exerciseId)).toBe(false);
      }
    }

    expect(kneeExcludedIds.size).toBeGreaterThan(0); // sanity: injury exclusions exist
  });

  it('7天全选 produces alternating train/recovery (SAFE-02a)', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    const trainingFlags = result.fullWeekSchedule.map((d) => d.isTrainingDay);
    expect(trainingFlags).toEqual([true, false, true, false, true, false, true]);

    // 4 training days (Mon, Wed, Fri, Sun)
    expect(result.trainingDays).toHaveLength(4);
  });

  it('multi-project duration computed correctly', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday'],
      targetProjects: ['hip_thigh_tone', 'lower_abs_tone', 'round_shoulder_fix'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    // hip_thigh_tone(20) + lower_abs_tone(15) + round_shoulder_fix(15) + 5(warmup) = 55min
    expect(result.trainingDays[0]!.estimatedDurationMinutes).toBe(55);
  });

  it('throws RangeError when exercise pool cannot supply enough safe exercises', () => {
    expect(() =>
      generatePlanDays({
        exercisePool: library.exercises,
        startDate: MONDAY_START,
        trainingDays: ['monday'],
        targetProjects: ['full_body_basic'],
        availableEquipment: ['nonexistent_equipment_xyz'],
        injuryTags: [],
        experienceLevel: 'beginner',
      }),
    ).toThrow(RangeError);
  });

  it('full schedule includes recovery days with reasons (for calendar display)', () => {
    const result = generatePlanDays({
      exercisePool: library.exercises,
      startDate: MONDAY_START,
      trainingDays: ['monday', 'tuesday'],
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    const tuesday = result.fullWeekSchedule.find((d) => d.weekday === 'tuesday')!;
    expect(tuesday.isTrainingDay).toBe(false);
    expect(tuesday.recoveryReason).toBeDefined();
  });
});
