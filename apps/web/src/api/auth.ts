import {
  authMeResponseSchema,
  authSessionSchema,
  loginInputSchema,
  registerInputSchema,
  type AuthMeResponse,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from '@flourish/contracts';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiGet, apiPost, getToken } from '@/lib/api';

export function useLoginMutation() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiPost('/api/auth/login', input, authSessionSchema, false),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiPost('/api/auth/register', input, authSessionSchema, false),
  });
}

export const AUTH_ME_QUERY_KEY = ['auth', 'me'] as const;

export function useMeQuery(options?: Partial<UseQueryOptions<AuthMeResponse>>) {
  return useQuery<AuthMeResponse>({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: () => apiGet('/api/auth/me', authMeResponseSchema),
    enabled: !!getToken(),
    retry: false,
    ...options,
  });
}

export type { AuthSession };
