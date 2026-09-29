import fs from 'fs';
import path from 'path';
import {
  CanonicalExercise,
  CanonicalExerciseLibrary,
  ExerciseCategory,
  InjuryTag,
  LegacySourcePath,
  MigrationRecordOutcome,
  MigrationReport,
  ProjectId,
  ReviewStatus,
} from './types';
import {
  EQUIPMENT_IDS,
  EXERCISE_CATEGORIES,
  INJURY_TAGS,
  LEGACY_EQUIPMENT_MAP,
  MUSCLE_GROUPS,
  PROJECT_IDS,
  REVIEW_STATUSES,
  isValue,
} from './vocabulary';
import { validateLibrary } from './validator';
import { ExerciseLibraryService } from './service';

const SOURCE_PATHS = ['data/exercises.json', 'src/data/exercises.json'] as const;

type LegacyRecord = Record<string, unknown>;
type MigrationSourcePath = typeof SOURCE_PATHS[number];
type MigrationOptions = {
  rootDir?: string;
  /** Directory containing the candidate and report subdirectories. */
  outputDir?: string;
  publish?: boolean;
  candidateId?: string;
  publishedAt?: string;
};

type SourceEntry = {
  sourcePath: MigrationSourcePath;
  sourceIndex: number;
  record: unknown;
  projectId?: string;
  categoryHint?: string;
};

type MappedExercise = Partial<CanonicalExercise>;
type Conversion = {
  mapped: MappedExercise;
  canonicalId: string | null;
  unresolvedFields: Array<{ field: string; source_value: unknown }>;
};

const DEFAULT_CANDIDATE_ID = 'exercise-library-candidate';
const DEFAULT_PUBLISHED_AT = '1970-01-01T00:00:00.000Z';

/**
 * These aliases are intentionally explicit. An unknown legacy identifier is
 * never normalized from its display name or guessed from a similar spelling.
 */
const LEGACY_ID_ALIASES: Record<string, string> = {
  warmup_arm_circles: 'arm_circle_warmup',
  clamshell: 'clam_shell',
  side_leg_raise: 'side_lying_leg_lift',
  leg_raises: 'lying_leg_raise',
  mountain_climbers: 'mountain_climber',
  wall_angels: 'wall_angel',
  face_pulls: 'band_face_pull',
  doorway_chest_stretch: 'doorway_pec_stretch',
  doorway_chest_opener: 'doorway_chest_opener',
  wall_slides: 'wall_slide_rs',
  squat: 'fb_bodyweight_squat',
  lunge: 'reverse_lunge',
  plank: 'fb_plank_hold',
  push_up_knees: 'fb_incline_pushup',
  cooldown_full_body_stretch: 'full_body_standing_stretch',
};

/** All non-identity conversions used by the old nested exercise schema. */
const DIFFICULTY_MAP: Record<string, CanonicalExercise['difficulty']> = {
  beginner: 1,
  intermediate: 3,
  advanced: 4,
};
const CATEGORY_MAP: Record<string, ExerciseCategory> = {
  warmup: 'warmup',
  strength: 'strength',
  stretch: 'stretch',
  cooldown: 'stretch',
  cardio: 'cardio',
};
const CANONICAL_FIELDS: Array<keyof CanonicalExercise> = [
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
];

const KNOWN_EQUIPMENT = new Set<string>(EQUIPMENT_IDS);
const KNOWN_CATEGORIES = new Set<string>(EXERCISE_CATEGORIES);
const KNOWN_REVIEW_STATUSES = new Set<string>(REVIEW_STATUSES);

function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function addUnresolved(
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
  field: string,
  sourceValue: unknown,
): void {
  if (!unresolvedFields.some(item => item.field === field)) {
    unresolvedFields.push({ field, source_value: sourceValue });
  }
}

function canonicalIdFor(rawId: unknown, legacy: boolean): string | null {
  if (!nonEmptyString(rawId)) return null;
  const id = rawId.trim();
  return legacy ? (LEGACY_ID_ALIASES[id] || id) : id;
}

