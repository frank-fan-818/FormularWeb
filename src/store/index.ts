import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultCurrentSeason } from '@/utils/currentSeason';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentSeason: getDefaultCurrentSeason(),
      setCurrentSeason: (season) => set({ currentSeason: season }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      theme: 'system' as ThemeMode,
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'f1-dashboard-storage',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined;
        const defaultCurrentSeason = getDefaultCurrentSeason();

        return {
          ...state,
          currentSeason: !state?.currentSeason || state.currentSeason === '2025'
            ? defaultCurrentSeason
            : state.currentSeason,
        } as AppState;
      },
    }
  )
);
