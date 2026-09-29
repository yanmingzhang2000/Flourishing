import { InjurySelection, ProjectId } from '../exercise-library/types';

export type P0EvalCategory = 'contraindication' | 'duration' | 'recovery' | 'composition';

export interface P0EvalCase {
  id: string;
  category: P0EvalCategory;
  input: {
    injuries?: readonly InjurySelection[];
    projects: readonly ProjectId[];
    trainingDays?: readonly number[];
    requestedDays?: number;
    equipment?: readonly string[];
  };
  expected: Record<string, unknown>;
}

/**
 * Machine-readable baseline derived from docs/EVAL_SET.md. The scheduler and
 * composer will consume these cases once those pure rule modules are added.
 */
export const P0_EVAL_CASES: readonly P0EvalCase[] = [
  {
    id: 'T-01', category: 'contraindication',
    input: { injuries: ['shoulder'], projects: ['tricep_tone', 'round_shoulder_fix'] },
    expected: { excludedTags: ['shoulder_impingement', 'rotator_cuff'] },
  },
  {
    id: 'T-02', category: 'contraindication',
    input: { injuries: ['neck'], projects: ['trap_relax'] },
    expected: { excludedTags: ['neck_pain'] },
  },
  {
    id: 'T-03', category: 'contraindication',
    input: { injuries: ['shoulder', 'knee'], projects: ['full_body_basic'] },
    expected: { excludedTags: ['shoulder_impingement', 'rotator_cuff', 'knee_pain', 'meniscus'] },
  },
  {
    id: 'T-04', category: 'contraindication',
    input: { injuries: [], projects: ['tricep_tone'] },
    expected: { excludesNothingFromSafety: true },
  },
  {
    id: 'D-01', category: 'duration',
    input: { projects: ['tricep_tone'] }, expected: { sessionMinutes: 20 },
  },
  {
    id: 'D-02', category: 'duration',
    input: { projects: ['tricep_tone', 'lower_abs_tone'] }, expected: { sessionMinutes: 35 },
  },
  {
    id: 'D-03', category: 'duration',
    input: { projects: ['hip_thigh_tone', 'lower_abs_tone', 'round_shoulder_fix'] }, expected: { sessionMinutes: 55 },
  },
  {
    id: 'D-04', category: 'duration',
    input: { projects: ['full_body_basic', 'trap_relax'] }, expected: { sessionMinutes: 40 },
  },
  {
    id: 'R-01', category: 'recovery',
    input: { projects: ['tricep_tone'], requestedDays: 5 }, expected: { minimumGapHours: 48 },
  },
  {
    id: 'R-02', category: 'recovery',
    input: { projects: ['tricep_tone'], requestedDays: 7 }, expected: { activeRecoveryRequired: true },
  },
  {
    id: 'R-03', category: 'recovery',
    input: { projects: ['tricep_tone', 'lower_abs_tone'], trainingDays: [1, 3, 5, 6] },
    expected: { minimumGapHours: 48, dailyCombination: true },
  },
  {
    id: 'C-01', category: 'composition',
    input: { projects: ['full_body_basic', 'tricep_tone'] }, expected: { deduplicateOverlappingMuscles: true },
  },
  {
    id: 'C-02', category: 'composition',
    input: { projects: ['tricep_tone', 'lower_abs_tone'], trainingDays: [1, 3, 5, 6] },
    expected: { dailyCombination: true },
  },
  {
    id: 'C-03', category: 'composition',
    input: { projects: ['tricep_tone'], equipment: ['bodyweight'] }, expected: { equipmentSubset: true },
  },
];
