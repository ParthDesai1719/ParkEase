import { create } from 'zustand';
import { getMe, logout as apiLogout } from '../api/auth.api';
import type { User } from '../types/auth';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string, user?: User) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Zustand Auth Store
 *
 * Security Constraints:
 * 1. Access token is stored ONLY in memory in this store.
 * 2. It is NEVER written to localStorage, sessionStorage, or IndexedDB.
 * 3. Refresh tokens are stored exclusively in HttpOnly cookies managed by the server.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, accessToken: string) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  setAccessToken: (accessToken: string, user?: User) =>
    set((state) => ({
      accessToken,
      user: user ?? state.user,
      isAuthenticated: true,
      isLoading: false,
    })),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  setLoading: (isLoading: boolean) =>
    set({
      isLoading,
    }),

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await getMe();
      if (response.success && response.data?.user) {
        set({
          user: response.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await apiLogout();
    } catch {
      // Ignore network failure on logout; force local cleanup
    } finally {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
