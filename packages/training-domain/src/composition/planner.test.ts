import path from 'node:path';
import type { Exercise } from '@flourish/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExerciseLibrary, resetCache } from '../exercises/loader';
import { planDay } from './planner';

const CANONICAL_PATH = path.resolve(
  __dirname,
  '../../../../data/exercise-library/canonical-exercise-library.json',
);

describe('planDay (SAFE-04 single-day assembly)', () => {
  beforeEach(() => {
    resetCache();
  });

  const library = loadExerciseLibrary(CANONICAL_PATH);

  it('assembles a complete day plan for a single target project with bodyweight equipment', () => {
    const result = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    expect(result.warmup.length).toBeGreaterThan(0);
    expect(result.main.length).toBeGreaterThan(0);
    expect(result.stretch.length).toBeGreaterThan(0);
    // full_body_basic (25min) + 5min warmup = 30min
    expect(result.estimatedDurationMinutes).toBe(30);
  });

  it('respects experience-level sets/reps/rest for every planned exercise', () => {
    const result = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    for (const planned of [...result.warmup, ...result.main, ...result.stretch]) {
      expect(planned.sets).toBe(3); // beginner maxSets
      expect(planned.reps).toBe('8-12'); // beginner reps range
      expect(planned.restSeconds).toBe(60); // beginner rest
    }
  });

  it('excludes contraindicated exercises from the final plan (SAFE-01 integration)', () => {
    const withoutInjury = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'intermediate',
    });

    const withKneeInjury = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: ['knee_pain', 'meniscus'],
      experienceLevel: 'intermediate',
    });

    const kneeExcludedIds = new Set(
      library.exercises
        .filter((e) => e.contraindications.some((c) => ['knee_pain', 'meniscus'].includes(c)))
        .map((e) => e.exerciseId),
    );

    const allPlannedIds = [
      ...withKneeInjury.warmup,
      ...withKneeInjury.main,
      ...withKneeInjury.stretch,
    ].map((p) => p.exercise.exerciseId);

    for (const id of allPlannedIds) {
      expect(kneeExcludedIds.has(id)).toBe(false);
    }

    // Sanity: the unconstrained plan is a superset candidate pool (not necessarily
    // identical picks, but injury filtering must have had candidates to exclude
    // for this assertion to be meaningful).
    expect(kneeExcludedIds.size).toBeGreaterThan(0);
    expect(withoutInjury.main.length).toBeGreaterThan(0);
  });

  it('filters out exercises requiring unavailable equipment', () => {
    const result = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'beginner',
    });

    for (const planned of [...result.warmup, ...result.main, ...result.stretch]) {
      expect(planned.exercise.equipment.every((eq) => eq === 'bodyweight')).toBe(true);
    }
  });

  it('falls back to conservative defaults when experienceLevel is null', () => {
    const result = planDay({
      exercisePool: library.exercises,
      targetProjects: ['full_body_basic'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: null,
    });

    for (const planned of [...result.warmup, ...result.main, ...result.stretch]) {
      expect(planned.sets).toBe(2);
      expect(planned.reps).toBe('8-12');
    }
  });

  it('throws RangeError when no safe exercises remain for a required category', () => {
    expect(() =>
      planDay({
        exercisePool: library.exercises,
        targetProjects: ['full_body_basic'],
        availableEquipment: ['nonexistent_equipment_xyz'],
        injuryTags: [],
        experienceLevel: 'beginner',
      }),
    ).toThrow(RangeError);
  });

  it('computes duration using the multi-project formula (PRODUCT_LOGIC §2.2.3)', () => {
    const result = planDay({
      exercisePool: library.exercises,
      targetProjects: ['hip_thigh_tone', 'lower_abs_tone', 'round_shoulder_fix'],
      availableEquipment: ['bodyweight'],
      injuryTags: [],
      experienceLevel: 'intermediate',
    });

    // 20 + 15 + 15 + 5 (warmup) = 55min
    expect(result.estimatedDurationMinutes).toBe(55);
  });
});

