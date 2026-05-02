import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface CacheOptions {
  cacheKey: string;
  cacheDuration?: number;
  enabled?: boolean;
  refreshOnMount?: boolean;
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
const fallbackStorageMap = new Map<string, string>();

let resolvedStoragePromise: Promise<CacheStorageAdapter> | null = null;

const memoryStorageAdapter: CacheStorageAdapter = {
  async get(key: string) {
    return fallbackStorageMap.get(key) ?? null;
  },
  async set(key: string, value: string) {
    fallbackStorageMap.set(key, value);
  },
  async remove(key: string) {
    fallbackStorageMap.delete(key);
  },
};

function createBrowserStorageAdapter(): CacheStorageAdapter | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = '__f1_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);

    return {
      async get(key: string) {
        return storage.getItem(key);
      },
      async set(key: string, value: string) {
        storage.setItem(key, value);
      },
      async remove(key: string) {
        storage.removeItem(key);
      },
    };
  } catch {
    return null;
  }
}

async function createCapacitorPreferencesAdapter(): Promise<CacheStorageAdapter | null> {
  try {
    const module = await import('@capacitor/preferences');
    const { Preferences } = module;

    return {
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
  } catch {
    return null;
  }
}

async function resolvePersistentStorageAdapter(): Promise<CacheStorageAdapter> {
  const browserAdapter = createBrowserStorageAdapter();
  if (browserAdapter) {
    return browserAdapter;
  }

  const capacitorAdapter = await createCapacitorPreferencesAdapter();
  if (capacitorAdapter) {
    return capacitorAdapter;
  }

  return memoryStorageAdapter;
}

const persistentStorage: CacheStorageAdapter = {
  async get(key: string) {
    if (!resolvedStoragePromise) {
      resolvedStoragePromise = resolvePersistentStorageAdapter();
    }
    return (await resolvedStoragePromise).get(key);
  },
  async set(key: string, value: string) {
    if (!resolvedStoragePromise) {
      resolvedStoragePromise = resolvePersistentStorageAdapter();
    }
    await (await resolvedStoragePromise).set(key, value);
  },
  async remove(key: string) {
    if (!resolvedStoragePromise) {
      resolvedStoragePromise = resolvePersistentStorageAdapter();
    }
    await (await resolvedStoragePromise).remove(key);
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
  const { cacheKey, fetchFn, storage = persistentStorage, now = Date.now() } = params;
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
  fallbackStorageMap.clear();
  resolvedStoragePromise = null;
}

export function useCachedData<T>(
  fetchFn: () => Promise<T>,
  options: CacheOptions
): UseCachedDataReturn<T> {
  const {
    cacheKey,
    cacheDuration = 24 * 60 * 60 * 1000,
    enabled = true,
    refreshOnMount = true,
  } = options;
  const { connected } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const getCachedData = useCallback(async (): Promise<T | null> => {
    const memoryValue = getMemoryCacheValue<T>(cacheKey, cacheDuration);
    if (memoryValue !== null) {
      return memoryValue;
    }

    return getPersistentCacheValue<T>(persistentStorage, cacheKey, cacheDuration);
  }, [cacheKey, cacheDuration]);

  const fetchData = useCallback(async () => {
    setError(null);

    try {
      const cached = await getCachedData();
      const shouldShowLoading = cached === null && dataRef.current === null;

      setLoading(shouldShowLoading);

      if (cached) {
        setData(cached);
      }

      if (cached && !refreshOnMount) {
        return;
      }

      if (!connected) {
        if (!cached && dataRef.current === null) {
          setError(new Error('No network connection and no cached data is available.'));
        }
        return;
      }

      const freshData = await fetchAndCacheValue({
        cacheKey,
        fetchFn,
        storage: persistentStorage,
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
  }, [cacheKey, connected, fetchFn, getCachedData, refreshOnMount]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchData();
  }, [enabled, fetchData]);

  return {
    data,
    loading,
    error,
    isOffline: !connected,
    refetch: fetchData,
  };
}
