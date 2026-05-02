import { useEffect, useState } from 'react';
import { fastF1AnalyticsApi } from '@/api/fastf1Analytics';
import type { FastF1RaceAnalytics } from '@/types';

export function useFastF1SessionAnalytics(
  season: string,
  round?: string,
  session = 'R',
  enabled = true,
) {
  const [data, setData] = useState<FastF1RaceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !season || !round) {
      setData(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fastF1AnalyticsApi.getRaceAnalytics(season, round, session, controller.signal)
      .then((analytics) => {
        setData(analytics);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, round, season, session]);

  return { data, loading, error };
}

export function useFastF1RaceAnalytics(season: string, round?: string, enabled = true) {
  return useFastF1SessionAnalytics(season, round, 'R', enabled);
}
