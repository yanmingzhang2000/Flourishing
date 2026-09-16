export type InjurySelection = 'shoulder' | 'neck' | 'elbow' | 'wrist' | 'back' | 'knee';
export type InjuryTag = 'shoulder_impingement' | 'rotator_cuff' | 'neck_pain' | 'elbow_pain' | 'wrist_pain' | 'lower_back' | 'sciatica' | 'knee_pain' | 'meniscus';
export type ProjectId = 'tricep_tone' | 'hip_thigh_tone' | 'lower_abs_tone' | 'trap_relax' | 'round_shoulder_fix' | 'full_body_basic';
export type EquipmentId = string;
export type MuscleGroup = string;
export type ExerciseCategory = 'strength' | 'warmup' | 'stretch' | 'cardio';
export type ReviewStatus = 'draft' | 'needs_review' | 'approved' | 'deprecated';
export type TrainingExperience = 'zero' | 'occasional' | 'regular';
export type EligibilityCategory = 'project' | 'review_status' | 'safety' | 'equipment' | 'experience' | 'alternative';
export type EligibilityOutcome = 'passed' | 'failed' | 'not_applicable';
export type Outcome = EligibilityOutcome;

export interface CanonicalExercise {
  exercise_id: string;
  name: string;
  name_en: string;
  muscle_group: { primary: MuscleGroup[]; secondary: MuscleGroup[] };
  difficulty: 1 | 2 | 3 | 4 | 5;
  equipment: EquipmentId[];
  function: { primary: string; secondary: string };
  category: ExerciseCategory;
  target_projects: ProjectId[];
  contraindications: InjuryTag[];
  alternative_exercise_ids: string[];
  review_status: ReviewStatus;
  rest_seconds: number;
  steps: string[];
  tips: string[];
  warning: string;
}

export interface ControlledVocabularyRegistry {
  equipment_ids: EquipmentId[];
  muscle_groups: MuscleGroup[];
}
export type ControlledVocabularies = ControlledVocabularyRegistry;
export interface CanonicalExerciseLibrary {
  library_id: string;
  library_version: string;
  registry_version: string;
  published_at: string;
  controlled_vocabularies: ControlledVocabularies;
  exercises: CanonicalExercise[];
}

export interface EligibilityReason { code: string; value: string | string[] | number; }
export interface CategoryAssessment { category: EligibilityCategory; outcome: EligibilityOutcome; reasons: EligibilityReason[]; }
export interface EligibilityAssessment {
  exercise_id: string;
  project_id: ProjectId;
  categories: CategoryAssessment[];
  eligible: boolean;
  alternative_selection?: { replaced_exercise_id: string; selected_exercise_id: string; alternative_index: number; reason: 'first_eligible_referenced_alternative' };
}
export interface NormalizedProfile {
  experience: TrainingExperience;
  injuries: InjurySelection[];
  equipment: string[];
  selected_projects: ProjectId[];
  max_days_per_week?: number;
  session_max_min?: number;
}
export interface StructuredUnavailableResult {
  outcome: 'temporarily_unavailable';
  display_message: '暂不可生成';
  requested_project_ids: string[];
  failed_eligibility_categories_by_project: Record<string, EligibilityCategory[]>;
  unknown_input_values: Array<{ field: 'injuries' | 'equipment' | 'experience' | 'selected_projects'; value: string }>;
  experience: string | null;
}
export interface ClientExerciseSnapshot {
  id: string;
  name: string;
  category: 'warmup' | 'strength' | 'cooldown';
  primary_muscle: string;
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sets: number;
  reps: number;
  duration?: number;
  rest_between_set: number;
  rhythm: string;
  description: string;
  steps: string[];
  tips: string;
  warning: string;
  canonical_exercise_id: string;
  library_version: string;
}
export interface WorkoutExerciseSnapshot {
  exerciseId: string;
  exercise: ClientExerciseSnapshot;
  sets: number;
  reps: number;
  restBetweenSet: number;
  completed: boolean;
}
export interface WorkoutDaySnapshot {
  day: string;
  dayIndex: number;
  type: 'strength' | 'cardio' | 'rest';
  exercises: WorkoutExerciseSnapshot[];
  warmup: ClientExerciseSnapshot[];
  cooldown: ClientExerciseSnapshot[];
}
export interface PlanGenerationSuccess {
  outcome: 'generated';
  id?: number;
  weekNumber: number;
  startDate: string;
  libraryVersion: string;
  days: WorkoutDaySnapshot[];
}
export type PlanGenerationResponse = PlanGenerationSuccess | StructuredUnavailableResult;
export type ValidationOutcome = 'passed' | 'failed';
export type PublicationGate = 'passed' | 'failed';
export type LegacySourcePath = 'data/exercises.json' | 'src/data/exercises.json';
export interface ValidationResult { exercise_id: string | null; rule: string; field: string; invalid_value: unknown; outcome: ValidationOutcome; registry_version: string; }
export interface MigrationRecordOutcome {
  source_path: LegacySourcePath; source_index: number; legacy_record_identifier: string | null;
  outcome: 'migrated' | 'merged' | 'unresolved'; canonical_exercise_id: string | null;
  unresolved_fields: Array<{ field: string; source_value: unknown }>;
  selected_values: Record<string, unknown>;
  conflicts: Array<{ field: string; values_by_source: Record<string, unknown>; selected_value?: unknown }>;
}
export interface MigrationReport { candidate_id: string; source_record_counts: Record<string, number>; outcomes: MigrationRecordOutcome[]; blocking: boolean; }
export interface LibraryValidationReport { candidate_id: string; registry_version: string; allowed_equipment_ids: EquipmentId[]; allowed_muscle_groups: MuscleGroup[]; results: ValidationResult[]; blocking_migration_entries: MigrationRecordOutcome[]; publication_gate: PublicationGate; }
export interface ProfileNormalizationResult { profile?: NormalizedProfile; unavailable?: StructuredUnavailableResult; diagnostics: string[]; }
