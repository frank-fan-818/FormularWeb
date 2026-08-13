import { useCallback, useState } from 'react';
import { searchApi } from '@/api/search';
import type { SearchResultGroup } from '@/types';
import {
  buildSearchIndex,
  searchIndex,
  type SearchSources,
} from '@/utils/search';

const SEARCH_INDEX_CACHE_KEY = 'global-search-index-v5';
const LEGACY_SEARCH_INDEX_CACHE_KEYS = [
  'global-search-index-v1', 'global-search-index-v2', 'global-search-index-v3',
  'global-search-index-v4',
];
const SEARCH_INDEX_TTL = 24 * 60 * 60 * 1000;
const BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000;

type SearchIndex = ReturnType<typeof buildSearchIndex>;
type SearchIndexFetcher = () => Promise<SearchSources>;

export interface SearchIndexStorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface CachedSearchIndex {
  timestamp: number;
  data: SearchIndex;
}

interface SearchIndexOptions {
  fetchSources?: SearchIndexFetcher;
  storage?: SearchIndexStorageAdapter | null;
  now?: number;
}

let cachedIndex: SearchIndex | null = null;
let cachedIndexTimestamp = 0;
let loadingPromise: Promise<SearchIndex> | null = null;
let lastBackgroundRefreshStartedAt = 0;

function getDefaultStorage(): SearchIndexStorageAdapter | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = '__f1_search_cache_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function isFresh(timestamp: number, now: number): boolean {
  return now - timestamp <= SEARCH_INDEX_TTL;
}

function getStorage(options?: SearchIndexOptions): SearchIndexStorageAdapter | null {
  if (Object.prototype.hasOwnProperty.call(options || {}, 'storage')) {
    return options?.storage || null;
  }

  return getDefaultStorage();
}

function readMemoryCachedIndex(now: number): SearchIndex | null {
  if (cachedIndex && isFresh(cachedIndexTimestamp, now)) {
    return cachedIndex;
  }

  return null;
}

function readPersistentCachedIndex(options?: SearchIndexOptions): SearchIndex | null {
  const now = options?.now ?? Date.now();
  const storage = getStorage(options);
  if (!storage) {
    return null;
  }

  try {
    LEGACY_SEARCH_INDEX_CACHE_KEYS.forEach((key) => storage.removeItem(key));
    const rawValue = storage.getItem(SEARCH_INDEX_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as CachedSearchIndex;
    if (!isFresh(parsed.timestamp, now)) {
      storage.removeItem(SEARCH_INDEX_CACHE_KEY);
      return null;
    }

    cachedIndex = parsed.data;
    cachedIndexTimestamp = parsed.timestamp;
    return cachedIndex;
  } catch {
    storage.removeItem(SEARCH_INDEX_CACHE_KEY);
    return null;
  }
}

function readCachedIndex(options?: SearchIndexOptions): SearchIndex | null {
  const now = options?.now ?? Date.now();
  return readMemoryCachedIndex(now) || readPersistentCachedIndex(options);
}

function writeCachedIndex(
  index: SearchIndex,
  options?: SearchIndexOptions,
  persist = true,
): void {
  const timestamp = options?.now ?? Date.now();
  cachedIndex = index;
  cachedIndexTimestamp = timestamp;

  const storage = getStorage(options);
  if (!storage || !persist) {
    return;
  }

  try {
    storage.setItem(
      SEARCH_INDEX_CACHE_KEY,
      JSON.stringify({
        timestamp,
        data: index,
      } satisfies CachedSearchIndex),
    );
  } catch {
    // Search should keep working even when browser storage is unavailable or full.
  }
}

async function fetchFreshSearchIndex(options?: SearchIndexOptions): Promise<SearchIndex> {
  if (loadingPromise) {
    return loadingPromise;
  }

  const fetchSources = options?.fetchSources || searchApi.getSearchSources;
  loadingPromise = fetchSources()
    .then((sources) => {
      const index = buildSearchIndex(sources);
      writeCachedIndex(index, options, sources.cacheable !== false);
      return index;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
}

function refreshCachedSearchIndex(options?: SearchIndexOptions): void {
  const now = options?.now ?? Date.now();
  if (
    loadingPromise
    || (lastBackgroundRefreshStartedAt > 0 && now - lastBackgroundRefreshStartedAt < BACKGROUND_REFRESH_INTERVAL)
  ) {
    return;
  }

  lastBackgroundRefreshStartedAt = now;
  void fetchFreshSearchIndex(options).catch(() => {
    // Stale-while-revalidate failures should not break visible cached search.
  });
}

export function getCachedGlobalSearchIndex(options?: SearchIndexOptions): SearchIndex | null {
  return readCachedIndex(options);
}

export async function loadGlobalSearchIndex(options?: SearchIndexOptions): Promise<SearchIndex> {
  const now = options?.now ?? Date.now();
  const memoryCached = readMemoryCachedIndex(now);
  if (memoryCached) {
    return memoryCached;
  }

  const persistentCached = readPersistentCachedIndex(options);
  if (persistentCached) {
    refreshCachedSearchIndex(options);
    return persistentCached;
  }

  return fetchFreshSearchIndex(options);
}

export async function preloadGlobalSearchIndex(options?: SearchIndexOptions): Promise<void> {
  await loadGlobalSearchIndex(options);
}

export function clearGlobalSearchIndexForTests(): void {
  cachedIndex = null;
  cachedIndexTimestamp = 0;
  loadingPromise = null;
  lastBackgroundRefreshStartedAt = 0;
}

export function useGlobalSearch() {
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureLoaded = useCallback(async () => {
    const cached = getCachedGlobalSearchIndex();
    if (cached) {
      refreshCachedSearchIndex();
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      return await loadGlobalSearchIndex();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Unable to load search data.');
      throw searchError;
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGroups([]);
      setError(null);
      return;
    }

    try {
      const index = getCachedGlobalSearchIndex() || await ensureLoaded();
      setGroups(searchIndex(index, query));
    } catch {
      setGroups([]);
    }
  }, [ensureLoaded]);

  const reset = useCallback(() => {
    setGroups([]);
    setError(null);
  }, []);

  return {
    groups,
    loading,
    error,
    ensureLoaded,
    runSearch,
    reset,
  };
}
