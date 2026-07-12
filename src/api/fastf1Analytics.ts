import type { FastF1RaceAnalytics, FastF1TelemetryPayload } from '@/types';
import { measureRequest } from '@/utils/performance';
import { logger } from '@/utils/logger';
import { supabase } from '@/utils/supabase';
import { FastF1AnalyticsEnvelopeSchema, FastF1TelemetryEnvelopeSchema } from '@/api/schemas';
import { withRetry } from '@/utils/withRetry';

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const FASTF1_SESSION_ANALYTICS_TABLE = 'fastf1_session_analytics';
let databaseAnalyticsUnavailableUntil = 0;
const DATABASE_SCHEMA_FUSE_TTL_MS = 60_000;

function buildAnalyticsUrl(season: string, round: string, session: string) {
  return `${PUBLIC_BASE}/fastf1/${season}/${round}/${session}.json`;
}

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function isMissingAnalyticsTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: string; message?: string };
  return candidate.code === '42P01'
    || (candidate.message?.includes(FASTF1_SESSION_ANALYTICS_TABLE) === true
      && candidate.message.includes('schema cache'));
}

function assertSnapshotIdentity(
  payload: { season: string; round: string; session: string },
  season: string,
  round: string,
  session: string,
): void {
  if (payload.season !== season || payload.round !== round || payload.session.toUpperCase() !== session.toUpperCase()) {
    throw new Error('FastF1 snapshot identity does not match the requested session');
  }
}

async function getDatabaseAnalytics(
  season: string,
  round: string,
  session: string,
  signal?: AbortSignal,
) {
  const seasonNumber = Number(season);
  const roundNumber = Number(round);

  if (
    Date.now() < databaseAnalyticsUnavailableUntil
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
    .abortSignal(signal ?? new AbortController().signal)
    .maybeSingle();

  const { data, error } = await measureRequest(
    'supabase',
    `${FASTF1_SESSION_ANALYTICS_TABLE}.getRaceAnalytics`,
    async () => query,
  );

  if (error) {
    if (isMissingAnalyticsTableError(error)) {
      databaseAnalyticsUnavailableUntil = Date.now() + DATABASE_SCHEMA_FUSE_TTL_MS;
    }
    throw error;
  }

  if (!data?.payload) return null;
  databaseAnalyticsUnavailableUntil = 0;
  return FastF1AnalyticsEnvelopeSchema.parse(data.payload) as FastF1RaceAnalytics;
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
      const databaseAnalytics = await withRetry(
        (attemptSignal) => getDatabaseAnalytics(season, round, sessionCode, attemptSignal),
        { timeoutMs: 5000, maxRetries: 1, signal },
      );
      if (databaseAnalytics) {
        assertSnapshotIdentity(databaseAnalytics, season, round, sessionCode);
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

    const response = await withRetry(
      (attemptSignal) => measureRequest('fetch', `fastf1/${season}/${round}/${sessionCode}.json`, async () => {
        const result = await fetch(buildAnalyticsUrl(season, round, sessionCode), {
          signal: attemptSignal,
          cache: import.meta.env.DEV ? 'no-cache' : 'default',
        });
        if (!result.ok && result.status !== 404) {
          const error = new Error(`FastF1 analytics request failed with ${result.status}`) as Error & { status: number };
          error.status = result.status;
          throw error;
        }
        return result;
      }),
      { timeoutMs: 8000, maxRetries: 2, signal },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`FastF1 analytics request failed with ${response.status}`);
    }

    const payload = FastF1AnalyticsEnvelopeSchema.parse(await response.json()) as FastF1RaceAnalytics;
    assertSnapshotIdentity(payload, season, round, sessionCode);
    return payload;
  },

  async getRaceTelemetry(
    season: string,
    round: string,
    session = 'R',
    signal?: AbortSignal,
  ): Promise<FastF1TelemetryPayload | null> {
    const sessionCode = session.toUpperCase();

    // Try Supabase first (telemetry might be stored in the payload column too)
    // For now, just fetch the static file
    const response = await withRetry(
      (attemptSignal) => measureRequest('fetch', `fastf1-telemetry/${season}/${round}/${sessionCode}`, async () => {
        const result = await fetch(buildAnalyticsUrl(season, round, `${sessionCode}-telemetry`), {
          signal: attemptSignal,
          cache: import.meta.env.DEV ? 'no-cache' : 'default',
        });
        if (!result.ok && result.status !== 404) {
          const error = new Error(`FastF1 telemetry request failed with ${result.status}`) as Error & { status: number };
          error.status = result.status;
          throw error;
        }
        return result;
      }),
      { timeoutMs: 8000, maxRetries: 2, signal },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`FastF1 telemetry request failed with ${response.status}`);
    }

    const payload = FastF1TelemetryEnvelopeSchema.parse(await response.json()) as unknown as FastF1TelemetryPayload;
    assertSnapshotIdentity(payload, season, round, sessionCode);
    return payload;
  },
};
