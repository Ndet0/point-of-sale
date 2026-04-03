import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  name: string;
  role: 'ADMIN' | 'CASHIER';
  businessId: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () => {
        set({ accessToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'pos-auth',
      // Only persist user metadata — never persist access tokens to localStorage
      partialize: (state) => ({ user: state.user }),
    }
  )
);
