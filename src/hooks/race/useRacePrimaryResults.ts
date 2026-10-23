import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { seasonApi } from '@/api/raceClassifications';
import type { QualifyingResult, Result } from '@/types';
import { getRaceIdentity, isRaceIdentityCurrent } from '@/utils/race/raceSessionState';
import { createLoggerScope } from '@/utils/logger';
import { recordLoadMetric } from '@/utils/performance';

const EMPTY_RESULTS: Result[] = [];
const EMPTY_QUALIFYING_RESULTS: QualifyingResult[] = [];

interface SessionState<T> {
  identity: string | null;
  results: T[];
  loading: boolean;
  error: Error | null;
}

export function useRacePrimaryResults(season: string, round: string | undefined, flowId?: string) {
  const [qualifying, setQualifying] = useState<SessionState<QualifyingResult>>({ identity: null, results: [], loading: false, error: null });
  const [race, setRace] = useState<SessionState<Result>>({ identity: null, results: [], loading: false, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const raceIdentity = getRaceIdentity(season, round);
  const raceCurrent = isRaceIdentityCurrent(race.identity, season, round);
  const qualifyingCurrent = isRaceIdentityCurrent(qualifying.identity, season, round);

  useEffect(() => {
    if (!round) return;

    let cancelled = false;
    const controller = new AbortController();
    let pending = 2;
    const requestedIdentity = raceIdentity;
    const diagnostics = flowId ? createLoggerScope({
      flowId, feature: 'race_detail', season, round, section: 'primary',
    }) : null;
    diagnostics?.log({ operation: 'primary_results', outcome: 'started', source: 'jolpica' });

    async function loadSession<T>(
      operation: string,
      request: () => Promise<T[]>,
      setState: Dispatch<SetStateAction<SessionState<T>>>,
    ) {
      const startedAt = performance.now();
      setState(current => ({ identity: requestedIdentity,
        results: current.identity === requestedIdentity ? current.results : [], loading: true, error: null }));
      try {
        const results = await request();
        if (cancelled) {
          diagnostics?.log({ operation, outcome: 'stale_ignored', source: 'jolpica' });
          return;
        }
        setState({ identity: requestedIdentity, results, loading: false, error: null });
        if (results.length) recordLoadMetric(`race_content_${operation}`, performance.now() - startedAt, 'success');
        diagnostics?.log({ operation, outcome: results.length ? 'succeeded' : 'empty', source: 'jolpica',
          durationMs: performance.now() - startedAt, itemCount: results.length });
      } catch (value) {
        if (cancelled) return;
        const error = value instanceof Error ? value : new Error(String(value));
        setState(current => ({ ...current, loading: false, error }));
        diagnostics?.log({ operation, outcome: 'failed', source: 'jolpica',
          durationMs: performance.now() - startedAt, error });
      } finally {
        pending -= 1;
      }
    }

    void loadSession('qualifying_results', async () =>
      (await seasonApi.getQualifyingResults(season, round!, controller.signal))?.QualifyingResults || [], setQualifying);
    void loadSession('race_results', async () =>
      (await seasonApi.getRaceResults(season, round!, controller.signal))?.Results || [], setRace);

    return () => {
      cancelled = true;
      controller.abort();
      if (pending > 0) diagnostics?.log({ operation: 'primary_results', outcome: 'aborted', source: 'jolpica' });
    };
  }, [flowId, raceIdentity, reloadKey, round, season]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  const raceError = raceCurrent ? race.error : null;
  const qualifyingError = qualifyingCurrent ? qualifying.error : null;
  const error = useMemo(() => raceError || qualifyingError ? new Error(
    raceError && qualifyingError
      ? 'Race and qualifying results are temporarily unavailable'
      : 'Part of the race results is temporarily unavailable',
  ) : null, [raceError, qualifyingError]);
  const raceLoading = Boolean(round) && (!raceCurrent || race.loading);
  const qualifyingLoading = Boolean(round) && (!qualifyingCurrent || qualifying.loading);

  return {
    qualifyingResults: qualifyingCurrent ? qualifying.results : EMPTY_QUALIFYING_RESULTS,
    raceResults: raceCurrent ? race.results : EMPTY_RESULTS,
    raceLoading,
    qualifyingLoading,
    loading: raceLoading || qualifyingLoading,
    error,
    retry,
  };
}