function mapEquipmentValues(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): string[] | undefined {
  if (!Array.isArray(value) || !value.every(nonEmptyString)) {
    addUnresolved(unresolvedFields, 'equipment', value);
    return undefined;
  }
  const mapped: string[] = [];
  let hasUnknown = false;
  for (const rawValue of value) {
    const normalized = LEGACY_EQUIPMENT_MAP[rawValue] || rawValue;
    if (!KNOWN_EQUIPMENT.has(normalized)) {
      hasUnknown = true;
      continue;
    }
    if (!mapped.includes(normalized)) mapped.push(normalized);
  }
  if (hasUnknown || mapped.length === 0) {
    addUnresolved(unresolvedFields, 'equipment', value);
    return undefined;
  }
  return mapped;
}

function mapMuscleGroup(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): { primary: string[]; secondary: string[] } | undefined {
  if (!isRecord(value)) {
    addUnresolved(unresolvedFields, 'muscle_group', value);
    return undefined;
  }
  const primary = stringArray(value.primary) ? unique(value.primary.map(item => item.trim())) : undefined;
  const secondary = value.secondary === undefined
    ? []
    : stringArray(value.secondary) ? unique(value.secondary.map(item => item.trim())) : undefined;
  if (!primary || primary.length === 0 || !secondary) {
    addUnresolved(unresolvedFields, 'muscle_group', value);
    return undefined;
  }
  return { primary, secondary };
}

function mapLegacyMuscle(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): { primary: string[]; secondary: string[] } | undefined {
  if (!nonEmptyString(value)) {
    addUnresolved(unresolvedFields, 'muscle_group.primary', value);
    return undefined;
  }
  // The source field is already a muscle label. Preserving it is an explicit
  // identity mapping; the generated registry records the selected value.
  return { primary: [value.trim()], secondary: [] };
}

function mapFunction(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): { primary: string; secondary: string } | undefined {
  if (!isRecord(value) || !nonEmptyString(value.primary) || !nonEmptyString(value.secondary)) {
    addUnresolved(unresolvedFields, 'function', value);
    return undefined;
  }
  return { primary: value.primary.trim(), secondary: value.secondary.trim() };
}

function mapCategory(
  value: unknown,
  categoryHint: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): ExerciseCategory | undefined {
  const rawValue = nonEmptyString(value) ? value : nonEmptyString(categoryHint) ? categoryHint : undefined;
  const category = rawValue ? CATEGORY_MAP[rawValue] : undefined;
  if (!category || !KNOWN_CATEGORIES.has(category)) {
    addUnresolved(unresolvedFields, 'category', value ?? categoryHint);
    return undefined;
  }
  return category;
}

function mapProjects(
  value: unknown,
  projectHint: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): ProjectId[] | undefined {
  const sourceValues = projectHint !== undefined
    ? [projectHint]
    : Array.isArray(value) ? value : undefined;
  if (!sourceValues || !sourceValues.every(item => isValue(PROJECT_IDS, item))) {
    addUnresolved(unresolvedFields, 'target_projects', projectHint ?? value);
    return undefined;
  }
  const projects = unique(sourceValues as ProjectId[]);
  if (projects.length === 0) {
    addUnresolved(unresolvedFields, 'target_projects', projectHint ?? value);
    return undefined;
  }
  return projects;
}

function mapContraindications(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): InjuryTag[] | undefined {
  if (value !== undefined) {
    if (!Array.isArray(value) || !value.every(item => isValue(INJURY_TAGS, item))) {
      addUnresolved(unresolvedFields, 'contraindications', value);
      return undefined;
    }
    return unique(value as InjuryTag[]);
  }
  // Warning/display text is deliberately never converted into structured
  // safety data. A legacy source without contraindications remains blocking.
  addUnresolved(unresolvedFields, 'contraindications', value);
  return undefined;
}

function mapDifficulty(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): CanonicalExercise['difficulty'] | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value as CanonicalExercise['difficulty'];
  }
  if (nonEmptyString(value) && DIFFICULTY_MAP[value]) return DIFFICULTY_MAP[value];
  addUnresolved(unresolvedFields, 'difficulty', value);
  return undefined;
}

function mapSteps(value: unknown, unresolvedFields: Array<{ field: string; source_value: unknown }>): string[] | undefined {
  if (!stringArray(value) || value.length === 0) {
    addUnresolved(unresolvedFields, 'steps', value);
    return undefined;
  }
  return value.map(item => item.trim());
}