describe('planDay difficultyBias (SAFE-03b/c ladder step 3: 换高级/简单动作)', () => {
  beforeEach(() => {
    resetCache();
  });

  function makeExercise(
    id: string,
    category: Exercise['category'],
    difficulty: number,
  ): Exercise {
    return {
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
    };
  }

  // 30min bucket picks midpoint counts: warmup 3, main 6, stretch 3.
  // Main pool order = array order, so 6× D1 fill the picks and 3× D2
  // remain as swap targets for a +1 bias.
  const pool = [
    ...['w1', 'w2', 'w3', 'w4'].map((id) => makeExercise(id, 'warmup', 1)),
    ...['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => makeExercise(id, 'strength', 1)),
    ...['m7', 'm8', 'm9'].map((id) => makeExercise(id, 'strength', 2)),
    ...['s1', 's2', 's3', 's4'].map((id) => makeExercise(id, 'stretch', 1)),
  ];

  const baseInput = {
    exercisePool: pool,
    targetProjects: ['full_body_basic'],
    availableEquipment: ['bodyweight'],
    injuryTags: [],
    experienceLevel: 'beginner' as const,
  };

  it('+1 bias swaps main exercises up exactly one difficulty level (deterministically)', () => {
    const base = planDay(baseInput);
    const biased = planDay({ ...baseInput, difficultyBias: 1 });

    expect(biased.main).toHaveLength(base.main.length);

    // Exactly one level up, never more; unswapped exercises stay put
    base.main.forEach((original, index) => {
      const swapped = biased.main[index]!;
      expect([original.exercise.difficulty, original.exercise.difficulty + 1]).toContain(
        swapped.exercise.difficulty,
      );
      if (swapped.exercise.exerciseId !== original.exercise.exerciseId) {
        expect(swapped.exercise.difficulty).toBe(original.exercise.difficulty + 1);
      }
    });

    // With 6× D1 picked and 3× D2 available as targets, swaps must occur
    const swappedIds = base.main
      .filter((original, index) => biased.main[index]!.exercise.exerciseId !== original.exercise.exerciseId)
      .map((original) => original.exercise.exerciseId);
    expect(swappedIds.length).toBeGreaterThanOrEqual(1);

    // Warmup/stretch untouched (bias targets main training only)
    expect(biased.warmup.map((p) => p.exercise.exerciseId)).toEqual(
      base.warmup.map((p) => p.exercise.exerciseId),
    );
    expect(biased.stretch.map((p) => p.exercise.exerciseId)).toEqual(
      base.stretch.map((p) => p.exercise.exerciseId),
    );

    // Single-variable rule: volume metadata is unchanged by a difficulty bias
    for (const planned of [...biased.warmup, ...biased.main, ...biased.stretch]) {
      expect(planned.sets).toBe(3);
      expect(planned.reps).toBe('8-12');
    }

    // Determinism: identical input → identical selection
    const again = planDay({ ...baseInput, difficultyBias: 1 });
    expect(again.main.map((p) => p.exercise.exerciseId)).toEqual(
      biased.main.map((p) => p.exercise.exerciseId),
    );
  });

  it('-1 bias never drops below difficulty 1', () => {
    const biased = planDay({ ...baseInput, difficultyBias: -1 });
    for (const planned of biased.main) {
      expect(planned.exercise.difficulty).toBeGreaterThanOrEqual(1);
    }
    // Picked mains are already D1 → nothing can move down
    const base = planDay(baseInput);
    expect(biased.main.map((p) => p.exercise.exerciseId)).toEqual(
      base.main.map((p) => p.exercise.exerciseId),
    );
  });

  it('+1 bias respects the experience ceiling (beginner must stay ≤ D2)', () => {
    // All picked mains are D2 → target D3 exceeds the beginner range
    const highPool = [
      ...['w1', 'w2', 'w3', 'w4'].map((id) => makeExercise(id, 'warmup', 1)),
      ...['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].map((id) => makeExercise(id, 'strength', 2)),
      ...['m7', 'm8'].map((id) => makeExercise(id, 'strength', 3)),
      ...['s1', 's2', 's3', 's4'].map((id) => makeExercise(id, 'stretch', 1)),
    ];
    const biased = planDay({ ...baseInput, exercisePool: highPool, difficultyBias: 1 });
    for (const planned of biased.main) {
      expect(planned.exercise.difficulty).toBeLessThanOrEqual(2);
    }
  });
});
