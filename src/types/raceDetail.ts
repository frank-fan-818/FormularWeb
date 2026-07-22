export const RACE_ROUTE_SECTIONS = ['results', 'qualifying', 'race', 'sprint', 'info'] as const;

export type RaceRouteSection = typeof RACE_ROUTE_SECTIONS[number];

export const DEFERRED_RACE_SESSION_KEYS = [
  'fp1',
  'fp2',
  'fp3',
  'sprintQualifying',
  'sprint',
] as const;

export type DeferredRaceSessionKey = typeof DEFERRED_RACE_SESSION_KEYS[number];

export type RaceClassificationSessionKey = DeferredRaceSessionKey | 'qualifying' | 'race';

export type RaceSessionCode = 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SS' | 'S';
