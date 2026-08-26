import { useCallback, useEffect, useState } from 'react';
import { fiaCarUpgradesApi } from '@/api/fiaCarUpgrades';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';
import { RequestTimeoutError, withTimeout } from '@/utils/withRetry';

const FIA_UPGRADES_TIMEOUT_MS = 8_000;

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

    withTimeout(
      fiaCarUpgradesApi.getRaceUpgrades(season, round),
      FIA_UPGRADES_TIMEOUT_MS,
    )
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
          setError(requestError instanceof RequestTimeoutError
            ? new Error('赛车升级数据请求超时，请稍后重试')
            : requestError instanceof Error ? requestError : new Error(String(requestError)));
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
