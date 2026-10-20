import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getDefaultCurrentSeason } from '@/utils/currentSeason';
import type { FeatureFlag } from '@/utils/featureFlags';
import { DEFAULT_TIME_ZONE_OFFSET, normalizeTimeZoneOffset } from '@/utils/timeZone';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  timeZoneOffsetMinutes: number;
  setTimeZoneOffsetMinutes: (offsetMinutes: number) => void;
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
      timeZoneOffsetMinutes: DEFAULT_TIME_ZONE_OFFSET,
      setTimeZoneOffsetMinutes: (offsetMinutes) => set({ timeZoneOffsetMinutes: normalizeTimeZoneOffset(offsetMinutes) }),
      features: {},
      setFeature: (feature, enabled) =>
        set((state) => ({ features: { ...state.features, [feature]: enabled } })),
    }),
    {
      name: 'f1-dashboard-storage',
      version: 4,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<AppState> | undefined;
        const defaultCurrentSeason = getDefaultCurrentSeason();

        const migrated = {
          ...state,
          currentSeason: !state?.currentSeason || (version < 3 && state.currentSeason === '2025')
            ? defaultCurrentSeason
            : state.currentSeason,
          timeZoneOffsetMinutes: normalizeTimeZoneOffset(state?.timeZoneOffsetMinutes),
        } as AppState;

        // Version 2 -> 3: add features field
        if (version < 3) {
          migrated.features = {};
        }

        return migrated;
      },
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<AppState> | undefined;
        return { ...currentState, ...state, timeZoneOffsetMinutes: normalizeTimeZoneOffset(state?.timeZoneOffsetMinutes) };
      },
    }
  )
);
