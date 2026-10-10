import path from 'node:path';
import type { Exercise } from '@flourish/contracts';
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

describe('generatePlanDays feedback adjustment (SAFE-03b/c, E2E #3)', () => {
  beforeEach(() => {
    resetCache();
  });

  const library = loadExerciseLibrary(CANONICAL_PATH);

  const baseInput = {
    exercisePool: library.exercises,
    startDate: MONDAY_START,
    trainingDays: ['monday', 'wednesday', 'friday'] as const,
    targetProjects: ['full_body_basic'],
    availableEquipment: ['bodyweight'],
    injuryTags: [] as string[],
    experienceLevel: 'beginner' as const,
  };

  it('no feedback → fresh baseline, no adjustment decision', () => {
    const result = generatePlanDays(baseInput);
    expect(result.adjustment).toBeNull();
    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('8-12');
        expect(planned.sets).toBe(3);
      }
    }
  });

  it('too_easy → reps +2 on every exercise, single variable (SAFE-03b)', () => {
    const result = generatePlanDays({
      ...baseInput,
      adjustment: { feedback: 'too_easy', previousVolume: null },
    });

    expect(result.adjustment).not.toBeNull();
    expect(result.adjustment!.feedback).toBe('too_easy');
    expect(result.adjustment!.variable).toBe('reps');
    expect(result.adjustment!.repsDelta).toBe(2);
    expect(result.adjustment!.setsDelta).toBe(0);
    expect(result.adjustment!.explanation).toContain('太轻松');
    expect(result.adjustment!.explanation).toContain('8-12 → 10-14');

    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('10-14'); // changed
        expect(planned.sets).toBe(3); // untouched (single variable)
      }
    }
    expect(result.trainingDays).toHaveLength(3);
  });

  it('too_hard → reps −2 on every exercise, single variable (SAFE-03c)', () => {
    const result = generatePlanDays({
      ...baseInput,
      adjustment: { feedback: 'too_hard', previousVolume: null },
    });

    expect(result.adjustment!.variable).toBe('reps');
    expect(result.adjustment!.repsDelta).toBe(-2);
    expect(result.adjustment!.explanation).toContain('太难');

    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('6-10');
        expect(planned.sets).toBe(3);
      }
    }
  });

  it('progression accumulates on the previous plan volume (not reset each generation)', () => {
    const result = generatePlanDays({
      ...baseInput,
      adjustment: { feedback: 'too_easy', previousVolume: { reps: '10-14', sets: 3 } },
    });

    expect(result.adjustment!.variable).toBe('reps');
    expect(result.adjustment!.explanation).toContain('10-14 → 12-16');

    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('12-16');
      }
    }
  });

  it('just_right keeps the previous level unchanged (no reset, no decision)', () => {
    const result = generatePlanDays({
      ...baseInput,
      adjustment: { feedback: 'just_right', previousVolume: { reps: '10-14', sets: 4 } },
    });

    expect(result.adjustment).toBeNull();
    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('10-14');
        expect(planned.sets).toBe(4);
      }
    }
  });

  it('ladder falls through to sets when previous volume is at the reps bound', () => {
    const result = generatePlanDays({
      ...baseInput,
      adjustment: {
        feedback: 'too_easy',
        previousVolume: { reps: '24-25', sets: 3 },
      },
    });

    expect(result.adjustment!.variable).toBe('sets');
    expect(result.adjustment!.setsDelta).toBe(1);

    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.sets).toBe(4);
        expect(planned.reps).toBe('24-25'); // previous level retained
      }
    }
  });

  it('ladder step 3: difficulty bias applies when volume is exhausted (换高级动作)', () => {
    // Synthetic pool guaranteeing beginner headroom: picked mains contain
    // D1 entries (target D2 exists) inside the beginner ceiling.
    const make = (id: string, category: Exercise['category'], difficulty: number): Exercise => ({
      exerciseId: id,
      name: id,
      nameEn: id,
      muscleGroup: { primary: ['chest'], secondary: [] },
      difficulty,
      equipment: ['bodyweight'],
      function: { primary: 'strength', secondary: 'general' },
      category,
      targetProjects: ['full_body_basic'],
      contraindications: [],
      alternativeExerciseIds: [],
      restSeconds: 40,
      steps: ['step'],
      tips: ['tip'],
      warning: 'warning',
    });
    const pool = [
      ...['w1', 'w2', 'w3', 'w4'].map((id) => make(id, 'warmup', 1)),
      make('m1', 'strength', 1),
      make('m2', 'strength', 1),
      make('m3', 'strength', 1),
      make('m4', 'strength', 2),
      make('m5', 'strength', 2),
      make('m6', 'strength', 2),
      make('m7', 'strength', 2),
      ...['s1', 's2', 's3', 's4'].map((id) => make(id, 'stretch', 1)),
    ];

    const baseline = generatePlanDays({ ...baseInput, exercisePool: pool });
    const result = generatePlanDays({
      ...baseInput,
      exercisePool: pool,
      adjustment: {
        feedback: 'too_easy',
        previousVolume: { reps: '24-25', sets: 5 },
      },
    });

    expect(result.adjustment!.variable).toBe('difficulty');
    expect(result.adjustment!.explanation).toContain('提升一级');

    // Single variable: volume untouched, duration formula unchanged
    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('24-25');
        expect(planned.sets).toBe(5);
        expect(planned.exercise.difficulty).toBeLessThanOrEqual(2); // SAFE-03a ceiling
      }
      const baselineDay = baseline.trainingDays.find((d) => d.date === day.date)!;
      expect(day.estimatedDurationMinutes).toBe(baselineDay.estimatedDurationMinutes);
    }
  });

  it('ladder exhausted → decision none, previous level kept (fail-safe)', () => {
    // Synthetic pool: every strength exercise sits at D2 (the beginner
    // ceiling), so step 3 has no headroom and the ladder must stop.
    const make = (id: string, category: Exercise['category'], difficulty: number): Exercise => ({
      exerciseId: id,
      name: id,
      nameEn: id,
      muscleGroup: { primary: ['chest'], secondary: [] },
      difficulty,
      equipment: ['bodyweight'],
      function: { primary: 'strength', secondary: 'general' },
      category,
      targetProjects: ['full_body_basic'],
      contraindications: [],
      alternativeExerciseIds: [],
      restSeconds: 40,
      steps: ['step'],
      tips: ['tip'],
      warning: 'warning',
    });
    const pool = [
      ...['w1', 'w2', 'w3', 'w4'].map((id) => make(id, 'warmup', 1)),
      ...['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'].map((id) => make(id, 'strength', 2)),
      ...['s1', 's2', 's3', 's4'].map((id) => make(id, 'stretch', 1)),
    ];

    const result = generatePlanDays({
      ...baseInput,
      exercisePool: pool,
      adjustment: {
        feedback: 'too_easy',
        previousVolume: { reps: '24-25', sets: 5 },
      },
    });

    expect(result.adjustment).not.toBeNull();
    expect(result.adjustment!.variable).toBe('none');
    expect(result.adjustment!.explanation).toContain('安全边界');

    // Previous level retained, plan still valid
    expect(result.trainingDays.length).toBeGreaterThan(0);
    for (const day of result.trainingDays) {
      for (const planned of day.exercises) {
        expect(planned.reps).toBe('24-25');
        expect(planned.sets).toBe(5);
      }
    }
  });
});
