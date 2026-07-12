import { useCallback, useEffect, useRef, useState } from 'react';
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
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Reset and cancel obsolete telemetry when the requested session changes.
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setError(null);
    loadingRef.current = false;
    loadedRef.current = false;
    return () => controllerRef.current?.abort();
  }, [season, round, session]);

  const load = useCallback(() => {
    if (!season || !round || loadingRef.current || loadedRef.current) {
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    fastF1AnalyticsApi.getRaceTelemetry(season, round, session, controller.signal)
      .then((payload) => {
        setData(payload?.telemetry || null);
        loadedRef.current = true;
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
        if (!controller.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
        }
      });
  }, [season, round, session]);

  return { data, loading, error, load, loaded: loadedRef.current };
}
