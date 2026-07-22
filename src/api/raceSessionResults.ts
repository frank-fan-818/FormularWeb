import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import type { Race, RaceSessionCode } from '@/types';
import { withRetry } from '@/utils/withRetry';
import { RaceSchema } from '@/api/schemas';

interface RaceSessionResultRow {
  season: number;
  round: number;
  session: RaceSessionCode;
  source: 'jolpica' | 'fastf1';
  payload: Race;
}

const missingTableSessions = new Map<string, number>();
let missingAvailableSessionsUntil = 0;
const SCHEMA_FUSE_TTL_MS = 60_000;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === '42P01'
    || candidate.message?.toLowerCase().includes('schema cache') === true;
}

async function getAvailableSessions(
  season: string,
  round: string,
): Promise<RaceSessionCode[]> {
  const seasonNumber = Number(season);
  const roundNumber = Number(round);

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(roundNumber) || Date.now() < missingAvailableSessionsUntil) {
    return [];
  }

  const { data, error } = await withRetry(async (signal) => {
    const result = await measureRequest(
      'supabase',
      'race_session_results.getAvailableSessions',
      async () => supabase
        .from('race_session_results')
        .select('session')
        .eq('season', seasonNumber)
        .eq('round', roundNumber)
        .abortSignal(signal),
    );
    if (result.error) throw result.error;
    return result;
  }, { timeoutMs: 5000, maxRetries: 1 }).catch((queryError: unknown) => ({ data: null, error: queryError }));

  if (error) {
    if (isMissingTableError(error)) {
      missingAvailableSessionsUntil = Date.now() + SCHEMA_FUSE_TTL_MS;
      return [];
    }
    throw error;
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
  if ((missingTableSessions.get(fuseKey) || 0) > Date.now()) {
    return null;
  }

  const { data, error } = await withRetry(async (signal) => {
    const result = await measureRequest(
      'supabase',
      'race_session_results.getSessionResult',
      async () => supabase
        .from('race_session_results')
        .select('season, round, session, source, payload')
        .eq('season', seasonNumber)
        .eq('round', roundNumber)
        .eq('session', session)
        .abortSignal(signal),
    );
    if (result.error) throw result.error;
    return result;
  }, { timeoutMs: 5000, maxRetries: 1 }).catch((queryError: unknown) => ({ data: null, error: queryError }));

  if (error) {
    if (isMissingTableError(error)) {
      missingTableSessions.set(fuseKey, Date.now() + SCHEMA_FUSE_TTL_MS);
      return null;
    }
    throw error;
  }

  const candidates = (data || [])
    .map((candidate) => {
      const row = candidate as RaceSessionResultRow;
      const parsed = RaceSchema.safeParse(row.payload);
      if (!parsed.success || parsed.data.season !== season || parsed.data.round !== round || row.session !== session) {
        return null;
      }
      const payload = parsed.data as Race;
      const participantCount = Math.max(
        payload.Results?.length || 0,
        payload.QualifyingResults?.length || 0,
        payload.SprintResults?.length || 0,
      );
      return { payload, participantCount, sourcePriority: row.source === 'jolpica' ? 1 : 0 };
    })
    .filter((candidate): candidate is { payload: Race; participantCount: number; sourcePriority: number } => Boolean(candidate))
    .sort((a, b) => b.participantCount - a.participantCount || b.sourcePriority - a.sourcePriority);
  return candidates[0]?.payload || null;
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
