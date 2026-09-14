import { UserProfile, WeeklyPlan, WorkoutDay, WorkoutExercise } from './types';
import { ProjectExercises, Exercise } from './types';
import exercisesData from '../data/exercises.json';

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function generateWeeklyPlan(profile: UserProfile, weekNumber: number = 1): WeeklyPlan {
  const allExercises = exercisesData as ProjectExercises;
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const days: WorkoutDay[] = [];
  const trainingDays = Math.min(profile.maxTrainingDaysPerWeek, 4);

  const trainingSchedule = generateTrainingSchedule(trainingDays);

  // 获取用户选择的第一个项目（V1 简化版，后续可以支持多项目轮换）
  const selectedProjectId = profile.selectedProjects?.[0] || 'tricep_tone';
  const projectExercises = allExercises[selectedProjectId];

  if (!projectExercises) {
    throw new Error(`Project ${selectedProjectId} not found`);
  }

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayType = trainingSchedule[i];

    if (dayType === 'rest') {
      days.push({
        day: DAY_NAMES[(date.getDay()) % 7 === 0 ? 7 : date.getDay()],
        dayIndex: i,
        type: 'rest',
        exercises: [],
        warmup: [],
        cooldown: [],
      });
    } else if (dayType === 'strength') {
      const strengthExercises = selectStrengthExercises(projectExercises, profile);
      days.push({
        day: DAY_NAMES[(date.getDay()) % 7 === 0 ? 7 : date.getDay()],
        dayIndex: i,
        type: 'strength',
        exercises: strengthExercises,
        warmup: projectExercises.warmup.slice(0, 2),
        cooldown: projectExercises.cooldown.slice(0, 2),
      });
    } else {
      days.push({
        day: DAY_NAMES[(date.getDay()) % 7 === 0 ? 7 : date.getDay()],
        dayIndex: i,
        type: 'cardio',
        exercises: [],
        warmup: [],
        cooldown: [],
      });
    }
  }

  return {
    id: `week_${weekNumber}_${Date.now()}`,
    weekNumber,
    startDate: startOfWeek.toISOString().split('T')[0],
    days,
  };
}

function generateTrainingSchedule(trainingDays: number): ('strength' | 'cardio' | 'rest')[] {
  const schedule: ('strength' | 'cardio' | 'rest')[] = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest'];

  if (trainingDays === 3) {
    schedule[1] = 'strength';
    schedule[3] = 'strength';
    schedule[5] = 'strength';
  } else if (trainingDays === 4) {
    schedule[1] = 'strength';
    schedule[2] = 'rest';
    schedule[3] = 'strength';
    schedule[4] = 'rest';
    schedule[5] = 'strength';
    schedule[6] = 'rest';
  } else if (trainingDays === 2) {
    schedule[2] = 'strength';
    schedule[5] = 'strength';
  } else {
    schedule[1] = 'strength';
    schedule[4] = 'strength';
  }

  return schedule;
}

function selectStrengthExercises(exercises: { warmup: Exercise[]; exercises: Exercise[]; cooldown: Exercise[] }, profile: UserProfile): WorkoutExercise[] {
  const filtered = exercises.exercises.filter(ex => {
    if (profile.injuries.some(injury => ex.warning.toLowerCase().includes(injury.toLowerCase()))) {
      return false;
    }
    if (profile.experience === 'zero' && ex.difficulty !== 'beginner') {
      return false;
    }
    return true;
  });

  const selected = filtered.slice(0, 5);

  return selected.map(ex => ({
    exerciseId: ex.id,
    exercise: ex,
    sets: ex.sets,
    reps: ex.reps,
    restBetweenSet: ex.rest_between_set,
    completed: false,
  }));
}

export function adjustPlanBasedOnFeedback(
  plan: WeeklyPlan,
  feedback: 'too_easy' | 'just_right' | 'too_hard',
  dayIndex: number
): WeeklyPlan {
  const newPlan = { ...plan };
  const day = { ...newPlan.days[dayIndex] };

  if (feedback === 'too_easy') {
    day.exercises = day.exercises.map(ex => ({
      ...ex,
      reps: Math.min(ex.reps + 3, 25),
      sets: Math.min(ex.sets + 1, 4),
    }));
  } else if (feedback === 'too_hard') {
    day.exercises = day.exercises.map(ex => ({
      ...ex,
      reps: Math.max(ex.reps - 3, 8),
      sets: Math.max(ex.sets - 1, 1),
    }));
  }

  newPlan.days[dayIndex] = day;
  return newPlan;
}