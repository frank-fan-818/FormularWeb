import { useCallback, useEffect, useRef, useState } from 'react';
import { getNews } from '@/api/news';
import type { NewsResult } from '@/types/news';

const REFRESH_INTERVAL_MS = 5 * 60_000;

export function useNews() {
  const [data, setData] = useState<NewsResult>({ items: [], sources: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const load = useCallback(async (refresh: boolean) => {
    if (!refresh && request.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastAttempt.current = Date.now();
    setLoading(true);
    setError(false);
    try {
      const result = await getNews({ refresh, signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    const checkForUpdates = () => {
      if ((typeof document === 'undefined' || !document.hidden) && Date.now() - lastAttempt.current >= REFRESH_INTERVAL_MS) void load(false);
    };
    const interval = setInterval(checkForUpdates, REFRESH_INTERVAL_MS);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', checkForUpdates);
    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', checkForUpdates);
      request.current?.abort();
      request.current = null;
    };
  }, [load]);

  return { ...data, loading, error, refresh: useCallback(() => { void load(true); }, [load]) };
}
