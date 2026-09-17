import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@capacitor/preferences', () => ({ Preferences: { keys: async () => ({ keys: [] }) } }));
import { clearPrivateData } from './privateDataCleanup';
import { analyticsCache, analyticsRequests, cacheGeneration } from '@/api/fastf1AnalyticsCache';

afterEach(() => vi.unstubAllGlobals());

it('synchronously invalidates cached and in-flight analytics when identity changes', () => {
  analyticsCache.set('member:2026:1:R', { expiresAt: Date.now() + 1000, data: null });
  analyticsRequests.set('member:2026:1:R', Promise.resolve(null));
  const generation = cacheGeneration;
  clearPrivateData();
  expect(analyticsCache.size).toBe(0);
  expect(analyticsRequests.size).toBe(0);
  expect(cacheGeneration).toBe(generation + 1);
});

it('does not create an empty version-1 database before the cache adapter initializes', () => {
  const abort = vi.fn();
  const request = { onupgradeneeded: undefined as undefined | (() => void), transaction: { abort } };
  vi.stubGlobal('indexedDB', { open: () => request });
  clearPrivateData();
  request.onupgradeneeded?.();
  expect(abort).toHaveBeenCalledOnce();
});
