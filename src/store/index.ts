import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentSeason: '2025',
      setCurrentSeason: (season) => set({ currentSeason: season }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'f1-dashboard-storage',
    }
  )
);
