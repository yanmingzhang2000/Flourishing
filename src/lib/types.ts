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

export interface ExerciseData {
  warmup: Exercise[];
  exercises: Exercise[];
  cooldown: Exercise[];
}

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
  createdAt: string;
}

export interface UserProfile {
  // 训练偏好（引导必填）
  experience: 'zero' | 'occasional' | 'regular';
  injuries: string[];
  equipment: string[];
  maxTrainingDaysPerWeek: number;
  /** 自定义训练日：0=周日 … 6=周六；未设置时按天数自动排期 */
  trainingDays?: number[];
  /** @deprecated V2 改为 projectInstances，保留向后兼容 */
  selectedProjects: string[];
  singleSessionMaxMin: number;
  /** V2 onboarding 完成标志 */
  onboardingCompleted?: boolean;
  // 身体信息（个人页可选填）
  height?: number;
  weight?: number;
  bmi?: number;
  age?: number;
  displayName?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exercise: Exercise;
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
  warmup: Exercise[];
  cooldown: Exercise[];
}

export interface WeeklyPlan {
  id: string;
  weekNumber: number;
  startDate: string;
  days: WorkoutDay[];
}

export interface TrainingRecord {
  date: string;
  weekPlanId: string;
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