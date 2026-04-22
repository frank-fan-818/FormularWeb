import { useCallback, useEffect, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useNetworkStatus } from './useNetworkStatus';

interface CacheOptions {
  cacheKey: string;
  cacheDuration?: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

export interface CacheStorageAdapter {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

interface UseCachedDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isOffline: boolean;
  refetch: () => void;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const preferencesStorage: CacheStorageAdapter = {
  async get(key: string) {
    const { value } = await Preferences.get({ key });
    return value;
  },
  async set(key: string, value: string) {
    await Preferences.set({ key, value });
  },
  async remove(key: string) {
    await Preferences.remove({ key });
  },
};

function isFresh(timestamp: number, cacheDuration: number, now: number): boolean {
  return now - timestamp <= cacheDuration;
}

export function setMemoryCacheValue<T>(cacheKey: string, value: T, now = Date.now()): void {
  memoryCache.set(cacheKey, {
    timestamp: now,
    data: value,
  });
}

export function getMemoryCacheValue<T>(
  cacheKey: string,
  cacheDuration: number,
  now = Date.now(),
): T | null {
  const entry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (!isFresh(entry.timestamp, cacheDuration, now)) {
    memoryCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

export async function writePersistentCacheValue<T>(
  storage: CacheStorageAdapter,
  cacheKey: string,
  value: T,
  now = Date.now(),
): Promise<void> {
  await storage.set(
    cacheKey,
    JSON.stringify({
      timestamp: now,
      data: value,
    } satisfies CacheEntry<T>),
  );
}

export async function getPersistentCacheValue<T>(
  storage: CacheStorageAdapter,
  cacheKey: string,
  cacheDuration: number,
  now = Date.now(),
): Promise<T | null> {
  try {
    const rawValue = await storage.get(cacheKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as CacheEntry<T>;
    if (!isFresh(parsed.timestamp, cacheDuration, now)) {
      await storage.remove(cacheKey);
      return null;
    }

    setMemoryCacheValue(cacheKey, parsed.data, parsed.timestamp);
    return parsed.data;
  } catch {
    return null;
  }
}

export async function fetchAndCacheValue<T>(params: {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  storage?: CacheStorageAdapter;
  now?: number;
}): Promise<T> {
  const { cacheKey, fetchFn, storage = preferencesStorage, now = Date.now() } = params;
  const inFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const freshValue = await fetchFn();
    setMemoryCacheValue(cacheKey, freshValue, now);
    await writePersistentCacheValue(storage, cacheKey, freshValue, now);
    return freshValue;
  })().finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function clearCachedDataForTests(): void {
  memoryCache.clear();
  inFlightRequests.clear();
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
    const memoryValue = getMemoryCacheValue<T>(cacheKey, cacheDuration);
    if (memoryValue !== null) {
      return memoryValue;
    }

    return getPersistentCacheValue<T>(preferencesStorage, cacheKey, cacheDuration);
  }, [cacheKey, cacheDuration]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cached = await getCachedData();

      if (!connected) {
        if (cached) {
          setData(cached);
        } else {
          setError(new Error('No network connection and no cached data is available.'));
        }
        setLoading(false);
        return;
      }

      if (cached) {
        setData(cached);
      }

      const freshData = await fetchAndCacheValue({
        cacheKey,
        fetchFn,
        storage: preferencesStorage,
      });
      setData(freshData);
    } catch (err) {
      const cached = await getCachedData();
      if (cached) {
        setData(cached);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch data.'));
      }
    } finally {
      setLoading(false);
    }
  }, [cacheKey, connected, fetchFn, getCachedData]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isOffline: !connected,
    refetch: fetchData,
  };
}
