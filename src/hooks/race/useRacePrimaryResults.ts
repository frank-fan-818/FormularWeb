import { useCallback, useEffect, useState } from 'react';
import { seasonApi } from '@/api/ergast';
import type { QualifyingResult, Result } from '@/types';
import { getRaceIdentity, isRaceIdentityCurrent } from '@/utils/race/raceSessionState';
import { createLoggerScope } from '@/utils/logger';

const EMPTY_RESULTS: Result[] = [];
const EMPTY_QUALIFYING_RESULTS: QualifyingResult[] = [];

export function useRacePrimaryResults(season: string, round: string | undefined, flowId?: string) {
  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [raceResults, setRaceResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const raceIdentity = getRaceIdentity(season, round);
  const identityCurrent = isRaceIdentityCurrent(dataIdentity, season, round);

  useEffect(() => {
    if (!round) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let completed = false;
    const requestedIdentity = raceIdentity;
    const diagnostics = flowId ? createLoggerScope({
      flowId, feature: 'race_detail', season, round, section: 'primary',
    }) : null;
    const startedAt = performance.now();
    diagnostics?.log({ operation: 'primary_results', outcome: 'started', source: 'jolpica' });
    setLoading(true);
    setError(null);

    void Promise.allSettled([
      seasonApi.getQualifyingResults(season, round),
      seasonApi.getRaceResults(season, round),
    ]).then(([qualifyingData, raceData]) => {
      completed = true;
      if (cancelled) {
        diagnostics?.log({ operation: 'primary_results', outcome: 'stale_ignored', source: 'jolpica' });
        return;
      }
      const durationMs = performance.now() - startedAt;
      diagnostics?.log({
        operation: 'qualifying_results',
        outcome: qualifyingData.status === 'rejected' ? 'failed' : qualifyingData.value?.QualifyingResults?.length ? 'succeeded' : 'empty',
        source: 'jolpica', durationMs,
        itemCount: qualifyingData.status === 'fulfilled' ? qualifyingData.value?.QualifyingResults?.length || 0 : undefined,
        error: qualifyingData.status === 'rejected' ? qualifyingData.reason : undefined,
      });
      diagnostics?.log({
        operation: 'race_results',
        outcome: raceData.status === 'rejected' ? 'failed' : raceData.value?.Results?.length ? 'succeeded' : 'empty',
        source: 'jolpica', durationMs,
        itemCount: raceData.status === 'fulfilled' ? raceData.value?.Results?.length || 0 : undefined,
        error: raceData.status === 'rejected' ? raceData.reason : undefined,
      });
      setQualifyingResults(
        qualifyingData.status === 'fulfilled' ? qualifyingData.value?.QualifyingResults || [] : [],
      );
      setRaceResults(raceData.status === 'fulfilled' ? raceData.value?.Results || [] : []);
      setDataIdentity(requestedIdentity);
      if (qualifyingData.status === 'rejected' || raceData.status === 'rejected') {
        setError(new Error(
          qualifyingData.status === 'rejected' && raceData.status === 'rejected'
            ? 'Race and qualifying results are temporarily unavailable'
            : 'Part of the race results is temporarily unavailable',
        ));
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (!completed) diagnostics?.log({ operation: 'primary_results', outcome: 'aborted', source: 'jolpica' });
    };
  }, [flowId, raceIdentity, reloadKey, round, season]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  return {
    qualifyingResults: identityCurrent ? qualifyingResults : EMPTY_QUALIFYING_RESULTS,
    raceResults: identityCurrent ? raceResults : EMPTY_RESULTS,
    loading: Boolean(round) && (!identityCurrent || loading),
    error: identityCurrent ? error : null,
    retry,
  };
}
