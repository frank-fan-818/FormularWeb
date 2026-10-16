import { afterEach, expect, it, vi } from 'vitest';
const preferences = vi.hoisted(() => ({
  keys: vi.fn(async () => ({ keys: ['f1-data-cache-private', 'theme'] })),
  remove: vi.fn(async (_options: { key: string }) => undefined),
}));
vi.mock('@capacitor/preferences', () => ({ Preferences: preferences }));
import { clearPrivateData } from './privateDataCleanup';
import { analyticsCache, analyticsRequests, cacheGeneration } from '@/api/fastf1AnalyticsCache';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

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

it('clears legacy browser and Preferences caches without loading the native adapter', async () => {
  const storage = new Map([
    ['f1-data-cache-private', 'legacy'],
    ['CapacitorStorage.f1-data-cache-private', 'legacy'],
    ['CapacitorStorage.theme', 'dark'],
  ]);
  vi.stubGlobal('localStorage', {
    get length() { return storage.size; },
    key: (index: number) => [...storage.keys()][index],
    removeItem: (key: string) => storage.delete(key),
  });
  clearPrivateData();
  await vi.dynamicImportSettled();
  expect([...storage.keys()]).toEqual(['CapacitorStorage.theme']);
  expect(preferences.keys).not.toHaveBeenCalled();
});

it.each(['registered', 'android', 'ios'])('still purges private Preferences keys on %s native platforms', async (platform) => {
  if (platform === 'registered') vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
  else if (platform === 'android') vi.stubGlobal('androidBridge', {});
  else vi.stubGlobal('webkit', { messageHandlers: { bridge: {} } });
  clearPrivateData();
  await vi.dynamicImportSettled();
  expect(preferences.remove).toHaveBeenCalledExactlyOnceWith({ key: 'f1-data-cache-private' });
});
