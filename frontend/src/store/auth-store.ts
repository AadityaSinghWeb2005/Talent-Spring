import { create } from "zustand";
import type { AuthUser } from "@/lib/types";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  ready: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearSession: () => void;
  setReady: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  ready: false,
  setSession: (accessToken, user) => set({ accessToken, user, ready: true }),
  clearSession: () => set({ accessToken: null, user: null, ready: true }),
  setReady: () => set({ ready: true }),
}));