function mapTips(value: unknown, unresolvedFields: Array<{ field: string; source_value: unknown }>): string[] | undefined {
  if (Array.isArray(value) && value.every(nonEmptyString)) return value.map(item => item.trim());
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  addUnresolved(unresolvedFields, 'tips', value);
  return undefined;
}

function mapRestSeconds(
  value: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 600) return value;
  addUnresolved(unresolvedFields, 'rest_seconds', value);
  return undefined;
}

function mapReviewStatus(
  value: unknown,
  legacyNeedsReview: unknown,
  unresolvedFields: Array<{ field: string; source_value: unknown }>,
): ReviewStatus | undefined {
  if (typeof legacyNeedsReview === 'boolean') return legacyNeedsReview ? 'needs_review' : 'approved';
  if (nonEmptyString(value) && KNOWN_REVIEW_STATUSES.has(value)) return value as ReviewStatus;
  // A record with no review field is deliberately draft until validation runs.
  if (value === undefined && legacyNeedsReview === undefined) return 'draft';
  addUnresolved(unresolvedFields, 'review_status', value ?? legacyNeedsReview);
  return undefined;
}

function convertRecord(entry: SourceEntry): Conversion {
  const unresolvedFields: Array<{ field: string; source_value: unknown }> = [];
  const mapped: MappedExercise = {};
  if (!isRecord(entry.record)) {
    addUnresolved(unresolvedFields, 'record', entry.record);
    return { mapped, canonicalId: null, unresolvedFields };
  }

  const record = entry.record;
  const legacy = !Object.prototype.hasOwnProperty.call(record, 'exercise_id');
  const canonicalId = canonicalIdFor(legacy ? record.id : record.exercise_id, legacy);
  if (canonicalId) mapped.exercise_id = canonicalId;
  else addUnresolved(unresolvedFields, 'exercise_id', legacy ? record.id : record.exercise_id);

  if (nonEmptyString(record.name)) mapped.name = record.name.trim();
  else addUnresolved(unresolvedFields, 'name', record.name);

  if (nonEmptyString(record.name_en)) mapped.name_en = record.name_en.trim();
  else addUnresolved(unresolvedFields, 'name_en', record.name_en);

  const muscleGroup = legacy
    ? mapLegacyMuscle(record.primary_muscle, unresolvedFields)
    : mapMuscleGroup(record.muscle_group, unresolvedFields);
  if (muscleGroup) mapped.muscle_group = muscleGroup;

  const difficulty = mapDifficulty(record.difficulty, unresolvedFields);
  if (difficulty !== undefined) mapped.difficulty = difficulty;

  const equipment = mapEquipmentValues(record.equipment, unresolvedFields);
  if (equipment) mapped.equipment = equipment;

  const functionValue = mapFunction(record.function, unresolvedFields);
  if (functionValue) mapped.function = functionValue;

  const category = mapCategory(record.category, entry.categoryHint, unresolvedFields);
  if (category) mapped.category = category;

  const projects = mapProjects(record.target_projects, entry.projectId, unresolvedFields);
  if (projects) mapped.target_projects = projects;

  const warning = nonEmptyString(record.warning) ? record.warning.trim() : undefined;
  if (warning) mapped.warning = warning;
  else addUnresolved(unresolvedFields, 'warning', record.warning);

  const contraindications = mapContraindications(record.contraindications, unresolvedFields);
  if (contraindications) mapped.contraindications = contraindications;

  const alternatives = record.alternative_exercise_ids === undefined
    ? []
    : stringArray(record.alternative_exercise_ids) ? unique(record.alternative_exercise_ids) : undefined;
  if (alternatives) mapped.alternative_exercise_ids = alternatives;
  else addUnresolved(unresolvedFields, 'alternative_exercise_ids', record.alternative_exercise_ids);

  const reviewStatus = mapReviewStatus(record.review_status, record.needs_review, unresolvedFields);
  if (reviewStatus) mapped.review_status = reviewStatus;

  const restSeconds = mapRestSeconds(legacy ? record.rest_between_set : record.rest_seconds, unresolvedFields);
  if (restSeconds !== undefined) mapped.rest_seconds = restSeconds;

  const steps = mapSteps(record.steps, unresolvedFields);
  if (steps) mapped.steps = steps;

  const tips = mapTips(record.tips, unresolvedFields);
  if (tips) mapped.tips = tips;

  return { mapped, canonicalId, unresolvedFields };
}

