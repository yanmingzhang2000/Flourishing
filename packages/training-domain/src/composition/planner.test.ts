import path from 'node:path';
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
