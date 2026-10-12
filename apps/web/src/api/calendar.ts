import {
  activePlanResponseSchema,
  trainingRecordSchema,
  type ActivePlanResponse,
  type TrainingRecord,
} from '@flourish/contracts';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet } from '@/lib/api';

export const ACTIVE_PLAN_QUERY_KEY_ROOT = ['active-plan'] as const;
export const RECORDS_QUERY_KEY = ['records'] as const;

/** Newest active plan covering `date` (calendar browsing; same rule as /today). */
export function useActivePlan(date: string) {
  return useQuery<ActivePlanResponse>({
    queryKey: [...ACTIVE_PLAN_QUERY_KEY_ROOT, date],
    queryFn: () =>
      apiGet(`/api/plans/active?date=${encodeURIComponent(date)}`, activePlanResponseSchema),
    retry: 1,
  });
}

/** Own training history (newest first). Key matches useCompleteSession's invalidation. */
export function useTrainingRecords() {
  return useQuery<TrainingRecord[]>({
    queryKey: RECORDS_QUERY_KEY,
    queryFn: () => apiGet('/api/records', z.array(trainingRecordSchema)),
    retry: 1,
  });
}
