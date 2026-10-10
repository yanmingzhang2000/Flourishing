import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExerciseLibrary, resetCache } from './loader';
import {
  excludeByIds,
  filterByCategory,
  filterByDifficulty,
  filterByEquipment,
  filterByMuscleGroup,
  filterByTargetProjects,
  findById,
} from './repository';

const CANONICAL_PATH = path.resolve(
  __dirname,
  '../../../../data/exercise-library/canonical-exercise-library.json',
);

// Exercises whose cover file is referenced but missing on disk.
// Documented in docs/TASK3_ALIGNMENT.md §7.3 - not handled in this task.
const KNOWN_MISSING_COVERS = ['standing_scapular_depression', 'supine_ball_scapular_slide'];

describe('loadExerciseLibrary', () => {
  beforeEach(() => {
    resetCache();
  });

  it('loads and validates all 69 approved canonical exercises', () => {
    const library = loadExerciseLibrary(CANONICAL_PATH);
    expect(library.exercises).toHaveLength(69);
    expect(library.libraryVersion).toBe('initial-2026-03-20');
  });

  it('converts snake_case canonical fields to camelCase contract fields', () => {
    const library = loadExerciseLibrary(CANONICAL_PATH);
    const first = library.exercises[0];
    expect(first).toBeDefined();
    expect(first).toHaveProperty('exerciseId');
    expect(first).toHaveProperty('nameEn');
    expect(first).toHaveProperty('muscleGroup');
    expect(first).toHaveProperty('targetProjects');
    expect(first).toHaveProperty('restSeconds');
    expect(first).toHaveProperty('alternativeExerciseIds');
  });

  it('normalizes cover image paths to /images/exercises/*', () => {
    const library = loadExerciseLibrary(CANONICAL_PATH);
    const withCover = library.exercises.filter((e) => e.media?.coverImage);
    expect(withCover.length).toBeGreaterThan(0);
    for (const exercise of withCover) {
      expect(exercise.media?.coverImage).toMatch(/^\/images\/exercises\/.+\.jpg$/);
    }
  });

  it('documents known missing cover files without blocking load (TASK3_ALIGNMENT §7.3)', () => {
    const library = loadExerciseLibrary(CANONICAL_PATH);
    for (const id of KNOWN_MISSING_COVERS) {
      const exercise = findById(library.exercises, id);
      expect(exercise).toBeDefined();
      // Loader validates JSON schema only, not file existence on disk.
      expect(exercise?.media?.coverImage).toBeTruthy();
    }
  });

  it('caches the result across repeated calls', () => {
    const first = loadExerciseLibrary(CANONICAL_PATH);
    const second = loadExerciseLibrary(CANONICAL_PATH);
    expect(first).toBe(second);
  });

  it('produces exercises that satisfy the contracts Exercise schema', () => {
    // Implicit: loadExerciseLibrary calls exerciseSchema.parse() internally.
    // If any of the 69 entries fail validation, this call throws.
    expect(() => loadExerciseLibrary(CANONICAL_PATH)).not.toThrow();
  });
});

describe('repository query functions', () => {
  const library = loadExerciseLibrary(CANONICAL_PATH);
  const { exercises } = library;

  it('filterByMuscleGroup returns only exercises matching primary/secondary group', () => {
    const result = filterByMuscleGroup(exercises, ['肱三头肌']);
    expect(result.length).toBeGreaterThan(0);
    for (const exercise of result) {
      const all = [...exercise.muscleGroup.primary, ...exercise.muscleGroup.secondary];
      expect(all).toContain('肱三头肌');
    }
  });

  it('filterByMuscleGroup returns empty array for empty input', () => {
    expect(filterByMuscleGroup(exercises, [])).toEqual([]);
  });

  it('filterByEquipment only returns exercises whose equipment is fully available', () => {
    const result = filterByEquipment(exercises, ['bodyweight']);
    expect(result.length).toBeGreaterThan(0);
    for (const exercise of result) {
      expect(exercise.equipment.every((eq) => eq === 'bodyweight')).toBe(true);
    }
  });

  it('filterByEquipment excludes exercises requiring unavailable equipment', () => {
    const result = filterByEquipment(exercises, ['bodyweight']);
    const requiresDumbbell = result.some((e) => e.equipment.includes('dumbbell_1kg'));
    expect(requiresDumbbell).toBe(false);
  });

  it('filterByDifficulty returns only exercises within range', () => {
    const result = filterByDifficulty(exercises, 1, 2);
    expect(result.length).toBeGreaterThan(0);
    for (const exercise of result) {
      expect(exercise.difficulty).toBeGreaterThanOrEqual(1);
      expect(exercise.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('filterByCategory returns only exercises matching category', () => {
    const warmups = filterByCategory(exercises, 'warmup');
    expect(warmups.length).toBeGreaterThan(0);
    for (const exercise of warmups) {
      expect(exercise.category).toBe('warmup');
    }
  });

  it('filterByTargetProjects returns exercises for the given project', () => {
    const result = filterByTargetProjects(exercises, ['tricep_tone']);
    expect(result.length).toBeGreaterThan(0);
    for (const exercise of result) {
      expect(exercise.targetProjects).toContain('tricep_tone');
    }
  });

  it('filterByTargetProjects returns empty array for empty input', () => {
    expect(filterByTargetProjects(exercises, [])).toEqual([]);
  });

  it('excludeByIds removes matching exercises and keeps the rest', () => {
    const toExclude = new Set([exercises[0]!.exerciseId]);
    const result = excludeByIds(exercises, toExclude);
    expect(result.length).toBe(exercises.length - 1);
    expect(findById(result, exercises[0]!.exerciseId)).toBeUndefined();
  });

  it('excludeByIds returns the same array reference when excludedIds is empty', () => {
    const result = excludeByIds(exercises, new Set());
    expect(result).toBe(exercises);
  });

  it('findById locates an exercise by its id', () => {
    const target = exercises[10]!;
    const found = findById(exercises, target.exerciseId);
    expect(found).toEqual(target);
  });

  it('findById returns undefined for unknown id', () => {
    expect(findById(exercises, 'nonexistent_exercise_id')).toBeUndefined();
  });
});
