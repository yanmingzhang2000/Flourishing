import {
  generatePlanResponseSchema,
  type GeneratePlanInput,
  type GeneratePlanResponse,
} from '@flourish/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanInput) =>
      apiPost('/api/plans/generate', input, generatePlanResponseSchema),
    onSuccess: (response: GeneratePlanResponse) => {
      // The Home page's today card reads /api/plans/today — refetch it so
      // the freshly generated plan shows up immediately after navigation.
      void queryClient.invalidateQueries({ queryKey: ['today-plan'] });
    },
  });
}
