import { useCallback, useEffect, useState } from 'react';
import { fastF1AnalyticsApi } from '@/api/fastf1Analytics';
import type { FastF1RaceAnalytics, FastF1TelemetryAnalysis } from '@/types';

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

export function useFastF1RaceTelemetry(
  season: string,
  round?: string,
  session = 'R',
) {
  const [data, setData] = useState<FastF1TelemetryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Reset when season/round changes — otherwise loaded=true from a previous
  // race prevents fetch for the new race.
  useEffect(() => {
    setData(null);
    setLoaded(false);
    setError(null);
  }, [season, round]);

  const load = useCallback(() => {
    if (!season || !round || loading || loaded) {
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fastF1AnalyticsApi.getRaceTelemetry(season, round, session, controller.signal)
      .then((payload) => {
        setData(payload?.telemetry || null);
        setLoaded(true);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, [season, round, session, loading, loaded]);

  return { data, loading, error, load, loaded };
}
