import { useCallback, useEffect, useState } from 'react';
import type { FastF1WeatherSummary } from '@/types';

interface Options {
  season: string; round: string; enabled: boolean; memberId: string;
  primarySummary: FastF1WeatherSummary | null; primaryLoading: boolean; primaryError: Error | null;
  retryPrimary: () => void;
}

export function useRaceWeatherSummary({ season, round, enabled, memberId, primarySummary, primaryLoading, primaryError, retryPrimary }: Options) {
  const identity = `${memberId}:${season}:${round}`;
  const [attempt, setAttempt] = useState(0);
  const [fallback, setFallback] = useState<{ identity: string; summary: FastF1WeatherSummary | null; loading: boolean; error: Error | null } | null>(null);
  const canFallback = enabled && Number(season) >= 2023 && Boolean(round) && !primarySummary && !primaryLoading;
  useEffect(() => {
    if (!canFallback) return;
    const controller = new AbortController();
    setFallback({ identity, summary: null, loading: true, error: null });
    void import('@/api/raceWeather').then(({ getRaceWeather }) => getRaceWeather(season, round, controller.signal)).then(result => {
      if (!controller.signal.aborted) setFallback({ identity, summary: result.summary, loading: false, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setFallback({ identity, summary: null, loading: false, error: error instanceof Error ? error : new Error('天气数据读取失败，请重试。') });
    });
    return () => controller.abort();
  }, [attempt, canFallback, identity, season, round]);
  const current = fallback?.identity === identity ? fallback : null;
  const retry = useCallback(() => { retryPrimary(); setAttempt(value => value + 1); }, [retryPrimary]);
  return {
    summary: enabled ? primarySummary || (canFallback ? current?.summary : null) || null : null,
    source: primarySummary || !canFallback ? 'fastf1' as const : 'openf1' as const,
    loading: enabled && !primarySummary && (primaryLoading || (canFallback && (!current || current.loading))),
    error: enabled && !primarySummary && !primaryLoading ? current?.error || (!current?.summary ? primaryError : null) : null,
    retry,
  };
}
