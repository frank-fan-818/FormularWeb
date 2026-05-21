import type { FastF1RaceAnalytics } from '@/types';
import { measureRequest } from '@/utils/performance';
import { logger } from '@/utils/logger';
import { supabase } from '@/utils/supabase';

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const FASTF1_SESSION_ANALYTICS_TABLE = 'fastf1_session_analytics';
let databaseAnalyticsUnavailable = false;

function buildAnalyticsUrl(season: string, round: string, session: string) {
  return `${PUBLIC_BASE}/fastf1/${season}/${round}/${session}.json`;
}

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function isMissingAnalyticsTableError(error: unknown) {
  return error instanceof Error
    && error.message.includes(FASTF1_SESSION_ANALYTICS_TABLE)
    && error.message.includes('schema cache');
}

async function getDatabaseAnalytics(
  season: string,
  round: string,
  session: string,
) {
  const seasonNumber = Number(season);
  const roundNumber = Number(round);

  if (
    databaseAnalyticsUnavailable
    || !hasSupabaseConfig()
    || !Number.isFinite(seasonNumber)
    || !Number.isFinite(roundNumber)
  ) {
    return null;
  }

  const query = supabase
    .from(FASTF1_SESSION_ANALYTICS_TABLE)
    .select('payload')
    .eq('season', seasonNumber)
    .eq('round', roundNumber)
    .eq('session', session.toUpperCase())
    .maybeSingle();

  const { data, error } = await measureRequest(
    'supabase',
    `${FASTF1_SESSION_ANALYTICS_TABLE}.getRaceAnalytics`,
    async () => query,
  );

  if (error) {
    if (isMissingAnalyticsTableError(error)) {
      databaseAnalyticsUnavailable = true;
    }
    throw error;
  }

  return (data?.payload as FastF1RaceAnalytics | undefined) || null;
}

export const fastF1AnalyticsApi = {
  async getRaceAnalytics(
    season: string,
    round: string,
    session = 'R',
    signal?: AbortSignal,
  ): Promise<FastF1RaceAnalytics | null> {
    const sessionCode = session.toUpperCase();

    try {
      const databaseAnalytics = await getDatabaseAnalytics(season, round, sessionCode);
      if (databaseAnalytics) {
        return databaseAnalytics;
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (import.meta.env.DEV && !isMissingAnalyticsTableError(error)) {
        logger.warn({
          event: 'exit',
          module: 'fastf1Analytics',
          function: 'getDatabaseAnalytics',
          status: 'failed',
          error: 'FastF1 数据库查询失败，降级到静态 JSON',
        });
      }
    }

    const response = await measureRequest('fetch', `fastf1/${season}/${round}/${sessionCode}.json`, () => fetch(
      buildAnalyticsUrl(season, round, sessionCode),
      {
        signal,
        cache: import.meta.env.DEV ? 'no-cache' : 'force-cache',
      },
    ));

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`FastF1 analytics request failed with ${response.status}`);
    }

    return response.json() as Promise<FastF1RaceAnalytics>;
  },
};