function isComplete(mapped: MappedExercise): mapped is CanonicalExercise {
  return CANONICAL_FIELDS.every(field => mapped[field] !== undefined);
}

function sourceLabel(entry: SourceEntry): string {
  return `${entry.sourcePath}#${entry.sourceIndex}`;
}

function selectedValues(exercise: MappedExercise): Record<string, unknown> {
  return Object.fromEntries(
    CANONICAL_FIELDS
      .filter(field => exercise[field] !== undefined)
      .map(field => [field, exercise[field]]),
  );
}

function mergeExisting(
  existing: CanonicalExercise,
  incoming: MappedExercise,
  existingLabel: string,
  incomingLabel: string,
): { exercise: CanonicalExercise; conflicts: MigrationRecordOutcome['conflicts'] } {
  // Fixed source order gives data/exercises.json precedence over the nested
  // legacy file. For duplicate records within one source, the first record wins.
  const merged = { ...existing } as CanonicalExercise;
  const conflicts: MigrationRecordOutcome['conflicts'] = [];
  for (const field of CANONICAL_FIELDS) {
    const incomingValue = incoming[field];
    if (incomingValue === undefined) continue;
    const existingValue = existing[field];
    if (!jsonEqual(existingValue, incomingValue)) {
      conflicts.push({
        field,
        values_by_source: { [existingLabel]: existingValue, [incomingLabel]: incomingValue },
        selected_value: existingValue,
      });
    }
  }
  return { exercise: merged, conflicts };
}

function sourceEntries(value: unknown, sourcePath: MigrationSourcePath): SourceEntry[] {
  const entries: SourceEntry[] = [];
  if (Array.isArray(value)) {
    value.forEach((record, sourceIndex) => entries.push({ sourcePath, sourceIndex, record }));
    return entries;
  }
  if (!isRecord(value)) return entries;

  let sourceIndex = 0;
  // Object insertion order and this fixed category order are part of the
  // migration contract, so rerunning the migration produces the same indices.
  for (const [projectId, project] of Object.entries(value)) {
    if (!isRecord(project)) continue;
    for (const category of ['warmup', 'exercises', 'cooldown'] as const) {
      const records = project[category];
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        entries.push({ sourcePath, sourceIndex, record, projectId, categoryHint: category });
        sourceIndex += 1;
      }
    }
  }
  return entries;
}

function readSource(rootDir: string, relativePath: MigrationSourcePath): SourceEntry[] {
  const sourcePath = path.join(rootDir, relativePath);
  const parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as unknown;
  return sourceEntries(parsed, relativePath);
}

function makeOutcome(
  entry: SourceEntry,
  conversion: Conversion,
  outcome: MigrationRecordOutcome['outcome'],
  canonicalExerciseId: string | null,
  conflicts: MigrationRecordOutcome['conflicts'] = [],
  finalExercise?: MappedExercise,
): MigrationRecordOutcome {
  const identifier = isRecord(entry.record)
    ? (nonEmptyString(entry.record.exercise_id) ? entry.record.exercise_id : nonEmptyString(entry.record.id) ? entry.record.id : null)
    : null;
  return {
    source_path: entry.sourcePath as LegacySourcePath,
    source_index: entry.sourceIndex,
    legacy_record_identifier: identifier,
    outcome,
    canonical_exercise_id: canonicalExerciseId,
    unresolved_fields: conversion.unresolvedFields,
    selected_values: selectedValues(finalExercise || conversion.mapped),
    conflicts,
  };
}

export interface MigrationResult {
  library: CanonicalExerciseLibrary;
  report: MigrationReport;
  validation: ReturnType<typeof validateLibrary>['report'];
  candidatePath: string;
  migrationReportPath: string;
  validationReportPath: string;
  published: boolean;
}

