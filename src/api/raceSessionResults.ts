import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import type { Race } from '@/types';

export type RaceSessionCode = 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SS' | 'S';

interface RaceSessionResultRow {
  season: number;
  round: number;
  session: RaceSessionCode;
  source: 'jolpica' | 'fastf1';
  payload: Race;
}

const missingTableSessions = new Set<string>();
let missingAvailableSessionsTable = false;

async function getAvailableSessions(
  season: string,
  round: string,
): Promise<RaceSessionCode[]> {
  const seasonNumber = Number(season);
  const roundNumber = Number(round);

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(roundNumber) || missingAvailableSessionsTable) {
    return [];
  }

  const query = supabase
    .from('race_session_results')
    .select('session')
    .eq('season', seasonNumber)
    .eq('round', roundNumber);

  const { data, error } = await measureRequest(
    'supabase',
    'race_session_results.getAvailableSessions',
    async () => query,
  );

  if (error) {
    missingAvailableSessionsTable = true;
    return [];
  }

  const sessions = (data || [])
    .map((row) => row.session)
    .filter((session): session is RaceSessionCode =>
      ['FP1', 'FP2', 'FP3', 'SQ', 'SS', 'S'].includes(session),
    );

  return Array.from(new Set(sessions));
}

async function getSessionResult(
  season: string,
  round: string,
  session: RaceSessionCode,
): Promise<Race | null> {
  const seasonNumber = Number(season);
  const roundNumber = Number(round);

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(roundNumber)) {
    return null;
  }

  const fuseKey = `${seasonNumber}-${roundNumber}-${session}`;
  if (missingTableSessions.has(fuseKey)) {
    return null;
  }

  const query = supabase
    .from('race_session_results')
    .select('season, round, session, source, payload')
    .eq('season', seasonNumber)
    .eq('round', roundNumber)
    .eq('session', session)
    .order('source', { ascending: true })
    .limit(1);

  const { data, error } = await measureRequest(
    'supabase',
    'race_session_results.getSessionResult',
    async () => query,
  );

  if (error) {
    missingTableSessions.add(fuseKey);
    return null;
  }

  const row = (data || [])[0] as RaceSessionResultRow | undefined;
  return row?.payload || null;
}

export const raceSessionResultsApi = {
  getAvailableSessions,
  getSessionResult,
  getPracticeResult: (season: string, round: string, practiceNumber: 1 | 2 | 3) =>
    getSessionResult(season, round, `FP${practiceNumber}` as RaceSessionCode),
  getSprintQualifyingResult: async (season: string, round: string) => {
    if (season === '2023') {
      return getSessionResult(season, round, 'SS')
        .then((result) => result || getSessionResult(season, round, 'SQ'));
    }

    return getSessionResult(season, round, 'SQ')
      .then((result) => result || getSessionResult(season, round, 'SS'));
  },
  getSprintResult: (season: string, round: string) =>
    getSessionResult(season, round, 'S'),
};
