import { create } from 'zustand';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setLoading: (loading: boolean) => void;
  hydrate: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

  setLoading: (loading) => set({ isLoading: loading }),

  hydrate: () => {
    try {
      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('access_token');

      if (userStr && token) {
        const user = JSON.parse(userStr) as User;
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
}));
