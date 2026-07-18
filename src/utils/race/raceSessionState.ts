import type { Race } from '@/types';
import {
  DEFERRED_RACE_SESSION_KEYS,
  RACE_ROUTE_SECTIONS,
  type DeferredRaceSessionKey,
  type RaceRouteSection,
  type RaceSessionCode,
} from '@/types/raceDetail';

const SESSION_CODE_TO_TAB: Record<RaceSessionCode, DeferredRaceSessionKey> = {
  FP1: 'fp1',
  FP2: 'fp2',
  FP3: 'fp3',
  SQ: 'sprintQualifying',
  SS: 'sprintQualifying',
  S: 'sprint',
};

export function getRaceRouteSection(pathname: string): RaceRouteSection {
  const segments = pathname.split('/').filter(Boolean);
  const requestedSection = segments[segments.length - 1];
  return RACE_ROUTE_SECTIONS.includes(requestedSection as RaceRouteSection)
    ? requestedSection as RaceRouteSection
    : 'results';
}

export function getAvailableDeferredSessionTabs(
  race: Race | null,
  databaseSessions: RaceSessionCode[],
): DeferredRaceSessionKey[] {
  const available = new Set<DeferredRaceSessionKey>();

  if (race?.FirstPractice) available.add('fp1');
  if (race?.SecondPractice) available.add('fp2');
  if (race?.ThirdPractice) available.add('fp3');
  if (race?.SprintQualifying) available.add('sprintQualifying');
  if (race?.Sprint) available.add('sprint');

  databaseSessions.forEach((sessionCode) => available.add(SESSION_CODE_TO_TAB[sessionCode]));

  return DEFERRED_RACE_SESSION_KEYS.filter((sessionKey) => available.has(sessionKey));
}

export function getRaceIdentity(season: string, round: string | undefined): string {
  return `${season}:${round || ''}`;
}

export function isRaceIdentityCurrent(
  dataIdentity: string | null,
  season: string,
  round: string | undefined,
): boolean {
  return dataIdentity === getRaceIdentity(season, round);
}
