import type { AuthMeResponse, LoginInput, RegisterInput } from '@flourish/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { AUTH_ME_QUERY_KEY, useLoginMutation, useMeQuery, useRegisterMutation } from '@/api/auth';
import { clearToken, setToken } from '@/lib/api';

interface AuthContextValue {
  /** undefined while the initial /auth/me check is in flight */
  me: AuthMeResponse | undefined;
  isAuthenticated: boolean;
  /** true only during the initial session check (not during login/register submits) */
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useMeQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await loginMutation.mutateAsync(input);
      setToken(session.token);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
    [loginMutation, queryClient],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await registerMutation.mutateAsync(input);
      setToken(session.token);
      await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
    [registerMutation, queryClient],
  );

  const logout = useCallback(() => {
    clearToken();
    queryClient.setQueryData(AUTH_ME_QUERY_KEY, undefined);
    queryClient.removeQueries({ queryKey: AUTH_ME_QUERY_KEY });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      me: meQuery.data,
      isAuthenticated: !!meQuery.data,
      isLoading: meQuery.isLoading,
      login,
      register,
      logout,
    }),
    [meQuery.data, meQuery.isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
