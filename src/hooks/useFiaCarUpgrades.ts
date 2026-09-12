import { useCallback, useEffect, useState } from 'react';
import { fiaCarUpgradesApi } from '@/api/fiaCarUpgrades';
import type { FiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';
import { RequestTimeoutError, withTimeout } from '@/utils/withRetry';

const FIA_UPGRADES_TIMEOUT_MS = 8_000;
const FIA_UPGRADES_REFRESH_MS = 60_000;

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
    let pending = false;
    let loaded = false;

    const refresh = () => {
      if (pending) return;
      pending = true;
      if (!loaded) setLoading(true);
      setError(null);
      withTimeout(
        fiaCarUpgradesApi.getRaceUpgrades(season, round),
        FIA_UPGRADES_TIMEOUT_MS,
      )
        .then((summary) => {
          if (!cancelled) {
            setData(summary);
            setDataIdentity(requestIdentity);
            loaded = true;
          }
        })
        .catch((requestError: unknown) => {
          if (!cancelled) {
            if (!loaded) setData(null);
            setDataIdentity(requestIdentity);
            setError(requestError instanceof RequestTimeoutError
              ? new Error('赛车升级数据请求超时，请稍后重试')
              : requestError instanceof Error ? requestError : new Error(String(requestError)));
          }
        })
        .finally(() => {
          pending = false;
          if (!cancelled) {
            setLoading(false);
          }
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    const interval = window.setInterval(refreshWhenVisible, FIA_UPGRADES_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
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
