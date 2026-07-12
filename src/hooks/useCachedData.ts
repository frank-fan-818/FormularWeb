import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface CacheOptions {
  cacheKey: string;
  cacheDuration?: number;
  staleDuration?: number;
  enabled?: boolean;
  refreshOnMount?: boolean;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

interface PersistedCacheEntry<T> extends CacheEntry<T> {
  schemaVersion: 2;
}

export interface CacheSnapshot<T> extends CacheEntry<T> {
  freshness: 'fresh' | 'stale';
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
  isStale: boolean;
  updatedAt: number | null;
  refetch: () => void;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const fallbackStorageMap = new Map<string, string>();
const CACHE_KEY_PREFIX = 'f1-data-cache-v2:';

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
        return storage.getItem(`${CACHE_KEY_PREFIX}${key}`);
      },
      async set(key: string, value: string) {
        storage.setItem(`${CACHE_KEY_PREFIX}${key}`, value);
      },
      async remove(key: string) {
        storage.removeItem(`${CACHE_KEY_PREFIX}${key}`);
      },
    };
  } catch {
    return null;
  }
}

async function createIndexedDbStorageAdapter(): Promise<CacheStorageAdapter | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;

  try {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('f1-data-cache', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('snapshots')) {
          request.result.createObjectStore('snapshots');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const transact = <T>(
      mode: IDBTransactionMode,
      operation: (store: IDBObjectStore) => IDBRequest<T>,
    ) => new Promise<T>((resolve, reject) => {
      const request = operation(database.transaction('snapshots', mode).objectStore('snapshots'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return {
      async get(key: string) {
        return (await transact('readonly', (store) => store.get(`${CACHE_KEY_PREFIX}${key}`))) ?? null;
      },
      async set(key: string, value: string) {
        await transact('readwrite', (store) => store.put(value, `${CACHE_KEY_PREFIX}${key}`));
      },
      async remove(key: string) {
        await transact('readwrite', (store) => store.delete(`${CACHE_KEY_PREFIX}${key}`));
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
        const { value } = await Preferences.get({ key: `${CACHE_KEY_PREFIX}${key}` });
        return value;
      },
      async set(key: string, value: string) {
        await Preferences.set({ key: `${CACHE_KEY_PREFIX}${key}`, value });
      },
      async remove(key: string) {
        await Preferences.remove({ key: `${CACHE_KEY_PREFIX}${key}` });
      },
    };
  } catch {
    return null;
  }
}

async function resolvePersistentStorageAdapter(): Promise<CacheStorageAdapter> {
  const indexedDbAdapter = await createIndexedDbStorageAdapter();
  if (indexedDbAdapter) {
    return indexedDbAdapter;
  }

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

function isCacheEntry(value: unknown): value is PersistedCacheEntry<unknown> {
  return typeof value === 'object'
    && value !== null
    && 'data' in value
    && 'timestamp' in value
    && (value as { schemaVersion?: unknown }).schemaVersion === 2
    && typeof (value as { timestamp?: unknown }).timestamp === 'number'
    && Number.isFinite((value as { timestamp: number }).timestamp);
}

function toCacheSnapshot<T>(
  entry: CacheEntry<T> | undefined,
  cacheDuration: number,
  staleDuration: number,
  now: number,
): CacheSnapshot<T> | null {
  if (!entry || now - entry.timestamp > cacheDuration + staleDuration) {
    return null;
  }

  return {
    ...entry,
    freshness: isFresh(entry.timestamp, cacheDuration, now) ? 'fresh' : 'stale',
  };
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

export function getMemoryCacheSnapshot<T>(
  cacheKey: string,
  cacheDuration: number,
  staleDuration: number,
  now = Date.now(),
): CacheSnapshot<T> | null {
  const snapshot = toCacheSnapshot(
    memoryCache.get(cacheKey) as CacheEntry<T> | undefined,
    cacheDuration,
    staleDuration,
    now,
  );
  if (!snapshot) {
    memoryCache.delete(cacheKey);
  }
  return snapshot;
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
      schemaVersion: 2,
      timestamp: now,
      data: value,
    } satisfies PersistedCacheEntry<T>),
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

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isCacheEntry(parsed)) {
      await storage.remove(cacheKey);
      return null;
    }
    const entry = parsed as CacheEntry<T>;
    if (!isFresh(entry.timestamp, cacheDuration, now)) {
      await storage.remove(cacheKey);
      return null;
    }

    setMemoryCacheValue(cacheKey, entry.data, entry.timestamp);
    return entry.data;
  } catch {
    return null;
  }
}

export async function getPersistentCacheSnapshot<T>(
  storage: CacheStorageAdapter,
  cacheKey: string,
  cacheDuration: number,
  staleDuration: number,
  now = Date.now(),
): Promise<CacheSnapshot<T> | null> {
  try {
    const rawValue = await storage.get(cacheKey);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isCacheEntry(parsed)) {
      await storage.remove(cacheKey);
      return null;
    }
    const snapshot = toCacheSnapshot(parsed as CacheEntry<T>, cacheDuration, staleDuration, now);
    if (!snapshot) {
      await storage.remove(cacheKey);
      return null;
    }

    setMemoryCacheValue(cacheKey, snapshot.data, snapshot.timestamp);
    return snapshot;
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
  const { cacheKey, fetchFn, storage = persistentStorage } = params;
  const inFlight = inFlightRequests.get(cacheKey) as Promise<T> | undefined;

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const freshValue = await fetchFn();
    const completedAt = params.now ?? Date.now();
    setMemoryCacheValue(cacheKey, freshValue, completedAt);
    try {
      await writePersistentCacheValue(storage, cacheKey, freshValue, completedAt);
    } catch {
      // Persistent storage is an optimization. A quota/privacy failure must not
      // turn a successful network response into a user-visible data failure.
    }
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
    staleDuration = 7 * 24 * 60 * 60 * 1000,
    enabled = true,
    refreshOnMount = true,
  } = options;
  const { connected } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const dataRef = useRef<T | null>(null);
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const getCachedData = useCallback(async (): Promise<CacheSnapshot<T> | null> => {
    const memoryValue = getMemoryCacheSnapshot<T>(cacheKey, cacheDuration, staleDuration);
    if (memoryValue !== null) {
      return memoryValue;
    }

    return getPersistentCacheSnapshot<T>(
      persistentStorage,
      cacheKey,
      cacheDuration,
      staleDuration,
    );
  }, [cacheKey, cacheDuration, staleDuration]);

  const fetchData = useCallback(async () => {
    const generation = ++requestGenerationRef.current;
    setError(null);

    try {
      const cached = await getCachedData();
      const shouldShowLoading = cached === null && dataRef.current === null;

      setLoading(shouldShowLoading);

      if (cached && generation === requestGenerationRef.current) {
        setData(cached.data);
        setIsStale(cached.freshness === 'stale');
        setUpdatedAt(cached.timestamp);
      }

      if (cached && cached.freshness === 'fresh' && !refreshOnMount) {
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
      if (generation === requestGenerationRef.current) {
        setData(freshData);
        setIsStale(false);
        setUpdatedAt(Date.now());
      }
    } catch (err) {
      const cached = await getCachedData();
      if (generation !== requestGenerationRef.current) return;
      if (cached) {
        setData(cached.data);
        setIsStale(true);
        setUpdatedAt(cached.timestamp);
        setError(err instanceof Error ? err : new Error('Failed to refresh data.'));
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch data.'));
      }
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false);
    }
  }, [cacheKey, connected, fetchFn, getCachedData, refreshOnMount]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void fetchData();
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [enabled, fetchData]);

  return {
    data,
    loading,
    error,
    isOffline: !connected,
    isStale,
    updatedAt,
    refetch: fetchData,
  };
}
