import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGlobalSearchIndexForTests,
  loadGlobalSearchIndex,
  type SearchIndexStorageAdapter,
} from '@/hooks/useGlobalSearch';
import type { SearchSources } from '@/utils/search';

function createStorage(): SearchIndexStorageAdapter & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

function createSources(name = 'Mercedes'): SearchSources {
  return {
    drivers: [
      {
        driver_id: 'max_verstappen',
        first_name: 'Max',
        last_name: 'Verstappen',
        code: 'VER',
        nationality: 'Dutch',
      },
    ],
    constructors: [
      {
        constructor_id: 'mercedes',
        name,
        nationality: 'German',
      },
    ],
    circuits: [
      {
        circuit_id: 'americas',
        name: 'Circuit of the Americas',
        locality: 'Austin',
        location: null,
        country: 'USA',
      },
    ],
  };
}

describe('global search index cache', () => {
  beforeEach(() => {
    clearGlobalSearchIndexForTests();
  });

  it('reuses the in-memory search index for the same cache key', async () => {
    const storage = createStorage();
    let callCount = 0;

    const fetchSources = async () => {
      callCount += 1;
      return createSources();
    };

    const first = await loadGlobalSearchIndex({ fetchSources, storage, now: 1_000 });
    const second = await loadGlobalSearchIndex({ fetchSources, storage, now: 2_000 });

    expect(callCount).toBe(1);
    expect(second).toBe(first);
  });

  it('deduplicates concurrent search index loads', async () => {
    const storage = createStorage();
    let callCount = 0;

    const fetchSources = async () => {
      callCount += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      return createSources();
    };

    const [first, second] = await Promise.all([
      loadGlobalSearchIndex({ fetchSources, storage, now: 1_000 }),
      loadGlobalSearchIndex({ fetchSources, storage, now: 1_000 }),
    ]);

    expect(callCount).toBe(1);
    expect(second).toBe(first);
  });

  it('returns a localStorage hit before refreshing in the background', async () => {
    const storage = createStorage();
    storage.setItem(
      'global-search-index-v1',
      JSON.stringify({
        timestamp: 1_000,
        data: [
          {
            entry: {
              type: 'constructor',
              id: 'cached_mercedes',
              title: 'Cached Mercedes',
              subtitle: 'German',
              route: '/history/constructors/cached_mercedes',
              keywords: ['cached mercedes'],
            },
            primaryKeywords: ['cached mercedes'],
            aliasKeywords: [],
          },
        ],
      }),
    );

    let callCount = 0;
    const index = await loadGlobalSearchIndex({
      storage,
      now: 2_000,
      fetchSources: async () => {
        callCount += 1;
        return createSources('Fresh Mercedes');
      },
    });

    expect(index[0].entry.title).toBe('Cached Mercedes');
    expect(callCount).toBe(1);
  });

  it('ignores older cache version keys', async () => {
    const storage = createStorage();
    storage.setItem(
      'global-search-index-v0',
      JSON.stringify({
        timestamp: 1_000,
        data: [],
      }),
    );

    let callCount = 0;
    const index = await loadGlobalSearchIndex({
      storage,
      now: 2_000,
      fetchSources: async () => {
        callCount += 1;
        return createSources();
      },
    });

    expect(callCount).toBe(1);
    expect(index.length).toBeGreaterThan(0);
  });
});
