import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthUser | null;
}

export function useAuth() {
  const { data, isLoading, refetch } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/me'],
    retry: false,
    refetchOnWindowFocus: true,
  });

  return {
    isAuthenticated: data?.authenticated ?? false,
    user: data?.user ?? null,
    isLoading,
    refetch,
  };
}

export async function logout() {
  await apiRequest('/api/auth/logout', {
    method: 'POST',
  });
}

