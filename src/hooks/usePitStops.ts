import { useCallback, useEffect, useState } from 'react';
import { getAwardData, getRacePitData } from '@/api/pitStops';
import type { AwardData, RacePitData } from '@/types/pitStops';

const cache = new Map<string, { at: number; data: AwardData | RacePitData }>();
function usePitResource<T extends AwardData | RacePitData>(kind: 'award' | 'race', season: string, round: string, enabled: boolean) {
  const key = `${kind}:${season}:${round}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: boolean }>({ key, data: null, loading: enabled, error: false });
  useEffect(() => {
    if (!enabled) { setState({ key, data: null, loading: false, error: false }); return; }
    const controller = new AbortController();
    const saved = cache.get(key);
    if (!attempt && saved && Date.now() - saved.at < 300_000) {
      setState({ key, data: saved.data as T, loading: false, error: false }); return;
    }
    setState({ key, data: saved?.data as T || null, loading: true, error: false });
    const load = kind === 'award' ? getAwardData : getRacePitData;
    void load(season, round, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (cache.size > 60) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), data });
      setState({ key, data: data as T, loading: false, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ key, data: saved ? { ...saved.data, stale: true } as T : null, loading: false, error: true });
    });
    return () => controller.abort();
  }, [attempt, enabled, key, kind, round, season]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { ...(state.key === key ? state : { data: null, loading: enabled, error: false }), retry };
}
export const usePitAward = (season: string, round = '', enabled = true) => usePitResource<AwardData>('award', season, round, enabled);
export const useRacePitStops = (season: string, round: string, enabled = true) => usePitResource<RacePitData>('race', season, round, enabled);
