import {
  CanonicalExercise,
  CategoryAssessment,
  EligibilityAssessment,
  EligibilityCategory,
  InjurySelection,
  InjuryTag,
  NormalizedProfile,
  ProjectId,
  StructuredUnavailableResult,
} from './types';
import {
  ELIGIBILITY_CATEGORIES,
  EXPERIENCES,
  EXPERIENCE_RANGE,
  INJURY_EXPANSION,
  INJURY_SELECTIONS,
  PROJECT_IDS,
  isValue,
} from './vocabulary';

const reason = (code: string, value: string | string[] | number) => ({ code, value });

/** Expand selections exactly according to the closed Injury_Selection map. */
export function expandInjurySelections(selections: readonly InjurySelection[]): InjuryTag[] {
  const expanded: InjuryTag[] = [];
  for (const selection of selections) {
    const tags = INJURY_EXPANSION[selection] || [];
    for (const tag of tags) {
      if (!expanded.includes(tag)) expanded.push(tag);
    }
  }
  return expanded;
}

/**
 * Safety is derived exclusively from structured contraindication tags. In
 * particular, an empty selection passes even when the record has tags, and
 * display fields such as warning/tips/steps are never read here.
 */
export function assessSafety(
  exercise: CanonicalExercise,
  injuries: readonly InjurySelection[],
): CategoryAssessment {
  const expanded = expandInjurySelections(injuries);
  const matchingTags = exercise.contraindications.filter(tag => expanded.includes(tag));
  return matchingTags.length === 0
    ? { category: 'safety', outcome: 'passed', reasons: [] }
    : { category: 'safety', outcome: 'failed', reasons: [reason('contraindication_match', matchingTags)] };
}

export function assessEligibility(
  exercise: CanonicalExercise,
  projectId: ProjectId,
  profile: NormalizedProfile,
): EligibilityAssessment {
  const safety = assessSafety(exercise, profile.injuries);
  const range = EXPERIENCE_RANGE[profile.experience];
  const experiencePasses = Boolean(range)
    && exercise.difficulty >= range[0]
    && exercise.difficulty <= range[1];
  const equipmentPasses = exercise.equipment.includes('bodyweight')
    || exercise.equipment.some(item => profile.equipment.includes(item));

  const checks: Record<Exclude<EligibilityCategory, 'alternative'>, CategoryAssessment> = {
    project: exercise.target_projects.includes(projectId)
      ? { category: 'project', outcome: 'passed', reasons: [] }
      : { category: 'project', outcome: 'failed', reasons: [reason('project_not_targeted', projectId)] },
    review_status: exercise.review_status === 'approved'
      ? { category: 'review_status', outcome: 'passed', reasons: [] }
      : { category: 'review_status', outcome: 'failed', reasons: [reason('review_status_not_approved', exercise.review_status)] },
    safety,
    equipment: equipmentPasses
      ? { category: 'equipment', outcome: 'passed', reasons: [] }
      : { category: 'equipment', outcome: 'failed', reasons: [reason('equipment_unavailable', exercise.equipment)] },
    experience: experiencePasses
      ? { category: 'experience', outcome: 'passed', reasons: [] }
      : {
        category: 'experience',
        outcome: 'failed',
        reasons: range
          ? [reason('difficulty_out_of_range', exercise.difficulty), reason('experience_range', `${range[0]}-${range[1]}`)]
          : [reason('unsupported_experience', String(profile.experience))],
      },
  };

  // ELIGIBILITY_CATEGORIES is the single stable order shared by reports and
  // consumers. Alternative is only applicable when replacement is attempted.
  const categories = ELIGIBILITY_CATEGORIES.map(category => category === 'alternative'
    ? { category, outcome: 'not_applicable' as const, reasons: [] }
    : checks[category]);
  const eligible = categories
    .filter(category => category.outcome !== 'not_applicable')
    .every(category => category.outcome === 'passed');

  return { exercise_id: exercise.exercise_id, project_id: projectId, categories, eligible };
}

export interface SelectedExercise {
  exercise: CanonicalExercise;
  assessment: EligibilityAssessment;
}

type ExerciseLibraryLike = { readonly exercises: readonly CanonicalExercise[] };

/**
 * Select only the preferred record or its explicitly referenced alternatives.
 * Alternatives are never searched globally and are evaluated in stored order.
 */
