import { useEffect, useMemo, useState } from 'react';
import {
  buildPostRaceTelemetrySummary,
  raceWeekendAnalyticsApi,
} from '@/api/raceWeekendAnalytics';
import type {
  DriverPostRaceTelemetrySummary,
  FastF1RaceAnalytics,
  RacePreviewSummary,
} from '@/types';

export function useRacePreviewSummary(
  season: string,
  round: string | undefined,
  circuitId: string | undefined,
) {
  const [data, setData] = useState<RacePreviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!season || !round || !circuitId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    raceWeekendAnalyticsApi.getRacePreviewSummary(season, round, circuitId)
      .then((summary) => {
        if (!cancelled) {
          setData(summary);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
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
  }, [circuitId, round, season]);

  return { data, loading, error };
}

export function usePostRaceTelemetrySummary(
  analytics: FastF1RaceAnalytics | null | undefined,
): DriverPostRaceTelemetrySummary[] {
  return useMemo(() => buildPostRaceTelemetrySummary(analytics), [analytics]);
}
