import { describe, expect, it } from 'vitest';
import { assessEligibility, generateSelection } from './eligibility';
import { normalizeProfile } from './compatibility';
import { validateLibrary } from './validator';
import { CanonicalExercise, CanonicalExerciseLibrary } from './types';

const exercise = (overrides: Partial<CanonicalExercise> = {}): CanonicalExercise => ({
  exercise_id: 'test_exercise', name: '测试动作', name_en: 'Test Exercise',
  muscle_group: { primary: ['测试肌群'], secondary: [] }, difficulty: 1, equipment: ['bodyweight'],
  function: { primary: '激活', secondary: '紧致' }, category: 'strength', target_projects: ['tricep_tone'],
  contraindications: ['shoulder_impingement'], alternative_exercise_ids: [], review_status: 'approved',
  rest_seconds: 30, steps: ['完成动作'], tips: ['保持稳定'], warning: '疼痛即停止。', ...overrides,
});
const library = (records: CanonicalExercise[]): CanonicalExerciseLibrary => ({
  library_id: 'test', library_version: '1', registry_version: '1', published_at: new Date(0).toISOString(),
  controlled_vocabularies: { equipment_ids: ['bodyweight'], muscle_groups: ['测试肌群'] }, exercises: records,
});
const profile = { experience: 'zero' as const, injuries: [] as ('shoulder')[], equipment: [], selected_projects: ['tricep_tone' as const] };

describe('exercise library eligibility', () => {
  it('passes safety with no injury selections regardless of contraindications', () => {
    const result = assessEligibility(exercise(), 'tricep_tone', profile);
    expect(result.categories.find(category => category.category === 'safety')?.outcome).toBe('passed');
  });

  it('reports every expanded matching injury tag', () => {
    const result = assessEligibility(exercise({ contraindications: ['shoulder_impingement', 'rotator_cuff'] }), 'tricep_tone', { ...profile, injuries: ['shoulder'] });
    const safety = result.categories.find(category => category.category === 'safety');
    expect(safety?.outcome).toBe('failed');
    expect(safety?.reasons[0].value).toEqual(['shoulder_impingement', 'rotator_cuff']);
  });

  it('returns one unavailable result instead of an ineligible fallback', () => {
    const result = generateSelection(['tricep_tone'], { ...profile, injuries: ['shoulder'] }, library([exercise()]));
    expect(result.selected).toEqual({});
    expect(result.unavailable?.outcome).toBe('temporarily_unavailable');
    expect(result.unavailable?.display_message).toBe('暂不可生成');
  });
});

describe('profile normalization and validation', () => {
  it('maps legacy equipment and injury values without reading display text', () => {
    const result = normalizeProfile({ experience: 'zero', injuries: ['肩'], equipment: ['none'], selected_projects: ['tricep_tone'] });
    expect(result.profile?.injuries).toEqual(['shoulder']);
    expect(result.profile?.equipment).toEqual(['bodyweight']);
  });

  it('returns unknown experience as structured unavailable input', () => {
    const result = normalizeProfile({ experience: 'expert', injuries: [], equipment: ['none'], selected_projects: ['tricep_tone'] });
    expect(result.unavailable?.unknown_input_values).toContainEqual({ field: 'experience', value: 'expert' });
  });

  it('reports duplicate identifiers and keeps publication closed', () => {
    const candidate = library([exercise(), exercise({ name: '重复动作' })]);
    const result = validateLibrary(candidate);
    expect(result.report.publication_gate).toBe('failed');
    expect(result.report.results.filter(item => item.rule === 'duplicate_exercise_id')).toHaveLength(2);
  });
});
