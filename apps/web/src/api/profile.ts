import {
  profileSchema,
  type Profile,
  type UpdateProfileInput,
} from '@flourish/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';

export const PROFILE_QUERY_KEY = ['profile'] as const;

export function useProfile() {
  return useQuery<Profile>({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => apiGet('/api/users/me/profile', profileSchema),
    retry: 1,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProfileInput) =>
      apiPut('/api/users/me/profile', patch, profileSchema),
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
    },
  });
}
