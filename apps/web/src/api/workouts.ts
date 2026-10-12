import {
  completeSessionResponseSchema,
  jointDiscomfortResponseSchema,
  workoutSessionSchema,
  type CompleteSessionInput,
  type CompleteSessionResponse,
  type JointDiscomfortInput,
  type JointDiscomfortResponse,
  type SessionExerciseActionInput,
  type WorkoutSession,
} from '@flourish/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';

export function workoutSessionKey(planId: string, date: string): readonly [string, string, string] {
  return ['workout-session', planId, date];
}

/**
 * Start (or idempotently resume) the session for one planned day.
 * POST is intentional: the server returns the existing session for this
 * plan-day unchanged (refresh/retry safe — workouts.service startSession).
 */
export function useSession(planId: string | undefined, date: string) {
  return useQuery<WorkoutSession>({
    queryKey: workoutSessionKey(planId ?? 'none', date),
    enabled: Boolean(planId),
    retry: 1,
    queryFn: () =>
      apiPost(
        '/api/workouts/sessions',
        { weekPlanId: planId, date },
        workoutSessionSchema,
      ),
  });
}

/** Every session mutation returns the full updated session — write it back. */
function useSessionInvalidator() {
  const queryClient = useQueryClient();
  return (session: WorkoutSession) => {
    queryClient.setQueryData(
      workoutSessionKey(session.weekPlanId, session.date),
      session,
    );
  };
}

export function useSessionAction(planId: string, date: string) {
  const applySession = useSessionInvalidator();
  return useMutation({
    mutationFn: ({
      sessionId,
      exerciseId,
      input,
    }: {
      sessionId: string;
      exerciseId: string;
      input: SessionExerciseActionInput;
    }) =>
      apiPost(
        `/api/workouts/sessions/${encodeURIComponent(sessionId)}/exercises/${encodeURIComponent(
          exerciseId,
        )}`,
        input,
        workoutSessionSchema,
      ),
    onSuccess: (session: WorkoutSession) => applySession(session),
  });
}

/**
 * SAFE-05: report joint discomfort. The response carries the updated
 * session plus deterministic blocked list, alternatives and rest advice.
 */
export function useJointDiscomfort(planId: string, date: string) {
  const applySession = useSessionInvalidator();
  return useMutation({
    mutationFn: ({
      sessionId,
      input,
    }: {
      sessionId: string;
      input: JointDiscomfortInput;
    }) =>
      apiPost(
        `/api/workouts/sessions/${encodeURIComponent(sessionId)}/joint-discomfort`,
        input,
        jointDiscomfortResponseSchema,
      ),
    onSuccess: (response: JointDiscomfortResponse) => applySession(response.session),
  });
}

export function useCompleteSession(planId: string, date: string) {
  const queryClient = useQueryClient();
  const applySession = useSessionInvalidator();
  return useMutation({
    mutationFn: ({
      sessionId,
      input,
    }: {
      sessionId: string;
      input: CompleteSessionInput;
    }) =>
      apiPost(
        `/api/workouts/sessions/${encodeURIComponent(sessionId)}/complete`,
        input,
        completeSessionResponseSchema,
      ),
    onSuccess: (response: CompleteSessionResponse) => {
      applySession(response.session);
      // Completion writes a training record -> today's plan card (progress,
      // completed flags) and records history must refresh immediately.
      void queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      void queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useAbortSession(planId: string, date: string) {
  const applySession = useSessionInvalidator();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiPost(
        `/api/workouts/sessions/${encodeURIComponent(sessionId)}/abort`,
        {},
        workoutSessionSchema,
      ),
    onSuccess: (session: WorkoutSession) => applySession(session),
  });
}
