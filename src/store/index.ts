import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultCurrentSeason } from '@/utils/currentSeason';
import type { FeatureFlag } from '@/utils/featureFlags';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  features: Partial<Record<FeatureFlag, boolean>>;
  setFeature: (feature: FeatureFlag, enabled: boolean) => void;
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
      features: {},
      setFeature: (feature, enabled) =>
        set((state) => ({ features: { ...state.features, [feature]: enabled } })),
    }),
    {
      name: 'f1-dashboard-storage',
      version: 3,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AppState> | undefined;
        const defaultCurrentSeason = getDefaultCurrentSeason();

        const migrated = {
          ...state,
          currentSeason: !state?.currentSeason || state.currentSeason === '2025'
            ? defaultCurrentSeason
            : state.currentSeason,
        } as AppState;

        // Version 2 -> 3: add features field
        if (version < 3) {
          migrated.features = {};
        }

        return migrated;
      },
    }
  )
);
