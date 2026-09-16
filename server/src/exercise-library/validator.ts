import {
  CanonicalExerciseLibrary,
  LibraryValidationReport,
  MigrationReport,
  ReviewStatus,
  ValidationResult,
} from './types';
import {
  EXERCISE_CATEGORIES,
  INJURY_TAGS,
  PROJECT_IDS,
  REVIEW_STATUSES,
  isValue,
} from './vocabulary';

const REQUIRED_FIELDS = [
  'exercise_id',
  'name',
  'name_en',
  'muscle_group',
  'difficulty',
  'equipment',
  'function',
  'category',
  'target_projects',
  'contraindications',
  'alternative_exercise_ids',
  'review_status',
  'rest_seconds',
  'steps',
  'tips',
  'warning',
] as const;

const unique = (values: readonly unknown[]): boolean => new Set(values).size === values.length;
const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const nonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);
const stringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(nonEmptyString)
);

/**
 * Validate a candidate without consulting or modifying any external state.
 * The returned library is a JSON clone so review-status derivation cannot mutate
 * the caller's candidate. Every discovered failure is retained in the report.
 */
export interface ValidatedLibrary {
  library: CanonicalExerciseLibrary;
  report: LibraryValidationReport;
}

export function validateLibrary(candidate: CanonicalExerciseLibrary, migrationReport?: MigrationReport): ValidatedLibrary {
  const serialized = (() => {
    try {
      return JSON.stringify(candidate);
    } catch {
      return undefined;
    }
  })();
  const parsed = serialized === undefined || serialized === 'undefined' ? {} : JSON.parse(serialized);
  const library = (isRecord(parsed) ? parsed : {}) as Record<string, unknown>;

  const registryVersion = nonEmptyString(library.registry_version) ? library.registry_version : 'unknown';
  const results: ValidationResult[] = [];
  const reportedFailures = new Set<string>();
  const invalidRecords = new Set<number>();

  const reportFailure = (
    exerciseId: string | null,
    rule: string,
    field: string,
    invalidValue: unknown,
    recordIndex?: number,
  ): boolean => {
    const key = `${recordIndex ?? 'library'}|${rule}|${field}|${safeValueKey(invalidValue)}`;
    if (reportedFailures.has(key)) {
      return false;
    }
    reportedFailures.add(key);
    results.push({
      exercise_id: exerciseId,
      rule,
      field,
      invalid_value: invalidValue,
      outcome: 'failed',
      registry_version: registryVersion,
    });
    if (recordIndex !== undefined) invalidRecords.add(recordIndex);
    return true;
  };

  const reportLibraryFailure = (rule: string, field: string, invalidValue: unknown): void => {
    reportFailure(null, rule, field, invalidValue);
  };

  if (!nonEmptyString(library.library_id)) reportLibraryFailure('non_empty_string', 'library_id', library.library_id);
  if (!nonEmptyString(library.library_version)) reportLibraryFailure('non_empty_string', 'library_version', library.library_version);
  if (!nonEmptyString(library.registry_version)) reportLibraryFailure('non_empty_string', 'registry_version', library.registry_version);
  if (!nonEmptyString(library.published_at)) reportLibraryFailure('non_empty_string', 'published_at', library.published_at);

  const registry = library.controlled_vocabularies;
  if (!isRecord(registry)) {
    reportLibraryFailure('object_type', 'controlled_vocabularies', registry);
  }

  const equipmentValue = isRecord(registry) ? registry.equipment_ids : undefined;
  const muscleValue = isRecord(registry) ? registry.muscle_groups : undefined;
  const activeEquipment = stringArray(equipmentValue) ? [...equipmentValue] : [];
  const activeMuscles = stringArray(muscleValue) ? [...muscleValue] : [];

  if (!Array.isArray(equipmentValue)) {
    reportLibraryFailure('array_type', 'controlled_vocabularies.equipment_ids', equipmentValue);
  } else {
    if (!equipmentValue.every(nonEmptyString)) {
      reportLibraryFailure('array_item_type', 'controlled_vocabularies.equipment_ids', equipmentValue);
    }
    if (!unique(equipmentValue)) {
      reportLibraryFailure('array_cardinality_or_uniqueness', 'controlled_vocabularies.equipment_ids', equipmentValue);
    }
    if (!equipmentValue.includes('bodyweight')) {
      reportLibraryFailure('registry_bodyweight_required', 'controlled_vocabularies.equipment_ids', equipmentValue);
    }
  }
  if (!Array.isArray(muscleValue)) {
    reportLibraryFailure('array_type', 'controlled_vocabularies.muscle_groups', muscleValue);
  } else {
    if (!muscleValue.every(nonEmptyString)) {
      reportLibraryFailure('array_item_type', 'controlled_vocabularies.muscle_groups', muscleValue);
    }
    if (!unique(muscleValue)) {
      reportLibraryFailure('array_cardinality_or_uniqueness', 'controlled_vocabularies.muscle_groups', muscleValue);
    }
  }

  const exerciseValue = library.exercises;
  if (!Array.isArray(exerciseValue)) {
    reportLibraryFailure('array_type', 'exercises', exerciseValue);
  }
  const exercises: unknown[] = Array.isArray(exerciseValue) ? exerciseValue : [];
  const ids = exercises.map((exercise) => (
    isRecord(exercise) && nonEmptyString(exercise.exercise_id) ? exercise.exercise_id : null
  ));
  const idCounts = new Map<string, number>();
  ids.forEach((id) => { if (id !== null) idCounts.set(id, (idCounts.get(id) ?? 0) + 1); });
  const duplicateIds = new Set([...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id));

  exercises.forEach((exercise, index) => {
    const id = isRecord(exercise) && typeof exercise.exercise_id === 'string' ? exercise.exercise_id : null;
    const fail = (rule: string, field: string, value: unknown): void => {
      reportFailure(id, rule, field, value, index);
    };

    if (!isRecord(exercise)) {
      fail('record_object_type', 'exercise', exercise);
      return;
    }

    REQUIRED_FIELDS.forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(exercise, field)) fail('required_field', field, undefined);
    });

    (['exercise_id', 'name', 'name_en', 'warning'] as const).forEach((field) => {
      if (!nonEmptyString(exercise[field])) fail('non_empty_string', field, exercise[field]);
    });

    if (duplicateIds.has(exercise.exercise_id as string)) {
      fail('duplicate_exercise_id', 'exercise_id', exercise.exercise_id);
    }

    const muscle = exercise.muscle_group;
    if (!isRecord(muscle)) {
      fail('object_type', 'muscle_group', muscle);
    } else {
      validateArray(muscle.primary, 'muscle_group.primary', true, fail);
      validateArray(muscle.secondary, 'muscle_group.secondary', false, fail);
      if (Array.isArray(muscle.primary)) {
        muscle.primary.forEach((value) => {
          if (!activeMuscles.includes(value as string)) fail('unsupported_vocabulary', 'muscle_group.primary', value);
        });
      }
      if (Array.isArray(muscle.secondary)) {
        muscle.secondary.forEach((value) => {
          if (!activeMuscles.includes(value as string)) fail('unsupported_vocabulary', 'muscle_group.secondary', value);
        });
      }
    }

    const equipment = exercise.equipment;
    validateArray(equipment, 'equipment', true, fail);
    if (Array.isArray(equipment)) {
      equipment.forEach((value) => {
        if (!activeEquipment.includes(value as string)) fail('unsupported_vocabulary', 'equipment', value);
      });
    }

    const projects = exercise.target_projects;
    validateArray(projects, 'target_projects', true, fail);
    if (Array.isArray(projects)) {
      projects.forEach((value) => {
        if (!isValue(PROJECT_IDS, value)) fail('unsupported_vocabulary', 'target_projects', value);
      });
    }

    const contraindications = exercise.contraindications;
    validateArray(contraindications, 'contraindications', false, fail);
    if (Array.isArray(contraindications)) {
      contraindications.forEach((value) => {
        if (!isValue(INJURY_TAGS, value)) fail('unsupported_vocabulary', 'contraindications', value);
      });
    }

    const alternatives = exercise.alternative_exercise_ids;
    validateArray(alternatives, 'alternative_exercise_ids', false, fail);

    const steps = exercise.steps;
    if (!Array.isArray(steps)) {
      fail('array_type', 'steps', steps);
    } else if (!steps.length || !steps.every(nonEmptyString)) {
      fail('ordered_non_empty_steps', 'steps', steps);
    }

    const tips = exercise.tips;
    validateArray(tips, 'tips', false, fail);

    const fn = exercise.function;
    if (!isRecord(fn)) {
      fail('object_type', 'function', fn);
    } else {
      if (!nonEmptyString(fn.primary)) fail('non_empty_string', 'function.primary', fn.primary);
      if (!nonEmptyString(fn.secondary)) fail('non_empty_string', 'function.secondary', fn.secondary);
    }

    if (!Number.isInteger(exercise.difficulty) || exercise.difficulty < 1 || exercise.difficulty > 5) {
      fail('integer_range', 'difficulty', exercise.difficulty);
    }
    if (!Number.isInteger(exercise.rest_seconds) || exercise.rest_seconds < 0 || exercise.rest_seconds > 600) {
      fail('integer_range', 'rest_seconds', exercise.rest_seconds);
    }
    if (!isValue(EXERCISE_CATEGORIES, exercise.category)) {
      fail('unsupported_vocabulary', 'category', exercise.category);
    }
    if (!isValue(REVIEW_STATUSES, exercise.review_status)) {
      fail('unsupported_vocabulary', 'review_status', exercise.review_status);
    }
  });

  const validIds = new Set(ids.filter((id): id is string => id !== null));

  // Status is derived before reference validation so a valid draft imported in
  // this candidate can become approved and be referenced in the same candidate.
  const deriveStatuses = (): void => {
    exercises.forEach((exercise, index) => {
      if (!isRecord(exercise)) return;
      const originalStatus = exercise.review_status;
      exercise.review_status = invalidRecords.has(index)
        ? 'needs_review'
        : originalStatus === 'deprecated' ? 'deprecated' : 'approved';
    });
  };

  deriveStatuses();
  let referencesChanged = true;
  while (referencesChanged) {
    referencesChanged = false;
    deriveStatuses();
    const effectiveStatus = new Map<string, ReviewStatus>();
    exercises.forEach((exercise, index) => {
      if (isRecord(exercise) && nonEmptyString(exercise.exercise_id)) {
        effectiveStatus.set(exercise.exercise_id, invalidRecords.has(index) ? 'needs_review' : exercise.review_status as ReviewStatus);
      }
    });

    exercises.forEach((exercise, index) => {
      if (!isRecord(exercise) || !Array.isArray(exercise.alternative_exercise_ids)) return;
      const id = typeof exercise.exercise_id === 'string' ? exercise.exercise_id : null;
      exercise.alternative_exercise_ids.forEach((alternative) => {
        if (!nonEmptyString(alternative)) return;
        if (alternative === id) {
          referencesChanged = reportFailure(id, 'alternative_self_reference', 'alternative_exercise_ids', alternative, index) || referencesChanged;
        } else if (!validIds.has(alternative)) {
          referencesChanged = reportFailure(id, 'alternative_missing_reference', 'alternative_exercise_ids', alternative, index) || referencesChanged;
        } else if (effectiveStatus.get(alternative) !== 'approved') {
          referencesChanged = reportFailure(id, 'alternative_unapproved_reference', 'alternative_exercise_ids', alternative, index) || referencesChanged;
        }
      });
      if (!unique(exercise.alternative_exercise_ids)) {
        referencesChanged = reportFailure(id, 'alternative_duplicate_reference', 'alternative_exercise_ids', exercise.alternative_exercise_ids, index) || referencesChanged;
      }
    });
  }
  deriveStatuses();

  const migrationOutcomes = migrationReport && Array.isArray(migrationReport.outcomes)
    ? migrationReport.outcomes
    : [];
  const blockingMigrationEntries = migrationOutcomes.filter((entry) => (
    entry.outcome === 'unresolved' || entry.conflicts.some((conflict) => conflict.selected_value === undefined)
  ));
  const migrationBlocked = Boolean(migrationReport?.blocking) || blockingMigrationEntries.length > 0;
  const report: LibraryValidationReport = {
    candidate_id: typeof library.library_id === 'string' ? library.library_id : 'unknown',
    registry_version: registryVersion,
    allowed_equipment_ids: [...activeEquipment],
    allowed_muscle_groups: [...activeMuscles],
    results,
    blocking_migration_entries: blockingMigrationEntries,
    publication_gate: results.some((result) => result.outcome === 'failed') || migrationBlocked ? 'failed' : 'passed',
  };

  return { library: library as unknown as CanonicalExerciseLibrary, report };
}

function validateArray(
  value: unknown,
  field: string,
  requiredValue: boolean,
  fail: (rule: string, field: string, value: unknown) => void,
): void {
  if (!Array.isArray(value)) {
    fail('array_type', field, value);
    return;
  }
  if (requiredValue && value.length === 0) fail('array_cardinality_or_uniqueness', field, value);
  if (!unique(value)) fail('array_cardinality_or_uniqueness', field, value);
  if (!value.every(nonEmptyString)) fail('array_item_type', field, value);
}

function safeValueKey(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
