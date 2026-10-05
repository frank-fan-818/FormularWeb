import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { clearCachedDataForTests, setMemoryCacheValue, useCachedData } from './useCachedData';

const network = vi.hoisted(() => ({ connected: true }));
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => network }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {
  get: async () => ({ value: null }), set: async () => undefined, remove: async () => undefined,
} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('cached data lifecycle', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof useCachedData<string>>;
  const renders: Array<string | null> = [];
  function Probe({ cacheKey, fetcher }: { cacheKey: string; fetcher: () => Promise<string> }) {
    latest = useCachedData(fetcher, { cacheKey });
    renders.push(latest.data);
    return null;
  }
  beforeEach(() => { clearCachedDataForTests(); network.connected = true; renders.length = 0; });
  afterEach(() => { act(() => renderer?.unmount()); });

  it('never renders the previous season under a new cache key, even when refresh fails', async () => {
    const first = () => Promise.resolve('2026 standings');
    await act(async () => { renderer = create(<Probe cacheKey="2026" fetcher={first} />); });
    await vi.waitFor(async () => { await act(async () => {}); expect(latest.data).toBe('2026 standings'); });
    expect(latest.data).toBe('2026 standings');
    const next = deferred<string>();
    const fetcher = () => next.promise;
    renders.length = 0;
    await act(async () => { renderer.update(<Probe cacheKey="2025" fetcher={fetcher} />); });
    expect(renders.every(value => value !== '2026 standings')).toBe(true);
    expect(latest.data).toBeNull();
    expect(latest.loading).toBe(true);
    await act(async () => { next.reject(new Error('upstream unavailable')); });
    expect(latest.data).toBeNull();
    expect(latest.error?.message).toBe('upstream unavailable');
    expect(latest.updatedAt).toBeNull();
  });

  it('ignores an earlier request that completes after a season switch', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const firstFetcher = () => first.promise;
    const secondFetcher = () => second.promise;
    await act(async () => { renderer = create(<Probe cacheKey="2026" fetcher={firstFetcher} />); });
    await act(async () => { renderer.update(<Probe cacheKey="2025" fetcher={secondFetcher} />); });
    await act(async () => { second.resolve('2025 standings'); });
    await act(async () => { first.resolve('2026 standings'); });
    expect(latest.data).toBe('2025 standings');
  });

  it('retains the same season stale snapshot with an explicit refresh error', async () => {
    setMemoryCacheValue('2026', 'saved standings', Date.now() - 25 * 60 * 60 * 1000);
    const fetcher = () => Promise.reject(new Error('offline upstream'));
    await act(async () => { renderer = create(<Probe cacheKey="2026" fetcher={fetcher} />); });
    expect(latest.data).toBe('saved standings');
    expect(latest.isStale).toBe(true);
    expect(latest.error?.message).toBe('offline upstream');
    expect(latest.loading).toBe(false);
  });

  it('clears previous season data when switching while offline', async () => {
    const first = () => Promise.resolve('2026 standings');
    await act(async () => { renderer = create(<Probe cacheKey="2026" fetcher={first} />); });
    network.connected = false;
    const second = vi.fn(() => Promise.resolve('2025 standings'));
    await act(async () => { renderer.update(<Probe cacheKey="2025" fetcher={second} />); });
    expect(latest.data).toBeNull();
    expect(latest.error).not.toBeNull();
    expect(second).not.toHaveBeenCalled();
  });
});
