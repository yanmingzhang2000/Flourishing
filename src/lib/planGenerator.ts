import { UserProfile, WeeklyPlan } from './types';

/**
 * Plan generation is server-owned. Keeping this guard preserves the old export
 * for integrations while preventing the browser from selecting legacy exercise data.
 */
export function generateWeeklyPlan(_profile: UserProfile, _weekNumber = 1): never {
  throw new Error('Plan generation must use the published exercise library API');
}

export function adjustPlanBasedOnFeedback(
  plan: WeeklyPlan,
  feedback: 'too_easy' | 'just_right' | 'too_hard',
  dayIndex: number,
): WeeklyPlan {
  const newPlan = { ...plan, days: [...plan.days] };
  const day = { ...newPlan.days[dayIndex], exercises: [...newPlan.days[dayIndex].exercises] };
  if (feedback === 'too_easy') {
    day.exercises = day.exercises.map(ex => ({ ...ex, reps: Math.min(ex.reps + 3, 25), sets: Math.min(ex.sets + 1, 4) }));
  } else if (feedback === 'too_hard') {
    day.exercises = day.exercises.map(ex => ({ ...ex, reps: Math.max(ex.reps - 3, 8), sets: Math.max(ex.sets - 1, 1) }));
  }
  newPlan.days[dayIndex] = day;
  return newPlan;
}
