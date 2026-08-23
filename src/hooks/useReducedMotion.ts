import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type MatchMedia = (query: string) => Pick<MediaQueryList, 'matches'>;

export const getReducedMotionPreference = (
  matchMediaImpl: MatchMedia | undefined = globalThis.matchMedia,
): boolean => matchMediaImpl?.(REDUCED_MOTION_QUERY).matches ?? false;

const subscribe = (onChange: () => void) => {
  if (typeof globalThis.matchMedia !== 'function') return () => undefined;
  const mediaQuery = globalThis.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
};

export const useReducedMotion = (): boolean => useSyncExternalStore(
  subscribe,
  () => getReducedMotionPreference(),
  () => false,
);

