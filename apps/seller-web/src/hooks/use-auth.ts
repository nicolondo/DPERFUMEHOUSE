'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { login as authLogin, logout as authLogout, isAuthenticated } from '@/lib/auth';

export function useAuth() {
  const router = useRouter();
  const { user, isAuthenticated: isAuthed, isLoading, setUser, setLoading, hydrate, clear } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await authLogin(email, password);
      setUser(data.user);
      router.push('/dashboard');
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clear();
    authLogout();
  };

  const checkAuth = () => {
    if (!isAuthenticated()) {
      clear();
      router.push('/login');
      return false;
    }
    return true;
  };

  return {
    user,
    isAuthenticated: isAuthed,
    isLoading,
    login,
    logout,
    checkAuth,
  };
}
