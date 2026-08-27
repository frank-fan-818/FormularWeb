import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildPostRaceTelemetrySummary,
  raceWeekendAnalyticsApi,
} from '@/api/raceWeekendAnalytics';
import type {
  DriverPostRaceTelemetrySummary,
  FastF1RaceAnalytics,
  RacePreviewSummary,
} from '@/types';
import { RequestTimeoutError, withTimeout } from '@/utils/withRetry';

const RACE_PREVIEW_TIMEOUT_MS = 10_000;

export function useRacePreviewSummary(
  season: string,
  round: string | undefined,
  circuitId: string | undefined,
  enabled = true,
) {
  const [data, setData] = useState<RacePreviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdentity = `${season}:${round || ''}:${circuitId || ''}`;
  const identityCurrent = enabled && Boolean(season && round && circuitId)
    && dataIdentity === requestIdentity;

  useEffect(() => {
    if (!enabled || !season || !round || !circuitId) {
      setData(null);
      setDataIdentity(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    withTimeout(
      raceWeekendAnalyticsApi.getRacePreviewSummary(season, round, circuitId),
      RACE_PREVIEW_TIMEOUT_MS,
    )
      .then((summary) => {
        if (!cancelled) {
          setData(summary);
          setDataIdentity(requestIdentity);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setData(null);
          setDataIdentity(requestIdentity);
          setError(requestError instanceof RequestTimeoutError
            ? new Error('历史比赛数据请求超时，请稍后重试')
            : requestError instanceof Error ? requestError : new Error(String(requestError)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [circuitId, enabled, reloadKey, requestIdentity, round, season]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return {
    data: identityCurrent ? data : null,
    loading: identityCurrent ? loading : enabled && Boolean(season && round && circuitId),
    error: identityCurrent ? error : null,
    retry,
  };
}

export function usePostRaceTelemetrySummary(
  analytics: FastF1RaceAnalytics | null | undefined,
): DriverPostRaceTelemetrySummary[] {
  return useMemo(() => buildPostRaceTelemetrySummary(analytics), [analytics]);
}
