/**
 * EVAL_SET C-01 / C-02 / C-03 regression tests for composition.ts
 *
 * All cases use minimal in-memory exercise stubs — no database, no file I/O.
 */
import { describe, expect, it } from 'vitest';
import {
  assembleTrainingDay,
  checkEquipmentSubset,
  detectOverlaps,
  ExerciseLibraryLike,
} from './composition';
import { CanonicalExercise, NormalizedProfile } from '../exercise-library/types';

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

const baseExercise = (overrides: Partial<CanonicalExercise> = {}): CanonicalExercise => ({
  exercise_id: 'stub_exercise',
  name: '测试动作',
  name_en: 'Stub Exercise',
  muscle_group: { primary: ['肱三头肌'], secondary: [] },
  difficulty: 1,
  equipment: ['bodyweight'],
  function: { primary: '紧致', secondary: '激活' },
  category: 'strength',
  target_projects: ['tricep_tone'],
  contraindications: [],
  alternative_exercise_ids: [],
  review_status: 'approved',
  rest_seconds: 40,
  steps: ['执行动作'],
  tips: ['保持稳定'],
  warning: '疼痛即停止。',
  ...overrides,
});

const makeLibrary = (exercises: CanonicalExercise[]): ExerciseLibraryLike => ({
  exercises,
  library_version: 'test-v1',
});

const baseProfile: NormalizedProfile = {
  experience: 'zero',
  injuries: [],
  equipment: ['bodyweight'],
  selected_projects: ['tricep_tone'],
};

