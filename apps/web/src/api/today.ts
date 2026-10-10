import {
  exerciseListResponseSchema,
  todayPlanResponseSchema,
  type ExerciseListResponse,
  type TodayPlanResponse,
} from '@flourish/contracts';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export function useTodayPlan() {
  return useQuery<TodayPlanResponse>({
    queryKey: ['today-plan'],
    queryFn: () => apiGet('/api/plans/today', todayPlanResponseSchema),
    retry: 1,
  });
}

export function useExercises() {
  return useQuery<ExerciseListResponse>({
    queryKey: ['exercises'],
    queryFn: () => apiGet('/api/exercises', exerciseListResponseSchema),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
