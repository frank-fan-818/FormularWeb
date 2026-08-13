import { useCallback, useEffect, useRef, useState } from 'react';
import { fastF1AnalyticsApi } from '@/api/fastf1Analytics';
import type { FastF1RaceAnalytics, FastF1TelemetryAnalysis } from '@/types';
import { createLoggerScope } from '@/utils/logger';

export function useFastF1SessionAnalytics(
  season: string,
  round?: string,
  session = 'R',
  enabled = true,
  flowId?: string,
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
    const diagnostics = flowId ? createLoggerScope({
      flowId, feature: 'race_detail', season, round, session, section: 'analytics',
    }) : null;
    const startedAt = performance.now();
    diagnostics?.log({ operation: 'fastf1_analytics', outcome: 'started', source: 'fastf1_static', session });

    setLoading(true);
    setError(null);

    fastF1AnalyticsApi.getRaceAnalytics(season, round, session, controller.signal, diagnostics)
      .then((analytics) => {
        if (controller.signal.aborted) return;
        setData(analytics);
        setDataIdentity(requestIdentity);
        diagnostics?.log({
          operation: 'fastf1_analytics', source: 'fastf1_static', session,
          outcome: analytics ? 'succeeded' : 'empty', durationMs: performance.now() - startedAt,
          itemCount: analytics?.lapTimeSeries?.length || 0,
        });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setData(null);
        setDataIdentity(requestIdentity);
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
        diagnostics?.log({ operation: 'fastf1_analytics', outcome: 'failed', source: 'fastf1_static', error: requestError, session });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [enabled, flowId, reloadKey, requestIdentity, round, season, session]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return {
    data: identityCurrent ? data : null,
    loading: identityCurrent ? loading : enabled && Boolean(season && round),
    error: identityCurrent ? error : null,
    retry,
  };
}

export function useFastF1RaceAnalytics(season: string, round?: string, enabled = true, flowId?: string) {
  return useFastF1SessionAnalytics(season, round, 'R', enabled, flowId);
}

export function useFastF1RaceTelemetry(
  season: string,
  round?: string,
  session = 'R',
  flowId?: string,
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
    const diagnostics = flowId ? createLoggerScope({
      flowId, feature: 'race_detail', season, round, session, section: 'telemetry',
    }) : null;
    diagnostics?.log({ operation: 'fastf1_telemetry', outcome: 'started', source: 'fastf1_static', session });

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    fastF1AnalyticsApi.getRaceTelemetry(season, round, session, controller.signal, diagnostics)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setData(payload?.telemetry || null);
        setDataIdentity(requestIdentity);
        loadedRef.current = true;
        diagnostics?.log({ operation: 'fastf1_telemetry', outcome: payload?.telemetry ? 'succeeded' : 'empty', source: 'fastf1_static', session });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setDataIdentity(requestIdentity);
        setError(requestError instanceof Error ? requestError : new Error(String(requestError)));
        diagnostics?.log({ operation: 'fastf1_telemetry', outcome: 'failed', source: 'fastf1_static', error: requestError, session });
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
  }, [flowId, requestIdentity, season, round, session]);

  return {
    data: identityCurrent ? data : null,
    loading: loadingIdentity === requestIdentity && loading,
    error: identityCurrent ? error : null,
    load,
    loaded: identityCurrent && loadedRef.current,
  };
}
