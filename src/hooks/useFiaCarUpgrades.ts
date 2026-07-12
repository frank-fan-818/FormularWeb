import { useEffect, useState } from 'react';
import { fiaCarUpgradesApi } from '@/api/fiaCarUpgrades';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';

export function useFiaRaceUpgrades(season: string, round: string | undefined, enabled = true) {
  const [data, setData] = useState<FiaRaceUpgradeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !season || !round) {
      setData(null);
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
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setData(null);
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
  }, [enabled, round, season]);

  return { data, loading, error };
}