// ---------------------------------------------------------------------------
// detectOverlaps
// ---------------------------------------------------------------------------
describe('detectOverlaps (C-01 detection)', () => {
  it('returns empty when no full-body project is present', () => {
    expect(detectOverlaps(['tricep_tone', 'lower_abs_tone'])).toHaveLength(0);
  });

  it('detects overlap between full_body_basic and tricep_tone (shared: 肱三头肌)', () => {
    const warnings = detectOverlaps(['full_body_basic', 'tricep_tone']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].fullBodyProject).toBe('full_body_basic');
    expect(warnings[0].localProject).toBe('tricep_tone');
    expect(warnings[0].sharedMuscles).toContain('肱三头肌');
  });

  it('detects overlap between full_body_basic and hip_thigh_tone (shared: 臀大肌 etc.)', () => {
    const warnings = detectOverlaps(['full_body_basic', 'hip_thigh_tone']);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    const shared = warnings.flatMap(w => w.sharedMuscles);
    expect(shared.some(m => ['臀大肌', '股四头肌'].includes(m))).toBe(true);
  });

  it('returns no overlap for full_body_basic + trap_relax (no shared muscles)', () => {
    const warnings = detectOverlaps(['full_body_basic', 'trap_relax']);
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// assembleTrainingDay – C-02: daily combination
// ---------------------------------------------------------------------------
describe('assembleTrainingDay – C-02 (daily combination default)', () => {
  it('includes strength exercises from both projects when no overlap', () => {
    const library = makeLibrary([
      baseExercise({ exercise_id: 'tricep_ex', target_projects: ['tricep_tone'], category: 'strength' }),
      baseExercise({
        exercise_id: 'abs_ex',
        target_projects: ['lower_abs_tone'],
        category: 'strength',
        muscle_group: { primary: ['腹直肌'], secondary: [] },
      }),
    ]);
    const profile: NormalizedProfile = { ...baseProfile, selected_projects: ['tricep_tone', 'lower_abs_tone'] };
    const result = assembleTrainingDay(['tricep_tone', 'lower_abs_tone'], profile, library);

    // C-02: both projects should appear in a single day
    expect(result.exercises.length).toBeGreaterThanOrEqual(2);
    expect(result.meta.included).toContain('tricep_tone');
    expect(result.meta.included).toContain('lower_abs_tone');
    expect(result.meta.deduplicated).toHaveLength(0);
  });

  it('places exercises from multiple projects into one day', () => {
    const library = makeLibrary([
      baseExercise({ exercise_id: 'ex_tricep', target_projects: ['tricep_tone'], category: 'strength' }),
      baseExercise({
        exercise_id: 'ex_abs',
        target_projects: ['lower_abs_tone'],
        category: 'strength',
        muscle_group: { primary: ['腹直肌'], secondary: [] },
      }),
    ]);
    const profile: NormalizedProfile = { ...baseProfile, selected_projects: ['tricep_tone', 'lower_abs_tone'] };
    const result = assembleTrainingDay(['tricep_tone', 'lower_abs_tone'], profile, library);
    const ids = result.exercises.map(e => e.exerciseId);
    expect(ids).toContain('ex_tricep');
    expect(ids).toContain('ex_abs');
  });
});

// ---------------------------------------------------------------------------
// assembleTrainingDay – C-01: full_body + local deduplication
// ---------------------------------------------------------------------------
describe('assembleTrainingDay – C-01 (full_body deduplication)', () => {
  it('suppresses tricep_tone strength exercise when combined with full_body_basic', () => {
    const library = makeLibrary([
      // full_body strength exercise (trains 肱三头肌 among others)
      baseExercise({
        exercise_id: 'fb_strength',
        target_projects: ['full_body_basic'],
        category: 'strength',
        muscle_group: { primary: ['肱三头肌', '股四头肌'], secondary: [] },
      }),
      // tricep_tone strength exercise (trains same 肱三头肌 → should be suppressed)
      baseExercise({
        exercise_id: 'tricep_strength',
        target_projects: ['tricep_tone'],
        category: 'strength',
        muscle_group: { primary: ['肱三头肌'], secondary: [] },
      }),
    ]);
    const profile: NormalizedProfile = {
      ...baseProfile,
      selected_projects: ['full_body_basic', 'tricep_tone'],
    };
    const result = assembleTrainingDay(['full_body_basic', 'tricep_tone'], profile, library);
    expect(result.meta.deduplicated).toContain('tricep_tone');
    expect(result.meta.included).not.toContain('tricep_tone');
    // The full_body exercise itself should still be present
    expect(result.exercises.some(e => e.exerciseId === 'fb_strength')).toBe(true);
  });

  it('still includes warmup and cooldown for deduplicated projects (C-01)', () => {
    const library = makeLibrary([
      baseExercise({ exercise_id: 'fb_strength', target_projects: ['full_body_basic'], category: 'strength', muscle_group: { primary: ['肱三头肌'], secondary: [] } }),
      baseExercise({ exercise_id: 'tricep_strength', target_projects: ['tricep_tone'], category: 'strength', muscle_group: { primary: ['肱三头肌'], secondary: [] } }),
      baseExercise({ exercise_id: 'tricep_warmup', target_projects: ['tricep_tone'], category: 'warmup', muscle_group: { primary: ['肱三头肌'], secondary: [] } }),
      baseExercise({ exercise_id: 'tricep_stretch', target_projects: ['tricep_tone'], category: 'stretch', muscle_group: { primary: ['肱三头肌'], secondary: [] } }),
    ]);
    const profile: NormalizedProfile = { ...baseProfile, selected_projects: ['full_body_basic', 'tricep_tone'] };
    const result = assembleTrainingDay(['full_body_basic', 'tricep_tone'], profile, library);
    // Warmup and cooldown should still include tricep_tone content
    expect(result.warmup.some(e => e.id === 'tricep_warmup')).toBe(true);
    expect(result.cooldown.some(e => e.id === 'tricep_stretch')).toBe(true);
  });

  it('does not deduplicate non-overlapping local project (trap_relax)', () => {
    const library = makeLibrary([
      baseExercise({ exercise_id: 'fb_ex', target_projects: ['full_body_basic'], category: 'strength', muscle_group: { primary: ['股四头肌'], secondary: [] } }),
      baseExercise({ exercise_id: 'trap_ex', target_projects: ['trap_relax'], category: 'strength', muscle_group: { primary: ['斜方肌上束'], secondary: [] } }),
    ]);
    const profile: NormalizedProfile = { ...baseProfile, selected_projects: ['full_body_basic', 'trap_relax'] };
    const result = assembleTrainingDay(['full_body_basic', 'trap_relax'], profile, library);
    expect(result.meta.deduplicated).not.toContain('trap_relax');
    expect(result.meta.included).toContain('trap_relax');
  });

  it('records overlap warnings in meta', () => {
    const library = makeLibrary([
      baseExercise({ exercise_id: 'fb_ex', target_projects: ['full_body_basic'], category: 'strength', muscle_group: { primary: ['肱三头肌'], secondary: [] } }),
    ]);
    const profile: NormalizedProfile = { ...baseProfile, selected_projects: ['full_body_basic', 'tricep_tone'] };
    const result = assembleTrainingDay(['full_body_basic', 'tricep_tone'], profile, library);
    expect(result.meta.overlapWarnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkEquipmentSubset – C-03
// ---------------------------------------------------------------------------
describe('checkEquipmentSubset (C-03)', () => {
  const makeDay = (exerciseIds: string[], equipment: string[]): Parameters<typeof checkEquipmentSubset>[0] =>
    exerciseIds.map(id => ({
      exerciseId: id,
      exercise: {
        id,
        name: id,
        category: 'strength' as const,
        primary_muscle: '肱三头肌',
        equipment,
        difficulty: 'beginner' as const,
        sets: 2,
        reps: 12,
        rest_between_set: 40,
        rhythm: '',
        description: '',
        steps: [],
        tips: '',
        warning: '',
        canonical_exercise_id: id,
        library_version: 'test',
      },
      sets: 2,
      reps: 12,
      restBetweenSet: 40,
      completed: false,
    }));

  it('C-03: bodyweight user gets no violations for bodyweight-only exercises', () => {
    const day = makeDay(['ex1', 'ex2'], ['bodyweight']);
    expect(checkEquipmentSubset(day, ['bodyweight'])).toHaveLength(0);
  });

  it('C-03: reports violation when exercise needs dumbbell but user has none', () => {
    const day = makeDay(['ex_dumbbell'], ['dumbbell_1kg']);
    const violations = checkEquipmentSubset(day, ['bodyweight']); // user has no dumbbell
    expect(violations).toContain('ex_dumbbell');
  });

  it('C-03: no violation when user has the required equipment', () => {
    const day = makeDay(['ex_dumbbell'], ['dumbbell_1kg']);
    const violations = checkEquipmentSubset(day, ['bodyweight', 'dumbbell_1kg']);
    expect(violations).toHaveLength(0);
  });

  it('C-03: exercise listed as bodyweight never causes a violation', () => {
    const day = makeDay(['ex_bw'], ['bodyweight']);
    expect(checkEquipmentSubset(day, [])).toHaveLength(0);
  });

  it('C-03: empty exercises array returns no violations', () => {
    expect(checkEquipmentSubset([], ['bodyweight'])).toHaveLength(0);
  });
});