export function selectQualifiedExercise(
  preferred: CanonicalExercise,
  projectId: ProjectId,
  profile: NormalizedProfile,
  library: ExerciseLibraryLike,
): SelectedExercise | null {
  const initial = assessEligibility(preferred, projectId, profile);
  if (initial.eligible) return { exercise: preferred, assessment: initial };

  for (let index = 0; index < preferred.alternative_exercise_ids.length; index += 1) {
    const alternativeId = preferred.alternative_exercise_ids[index];
    const alternative = library.exercises.find(item => item.exercise_id === alternativeId);
    if (!alternative) continue;

    const assessment = assessEligibility(alternative, projectId, profile);
    if (!assessment.eligible) continue;

    assessment.alternative_selection = {
      replaced_exercise_id: preferred.exercise_id,
      selected_exercise_id: alternative.exercise_id,
      alternative_index: index,
      reason: 'first_eligible_referenced_alternative',
    };
    const alternativeCategory = assessment.categories.find(category => category.category === 'alternative');
    if (alternativeCategory) {
      alternativeCategory.outcome = 'passed';
      alternativeCategory.reasons = [reason('first_eligible_referenced_alternative', index)];
    }
    return { exercise: alternative, assessment };
  }

  // The initial record was ineligible and every configured replacement was
  // absent or ineligible, so alternative itself is a failed category.
  const alternativeCategory = initial.categories.find(category => category.category === 'alternative');
  if (alternativeCategory) {
    alternativeCategory.outcome = 'failed';
    alternativeCategory.reasons = [reason('no_eligible_referenced_alternative', preferred.alternative_exercise_ids)];
  }
  return null;
}

export interface RequestSelection {
  selected: Record<ProjectId, SelectedExercise>;
  unavailable?: StructuredUnavailableResult;
}

function failedCategories(
  candidate: CanonicalExercise,
  projectId: ProjectId,
  profile: NormalizedProfile,
): EligibilityCategory[] {
  const assessment = assessEligibility(candidate, projectId, profile);
  const categories = assessment.categories
    .filter(category => category.outcome === 'failed')
    .map(category => category.category);
  if (!assessment.eligible && !categories.includes('alternative')) categories.push('alternative');
  return categories;
}

/**
 * Evaluate the complete request before returning any selection. If one project
 * has no qualified record, selected is empty and one structured unavailable
 * result is returned; callers must not persist a partial plan or fallback.
 */
export function generateSelection(
  projectIds: readonly ProjectId[],
  profile: NormalizedProfile,
  library: ExerciseLibraryLike,
): RequestSelection {
  const requestedProjectIds = projectIds.map(value => String(value));
  const unknownInputValues: StructuredUnavailableResult['unknown_input_values'] = [];

  // This runtime guard keeps the pure generator safe even when called from a
  // boundary that bypassed normalizeProfile. It reports unknown values rather
  // than treating them as an empty or guessed selection.
  projectIds.forEach(value => {
    if (!isValue(PROJECT_IDS, value)) {
      unknownInputValues.push({ field: 'selected_projects', value: String(value) });
    }
  });
  if (!isValue(EXPERIENCES, profile.experience)) {
    unknownInputValues.push({ field: 'experience', value: String(profile.experience) });
  }
  profile.injuries.forEach(value => {
    if (!isValue(INJURY_SELECTIONS, value)) {
      unknownInputValues.push({ field: 'injuries', value: String(value) });
    }
  });

  if (unknownInputValues.length > 0 || projectIds.length === 0) {
    return {
      selected: {} as Record<ProjectId, SelectedExercise>,
      unavailable: unavailableForInput(requestedProjectIds, isValue(EXPERIENCES, profile.experience) ? profile.experience : null, unknownInputValues),
    };
  }

  const selected = {} as Record<ProjectId, SelectedExercise>;
  const failed: Record<string, EligibilityCategory[]> = {};

  for (const projectId of projectIds) {
    const candidates = library.exercises.filter(exercise => exercise.target_projects.includes(projectId));
    let choice: SelectedExercise | null = null;
    const projectFailures = new Set<EligibilityCategory>();

    for (const candidate of candidates) {
      choice = selectQualifiedExercise(candidate, projectId, profile, library);
      if (choice) break;
      failedCategories(candidate, projectId, profile).forEach(category => projectFailures.add(category));
    }

    if (choice) {
      selected[projectId] = choice;
    } else {
      // An empty candidate set is itself an inability to satisfy the project;
      // include every category so the machine-readable envelope is explicit.
      const categories = candidates.length
        ? ELIGIBILITY_CATEGORIES.filter(category => projectFailures.has(category))
        : [...ELIGIBILITY_CATEGORIES];
      failed[projectId] = categories.length ? categories : ['alternative'];
    }
  }

  if (Object.keys(failed).length > 0) {
    return {
      selected: {} as Record<ProjectId, SelectedExercise>,
      unavailable: {
        outcome: 'temporarily_unavailable',
        display_message: '暂不可生成',
        requested_project_ids: requestedProjectIds,
        failed_eligibility_categories_by_project: failed,
        unknown_input_values: [],
        experience: profile.experience,
      },
    };
  }
  return { selected };
}

export function unavailableForInput(
  requested: string[],
  experience: string | null,
  unknown_input_values: StructuredUnavailableResult['unknown_input_values'],
): StructuredUnavailableResult {
  return {
    outcome: 'temporarily_unavailable',
    display_message: '暂不可生成',
    requested_project_ids: [...requested],
    failed_eligibility_categories_by_project: {},
    unknown_input_values: [...unknown_input_values],
    experience,
  };
}
