import { useCallback, useEffect, useState } from 'react';
import { fiaCarUpgradesApi } from '@/api/fiaCarUpgrades';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';

export function useFiaRaceUpgrades(season: string, round: string | undefined, enabled = true) {
  const [data, setData] = useState<FiaRaceUpgradeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [dataIdentity, setDataIdentity] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdentity = `${season}:${round || ''}`;
  const identityCurrent = enabled && Boolean(season && round) && dataIdentity === requestIdentity;

  useEffect(() => {
    if (!enabled || !season || !round) {
      setData(null);
      setDataIdentity(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fiaCarUpgradesApi.getRaceUpgrades(season, round)
      .then((summary) => {
        if (!cancelled) {
          setData(summary);
          setDataIdentity(requestIdentity);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setData(null);
          setDataIdentity(requestIdentity);
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
  }, [enabled, reloadKey, requestIdentity, round, season]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);
  return {
    data: identityCurrent ? data : null,
    loading: identityCurrent ? loading : enabled && Boolean(season && round),
    error: identityCurrent ? error : null,
    retry,
  };
}
