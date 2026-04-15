import { useState, useEffect, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useNetworkStatus } from './useNetworkStatus';

interface CacheOptions {
  cacheKey: string;
  cacheDuration?: number;
}

interface UseCachedDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

export function useCachedData<T>(
  fetchFn: () => Promise<T>,
  options: CacheOptions
): UseCachedDataReturn<T> {
  const { cacheKey, cacheDuration = 24 * 60 * 60 * 1000 } = options;
  const { connected } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCachedData = useCallback(async (): Promise<T | null> => {
    try {
      const { value } = await Preferences.get({ key: cacheKey });
      if (!value) return null;

      const parsed = JSON.parse(value);
      const { timestamp, data: cachedData } = parsed;

      if (Date.now() - timestamp > cacheDuration) {
        await Preferences.remove({ key: cacheKey });
        return null;
      }

      return cachedData;
    } catch {
      return null;
    }
  }, [cacheKey, cacheDuration]);

  const setCachedData = useCallback(async (newData: T) => {
    try {
      await Preferences.set({
        key: cacheKey,
        value: JSON.stringify({
          timestamp: Date.now(),
          data: newData,
        }),
      });
    } catch (err) {
      console.error('Failed to cache data:', err);
    }
  }, [cacheKey]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!connected) {
        const cached = await getCachedData();
        if (cached) {
          setData(cached);
        } else {
          setError(new Error('无网络连接且无缓存数据'));
        }
        setLoading(false);
        return;
      }

      const cached = await getCachedData();
      if (cached) {
        setData(cached);
      }

      const freshData = await fetchFn();
      setData(freshData);
      await setCachedData(freshData);
    } catch (err) {
      const cached = await getCachedData();
      if (cached) {
        setData(cached);
      } else {
        setError(err instanceof Error ? err : new Error('获取数据失败'));
      }
    } finally {
      setLoading(false);
    }
  }, [connected, fetchFn, getCachedData, setCachedData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isOffline: !connected,
    refetch: fetchData,
  };
}
