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

export interface UserProfile {
  height: number;
  weight: number;
  bmi: number;
  experience: 'zero' | 'occasional' | 'regular';
  injuries: string[];
  equipment: string[];
  maxTrainingDaysPerWeek: number;
  target: 'tricep_tone';
  singleSessionMaxMin: number;
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