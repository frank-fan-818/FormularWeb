import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '@/store';

const getSystemDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (isDark: boolean) => {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark-mode');
    root.classList.remove('light-mode');
  } else {
    root.classList.remove('dark-mode');
    root.classList.add('light-mode');
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    if (theme === 'dark') {
      applyTheme(true);
      return;
    }

    if (theme === 'light') {
      applyTheme(false);
      return;
    }

    // system
    applyTheme(getSystemDark());

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return <>{children}</>;
};
