import { createContext, useContext, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  regionFormat: string;
  timeFormat: string;
  weekStart: string;
  dateFormatType: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (name: string, email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ data: CurrentUser }>('/auth/me');
        return data.data;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await api.post<{ data: CurrentUser }>('/auth/login', { email, password });
      return data.data;
    },
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], user),
  });

  const registerMutation = useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const { data } = await api.post<{ data: CurrentUser }>('/auth/register', { name, email, password });
      return data.data;
    },
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], user),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => queryClient.setQueryData(['auth', 'me'], null),
  });

  const value: AuthContextValue = {
    user: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    login: async (email, password) => loginMutation.mutateAsync({ email, password }),
    register: async (name, email, password) => registerMutation.mutateAsync({ name, email, password }),
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
