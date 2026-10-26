import { useCallback, useEffect, useState } from 'react';
import type { AwardData, RacePitData } from '@/types/pitStops';

const cache = new Map<string, { at: number; data: AwardData | RacePitData }>();
const REFRESH_MS = 5 * 60_000;
function usePitResource<T extends AwardData | RacePitData>(kind: 'award' | 'race', season: string, round: string, enabled: boolean) {
  const key = `${kind}:${season}:${round}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: boolean }>({ key, data: null, loading: enabled, error: false });
  useEffect(() => {
    if (!enabled) { setState({ key, data: null, loading: false, error: false }); return; }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let running = false;
    const schedule = (delay = REFRESH_MS) => {
      clearTimeout(timer);
      if (!controller.signal.aborted) timer = setTimeout(() => { void refresh(); }, delay);
    };
    const refresh = async (force = false) => {
      if (controller.signal.aborted || running) return;
      if ((typeof document !== 'undefined' && document.visibilityState === 'hidden')
        || (typeof navigator !== 'undefined' && navigator.onLine === false)) { schedule(); return; }
      const saved = cache.get(key);
      const age = saved ? Date.now() - saved.at : REFRESH_MS;
      if (!force && saved && !saved.data.stale && age < REFRESH_MS) {
        setState({ key, data: saved.data as T, loading: false, error: false });
        schedule(REFRESH_MS - age); return;
      }
      running = true;
      setState({ key, data: saved?.data as T || null, loading: true, error: false });
      try {
        const api = await import('@/api/pitStops');
        if (controller.signal.aborted) return;
        const load = kind === 'award' ? api.getAwardData : api.getRacePitData;
        const data = await load(season, round, controller.signal);
        if (controller.signal.aborted) return;
        if (cache.size > 60) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), data });
        setState({ key, data: data as T, loading: false, error: false });
      } catch {
        if (controller.signal.aborted) return;
        const data = saved ? { ...saved.data, stale: true } as T : null;
        if (saved && data) cache.set(key, { ...saved, data });
        setState({ key, data, loading: false, error: true });
      } finally { running = false; schedule(); }
    };
    const wake = () => { void refresh(true); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    void refresh(attempt > 0);
    return () => {
      controller.abort(); clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
    };
  }, [attempt, enabled, key, kind, round, season]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { ...(state.key === key ? state : { data: null, loading: enabled, error: false }), retry };
}
export const usePitAward = (season: string, round = '', enabled = true) => usePitResource<AwardData>('award', season, round, enabled);
export const useRacePitStops = (season: string, round: string, enabled = true) => usePitResource<RacePitData>('race', season, round, enabled);
