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
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdentity = `${season}:${round || ''}:${session}`;
  const identityCurrent = enabled && Boolean(season && round) && dataIdentity === requestIdentity;

  useEffect(() => {
    if (!enabled || !season || !round) {
      setData(null);
      setDataIdentity(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fastF1AnalyticsApi.getRaceAnalytics(season, round, session, controller.signal)
      .then((analytics) => {
        if (controller.signal.aborted) return;
        setData(analytics);
        setDataIdentity(requestIdentity);
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
        setDataIdentity(requestIdentity);
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, reloadKey, requestIdentity, round, season, session]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return {
    data: identityCurrent ? data : null,
    loading: identityCurrent ? loading : enabled && Boolean(season && round),
    error: identityCurrent ? error : null,
    retry,
  };
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
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdentity = `${season}:${round || ''}:${session}`;
  const identityCurrent = dataIdentity === requestIdentity;

  // Reset and cancel obsolete telemetry when the requested session changes.
  useEffect(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setDataIdentity(null);
    setLoadingIdentity(null);
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
    setLoadingIdentity(requestIdentity);
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    fastF1AnalyticsApi.getRaceTelemetry(season, round, session, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload?.telemetry || null);
        setDataIdentity(requestIdentity);
        loadedRef.current = true;
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setDataIdentity(requestIdentity);
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
  }, [requestIdentity, season, round, session]);

  return {
    data: identityCurrent ? data : null,
    loading: loadingIdentity === requestIdentity && loading,
    error: identityCurrent ? error : null,
    load,
    loaded: identityCurrent && loadedRef.current,
  };
}
