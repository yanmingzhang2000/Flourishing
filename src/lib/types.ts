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
  media?: {
    cover_image?: string;
    video?: string;
  };
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

/** 单个训练项目实例，代表用户正在进行的一个独立训练计划 */
export interface ProjectInstance {
  id: string;
  projectId: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;           // ISO 日期字符串 YYYY-MM-DD
  targetWeeks: 4 | 6 | 8;
  currentWeek: number;
  trainingDaysPerWeek?: number;
  sessionMinutes?: number;
  createdAt: string;
}

export interface UserProfile {
  /** @deprecated V2 改为 projectInstances，保留向后兼容 */
  selectedProjects?: string[];
  // 身体信息
  height?: number;
  weight?: number;
  bmi?: number;
  age?: number;
  displayName?: string;
  // 训练背景
  experience: 'zero' | 'occasional' | 'regular';
  injuries: string[];
  // 可用器械
  equipment: string[];
  // 训练偏好（全局默认值）
  maxTrainingDaysPerWeek: number;
  /** ISO-week day indices the user wants to train: 0=Mon … 6=Sun */
  trainingDays?: number[];
  singleSessionMaxMin: number;
  // 状态
  onboardingCompleted: boolean;
  // 项目实例列表
  projectInstances: ProjectInstance[];
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
  /** 当天对应的训练项目 ID（多项目轮换时使用） */
  projectId?: string;
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
