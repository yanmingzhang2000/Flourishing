export interface Project {
  id: string;
  name: string;
  subtitle: string;
  target_area: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_minutes: number;
  equipment_needed: string[];
  icon: string;
  color: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: 'warmup' | 'strength' | 'cooldown';
  primary_muscle: string;
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sets: number;
  reps: number;
  rest_between_set: number;
  rhythm: string;
  description: string;
  steps: string[];
  tips: string;
  warning: string;
  alternative?: string[];
}

/**
 * A rendered exercise snapshot. New plans include canonical identity/version,
 * while older persisted plans may contain only the legacy display fields.
 */
export interface ExerciseSnapshot extends Exercise {
  canonical_exercise_id?: string;
  library_version?: string;
}

export interface ExerciseData {
  warmup: ExerciseSnapshot[];
  exercises: ExerciseSnapshot[];
  cooldown: ExerciseSnapshot[];
}

export type ProjectExerciseContent = ExerciseData;

export interface ProjectExercises {
  [projectId: string]: ExerciseData;
}

export interface UserProfile {
  // 训练偏好（引导必填）
  experience: 'zero' | 'occasional' | 'regular';
  injuries: string[];
  equipment: string[];
  maxTrainingDaysPerWeek: number;
  /** ISO-week day indices the user wants to train: 0=Mon … 6=Sun */
  trainingDays?: number[];
  selectedProjects: string[];
  singleSessionMaxMin: number;
  // 身体信息（个人页可选填）
  height?: number;
  weight?: number;
  bmi?: number;
  age?: number;
  displayName?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exercise: ExerciseSnapshot;
  sets: number;
  reps: number;
  restBetweenSet: number;
  completed: boolean;
}

export interface WorkoutDay {
  day: string;
  dayIndex: number;
  type: 'strength' | 'cardio' | 'rest';
  exercises: WorkoutExercise[];
  warmup: ExerciseSnapshot[];
  cooldown: ExerciseSnapshot[];
}

export interface WeeklyPlan {
  id: string | number;
  weekNumber: number;
  startDate: string;
  days: WorkoutDay[];
}

/** The immutable plan payload returned by current, month, and :id endpoints. */
export type PlanSnapshot = WeeklyPlan;
export type HistoricalPlanSnapshot = WeeklyPlan;

export interface TrainingRecord {
  date: string;
  weekPlanId: string | number;
  dayIndex: number;
  completed: boolean;
  feedback?: 'too_easy' | 'just_right' | 'too_hard';
  hasJointPain: boolean;
  completedExercises: string[];
}

export interface UserStats {
  totalWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  completedDays: string[];
}

export interface StructuredUnavailableResult {
  outcome: 'temporarily_unavailable';
  display_message: '暂不可生成';
  requested_project_ids: string[];
  failed_eligibility_categories_by_project: Record<string, string[]>;
  unknown_input_values: Array<{
    field: 'injuries' | 'equipment' | 'experience' | 'selected_projects' | string;
    value: string;
  }>;
  experience: string | null;
}

export interface PlanGenerationSuccess extends WeeklyPlan {
  outcome: 'generated';
  libraryVersion: string;
}

/** Discriminated response shared by week and month generation callers. */
export type PlanGenerationResponse = PlanGenerationSuccess | StructuredUnavailableResult;

export interface MonthPlanGenerationSuccess {
  outcome: 'generated';
  generated: number;
  plans: PlanSnapshot[];
  libraryVersion: string;
}

export type MonthPlanGenerationResponse = MonthPlanGenerationSuccess | StructuredUnavailableResult;

export interface CurrentExercise extends ExerciseSnapshot {
  canonical_exercise_id: string;
  library_version: string;
}

export type CurrentExerciseResponse = CurrentExercise;
export type HistoricalExerciseSnapshot = ExerciseSnapshot;
export type ProjectExercisesResponse = ProjectExerciseContent;
