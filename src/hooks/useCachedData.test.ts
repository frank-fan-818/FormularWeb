import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachedDataForTests,
  fetchAndCacheValue,
  getMemoryCacheValue,
  getPersistentCacheValue,
  setMemoryCacheValue,
  type CacheStorageAdapter,
} from './useCachedData';

function createMemoryStorage(): CacheStorageAdapter & { values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    async get(key: string) {
      return values.get(key) ?? null;
    },
    async set(key: string, value: string) {
      values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}

describe('useCachedData cache helpers', () => {
  beforeEach(() => {
    clearCachedDataForTests();
  });

  it('reuses memory cache for the same key', () => {
    setMemoryCacheValue('season-data-2025', { value: 'cached-2025' }, 1_000);

    expect(getMemoryCacheValue('season-data-2025', 60_000, 2_000)).toEqual({
      value: 'cached-2025',
    });
  });

  it('keeps season keys isolated in memory cache', () => {
    setMemoryCacheValue('season-data-2025', { season: '2025' }, 1_000);
    setMemoryCacheValue('season-data-2024', { season: '2024' }, 1_000);

    expect(getMemoryCacheValue('season-data-2025', 60_000, 2_000)).toEqual({ season: '2025' });
    expect(getMemoryCacheValue('season-data-2024', 60_000, 2_000)).toEqual({ season: '2024' });
  });

  it('reads a persisted cache hit and promotes it into memory cache', async () => {
    const storage = createMemoryStorage();
    await storage.set(
      'season-data-2025',
      JSON.stringify({
        timestamp: 1_000,
        data: { driverCount: 20 },
      }),
    );

    const value = await getPersistentCacheValue<{ driverCount: number }>(
      storage,
      'season-data-2025',
      60_000,
      2_000,
    );

    expect(value).toEqual({ driverCount: 20 });
    expect(getMemoryCacheValue('season-data-2025', 60_000, 2_000)).toEqual({ driverCount: 20 });
  });

  it('deduplicates concurrent fetches for the same key', async () => {
    const storage = createMemoryStorage();
    let callCount = 0;

    const fetchFn = async () => {
      callCount += 1;
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
      return { value: 'fresh-data' };
    };

    const [first, second] = await Promise.all([
      fetchAndCacheValue({
        cacheKey: 'season-data-2025',
        fetchFn,
        storage,
        now: 1_000,
      }),
      fetchAndCacheValue({
        cacheKey: 'season-data-2025',
        fetchFn,
        storage,
        now: 1_000,
      }),
    ]);

    expect(callCount).toBe(1);
    expect(first).toEqual({ value: 'fresh-data' });
    expect(second).toEqual({ value: 'fresh-data' });
  });
});