export function migrateExerciseLibrary(options: MigrationOptions = {}): MigrationResult {
  const rootDir = options.rootDir || path.resolve(__dirname, '../../..');
  const outputDir = options.outputDir || path.join(rootDir, 'data');
  const candidateId = options.candidateId || DEFAULT_CANDIDATE_ID;
  const publishedAt = options.publishedAt || DEFAULT_PUBLISHED_AT;
  const recordsById = new Map<string, { exercise: CanonicalExercise; sourceLabel: string }>();
  const outcomes: MigrationRecordOutcome[] = [];
  const sourceRecordCounts: Record<string, number> = {};

  for (const relativePath of SOURCE_PATHS) {
    const entries = readSource(rootDir, relativePath);
    sourceRecordCounts[relativePath] = entries.length;
    for (const entry of entries) {
      const conversion = convertRecord(entry);
      const label = sourceLabel(entry);
      const existing = conversion.canonicalId ? recordsById.get(conversion.canonicalId) : undefined;

      if (conversion.unresolvedFields.length > 0) {
        // Never turn an incomplete source record into a successful merge. The
        // unresolved source value remains visible and blocks publication.
        outcomes.push(makeOutcome(entry, conversion, 'unresolved', null));
        continue;
      }

      if (!isComplete(conversion.mapped)) {
        outcomes.push(makeOutcome(entry, conversion, 'unresolved', null));
        continue;
      }

      if (!existing) {
        recordsById.set(conversion.mapped.exercise_id, { exercise: conversion.mapped, sourceLabel: label });
        outcomes.push(makeOutcome(entry, conversion, 'migrated', conversion.mapped.exercise_id, [], conversion.mapped));
        continue;
      }

      const merged = mergeExisting(existing.exercise, conversion.mapped, existing.sourceLabel, label);
      outcomes.push(makeOutcome(entry, conversion, 'merged', merged.exercise.exercise_id, merged.conflicts, merged.exercise));
    }
  }

  const exercises = [...recordsById.values()].map(item => item.exercise);
  const equipmentIds = unique(['bodyweight', ...exercises.flatMap(exercise => exercise.equipment)]);
  const muscleGroups = unique([
    ...MUSCLE_GROUPS,
    ...exercises.flatMap(exercise => [...exercise.muscle_group.primary, ...exercise.muscle_group.secondary]),
  ]);
  const library: CanonicalExerciseLibrary = {
    library_id: 'flourish-exercises',
    library_version: candidateId,
    registry_version: '1',
    published_at: publishedAt,
    controlled_vocabularies: { equipment_ids: equipmentIds, muscle_groups: muscleGroups },
    exercises,
  };
  const report: MigrationReport = {
    candidate_id: candidateId,
    source_record_counts: sourceRecordCounts,
    outcomes,
    blocking: outcomes.some(outcome => outcome.outcome === 'unresolved' || outcome.conflicts.some(conflict => conflict.selected_value === undefined)),
  };
  const validated = validateLibrary(library, report);
  const candidateLibrary = validated.library;
  const validation = validated.report;

  const candidateDir = path.join(outputDir, '.exercise-library-candidates');
  const reportDir = path.join(outputDir, 'exercise-library-reports');
  fs.mkdirSync(candidateDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
  const candidatePath = path.join(candidateDir, `${candidateId}.json`);
  const migrationReportPath = path.join(reportDir, `${candidateId}.migration.json`);
  const validationReportPath = path.join(reportDir, `${candidateId}.validation.json`);
  fs.writeFileSync(candidatePath, `${JSON.stringify(candidateLibrary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(migrationReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(validationReportPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');

  let published = false;
  if (options.publish && !report.blocking && validation.publication_gate === 'passed') {
    const service = new ExerciseLibraryService(path.join(outputDir, 'canonical-exercise-library.json'));
    published = service.publishCandidate(candidatePath, report).published;
  }

  return { library: candidateLibrary, report, validation, candidatePath, migrationReportPath, validationReportPath, published };
}

if (require.main === module) {
  const args = new Set(process.argv.slice(2));
  const valueAfter = (flag: string): string | undefined => {
    const index = process.argv.indexOf(flag);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const result = migrateExerciseLibrary({
    rootDir: valueAfter('--root'),
    outputDir: valueAfter('--output'),
    candidateId: valueAfter('--candidate-id'),
    publishedAt: valueAfter('--published-at'),
    publish: args.has('--publish'),
  });
  process.stdout.write(`${JSON.stringify({
    candidatePath: result.candidatePath,
    migrationReportPath: result.migrationReportPath,
    validationReportPath: result.validationReportPath,
    blocking: result.report.blocking,
    published: result.published,
  })}\n`);
}
