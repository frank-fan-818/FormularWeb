import { useCallback, useEffect, useState } from 'react';
import { seasonApi } from '@/api/ergast';
import type { QualifyingResult, Result } from '@/types';
import { getRaceIdentity, isRaceIdentityCurrent } from '@/utils/race/raceSessionState';

const EMPTY_RESULTS: Result[] = [];
const EMPTY_QUALIFYING_RESULTS: QualifyingResult[] = [];

export function useRacePrimaryResults(season: string, round: string | undefined) {
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
    const requestedIdentity = raceIdentity;
    setLoading(true);
    setError(null);

    void Promise.allSettled([
      seasonApi.getQualifyingResults(season, round),
      seasonApi.getRaceResults(season, round),
    ]).then(([qualifyingData, raceData]) => {
      if (cancelled) return;
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

    return () => { cancelled = true; };
  }, [raceIdentity, reloadKey, round, season]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  return {
    qualifyingResults: identityCurrent ? qualifyingResults : EMPTY_QUALIFYING_RESULTS,
    raceResults: identityCurrent ? raceResults : EMPTY_RESULTS,
    loading: Boolean(round) && (!identityCurrent || loading),
    error: identityCurrent ? error : null,
    retry,
  };
}
