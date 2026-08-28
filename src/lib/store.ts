"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Role, SessionUser } from "./types";

export interface AppState {
  user: SessionUser | null;
  token: string | null;
  view: string;
  selectedPetId: string | null;
  authMode: "login" | "register";
  login: (user: SessionUser, token: string) => void;
  logout: () => void;
  setView: (v: string) => void;
  setSelectedPetId: (id: string | null) => void;
  setAuthMode: (m: "login" | "register") => void;
}

/** Home view per role (CONTRACT): ADMIN→admin-dashboard, STAFF→staff-dashboard, VET/GROOMER→vet-dashboard, CUSTOMER→cust-dashboard */
export function homeViewForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "admin-dashboard";
    case "STAFF":
      return "staff-dashboard";
    case "VET":
    case "GROOMER":
      return "vet-dashboard";
    default:
      return "cust-dashboard";
  }
}

/** View prefix per role — used by the shell's role guard. */
export function rolePrefixFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "admin-";
    case "STAFF":
      return "staff-";
    case "VET":
    case "GROOMER":
      return "vet-";
    default:
      return "cust-";
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      view: "landing",
      selectedPetId: null,
      authMode: "login",
      login: (user, token) => set({ user, token, view: homeViewForRole(user.role) }),
      logout: () => set({ user: null, token: null, view: "landing", selectedPetId: null }),
      setView: (view) => set({ view }),
      setSelectedPetId: (selectedPetId) => set({ selectedPetId }),
      setAuthMode: (authMode) => set({ authMode }),
    }),
    {
      name: "pawcare-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        view: s.view,
        selectedPetId: s.selectedPetId,
        authMode: s.authMode,
      }),
    }
  )
);
