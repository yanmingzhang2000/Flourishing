import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadExerciseLibrary, resetCache } from '../exercises/loader';
import { findById } from '../exercises/repository';
import {
  CONTRAINDICATION_TAGS,
  INJURY_OPTION_TAG_MAP,
  mapInjuryOptionsToTags,
} from './contraindication-rules';
import { filterSafeExercises, getExcludedExercises } from './exclusions';

const CANONICAL_PATH = path.resolve(
  __dirname,
  '../../../../data/exercise-library/canonical-exercise-library.json',
);

describe('mapInjuryOptionsToTags', () => {
  it('maps each of the 6 user injury options to its documented tags', () => {
    expect(mapInjuryOptionsToTags(['肩'])).toEqual(
      expect.arrayContaining(['shoulder_impingement', 'rotator_cuff']),
    );
    expect(mapInjuryOptionsToTags(['肘'])).toEqual(['elbow_pain']);
    expect(mapInjuryOptionsToTags(['腕'])).toEqual(['wrist_pain']);
    expect(mapInjuryOptionsToTags(['腰'])).toEqual(
      expect.arrayContaining(['lower_back', 'sciatica']),
    );
    expect(mapInjuryOptionsToTags(['膝'])).toEqual(
      expect.arrayContaining(['knee_pain', 'meniscus']),
    );
    expect(mapInjuryOptionsToTags(['颈'])).toEqual(['neck_pain']);
  });

  it('takes the union of tags when multiple injuries are selected', () => {
    const tags = mapInjuryOptionsToTags(['肩', '膝']);
    expect(new Set(tags)).toEqual(
      new Set(['shoulder_impingement', 'rotator_cuff', 'knee_pain', 'meniscus']),
    );
  });

  it('deduplicates tags shared across injuries', () => {
    const tags = mapInjuryOptionsToTags(['肩', '肩']);
    expect(tags).toEqual(expect.arrayContaining(['shoulder_impingement', 'rotator_cuff']));
    expect(tags).toHaveLength(2);
  });

  it('returns an empty array for no injuries', () => {
    expect(mapInjuryOptionsToTags([])).toEqual([]);
  });

  it('ignores unknown/unmapped options without throwing', () => {
    expect(mapInjuryOptionsToTags(['不存在的选项'])).toEqual([]);
  });

  it('every mapped tag is part of the documented controlled vocabulary', () => {
    const allMapped = Object.values(INJURY_OPTION_TAG_MAP).flat();
    for (const tag of allMapped) {
      expect(CONTRAINDICATION_TAGS).toContain(tag);
    }
  });
});

describe('getExcludedExercises / filterSafeExercises (SAFE-01, 100% accuracy)', () => {
  const library = loadExerciseLibrary(CANONICAL_PATH);
  const { exercises } = library;

  beforeEach(() => {
    resetCache();
  });

  it('T-SAFE-01-01: shoulder injury excludes all exercises tagged shoulder_impingement/rotator_cuff', () => {
    const tags = mapInjuryOptionsToTags(['肩']);
    const result = getExcludedExercises(exercises, tags);

    const expectedExcluded = exercises.filter((e) =>
      e.contraindications.some((c) => tags.includes(c)),
    );

    expect(result.excludedIds.size).toBe(expectedExcluded.length);
    for (const exercise of expectedExcluded) {
      expect(result.excludedIds.has(exercise.exerciseId)).toBe(true);
    }
    // 100% accuracy: no excluded exercise should remain in safeExercises
    for (const exercise of result.safeExercises) {
      expect(exercise.contraindications.some((c) => tags.includes(c))).toBe(false);
    }
  });

  it('T-SAFE-01-02: knee injury excludes all exercises tagged knee_pain/meniscus', () => {
    const tags = mapInjuryOptionsToTags(['膝']);
    const result = getExcludedExercises(exercises, tags);

    const expectedExcluded = exercises.filter((e) =>
      e.contraindications.some((c) => tags.includes(c)),
    );

    expect(result.excludedIds.size).toBe(expectedExcluded.length);
    expect(result.excludedIds.size).toBeGreaterThan(0);
    for (const exercise of result.safeExercises) {
      expect(exercise.contraindications.includes('knee_pain')).toBe(false);
      expect(exercise.contraindications.includes('meniscus')).toBe(false);
    }
  });

  it('T-SAFE-01-03: multiple injuries combine via union (shoulder ∪ knee)', () => {
    const shoulderTags = mapInjuryOptionsToTags(['肩']);
    const kneeTags = mapInjuryOptionsToTags(['膝']);
    const combinedTags = mapInjuryOptionsToTags(['肩', '膝']);

    const shoulderResult = getExcludedExercises(exercises, shoulderTags);
    const kneeResult = getExcludedExercises(exercises, kneeTags);
    const combinedResult = getExcludedExercises(exercises, combinedTags);

    // Union: combined excluded set must be a superset of (shoulder ∪ knee)
    const expectedUnion = new Set([...shoulderResult.excludedIds, ...kneeResult.excludedIds]);
    expect(combinedResult.excludedIds).toEqual(expectedUnion);

    // Sanity: combined must exclude at least as many as either alone
    expect(combinedResult.excludedIds.size).toBeGreaterThanOrEqual(shoulderResult.excludedIds.size);
    expect(combinedResult.excludedIds.size).toBeGreaterThanOrEqual(kneeResult.excludedIds.size);
  });

  it('T-SAFE-01-04: no injuries selected excludes nothing (never over-exclude)', () => {
    const result = getExcludedExercises(exercises, []);
    expect(result.excludedIds.size).toBe(0);
    expect(result.safeExercises).toHaveLength(exercises.length);
    expect(result.safeExercises).toBe(exercises);
  });

  it('T-SAFE-01-05: all 6 injury option types produce correct, non-empty tag mappings', () => {
    const allOptions = Object.keys(INJURY_OPTION_TAG_MAP);
    expect(allOptions).toHaveLength(6);

    for (const option of allOptions) {
      const tags = mapInjuryOptionsToTags([option]);
      expect(tags.length).toBeGreaterThan(0);

      const result = getExcludedExercises(exercises, tags);
      // Every excluded exercise must actually contain one of the tags.
      for (const exerciseId of result.excludedIds) {
        const exercise = findById(exercises, exerciseId);
        expect(exercise).toBeDefined();
        expect(exercise?.contraindications.some((c) => tags.includes(c))).toBe(true);
      }
    }
  });

  it('filterSafeExercises returns the same result as getExcludedExercises().safeExercises', () => {
    const tags = mapInjuryOptionsToTags(['腰']);
    const direct = filterSafeExercises(exercises, tags);
    const viaFull = getExcludedExercises(exercises, tags).safeExercises;
    expect(direct).toEqual(viaFull);
  });

  it('reasons map traces which tag triggered each exclusion', () => {
    const tags = mapInjuryOptionsToTags(['颈']);
    const result = getExcludedExercises(exercises, tags);
    for (const [exerciseId, matchedTags] of Object.entries(result.reasons)) {
      expect(result.excludedIds.has(exerciseId)).toBe(true);
      expect(matchedTags.length).toBeGreaterThan(0);
      for (const tag of matchedTags) {
        expect(tags).toContain(tag);
      }
    }
  });
});
