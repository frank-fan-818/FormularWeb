import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/api/fastf1Analytics', () => ({ clearFastF1AnalyticsCache: vi.fn() }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { keys: async () => ({ keys: [] }) } }));
import { clearPrivateData } from './privateDataCleanup';

afterEach(() => vi.unstubAllGlobals());

it('does not create an empty version-1 database before the cache adapter initializes', () => {
  const abort = vi.fn();
  const request = { onupgradeneeded: undefined as undefined | (() => void), transaction: { abort } };
  vi.stubGlobal('indexedDB', { open: () => request });
  clearPrivateData();
  request.onupgradeneeded?.();
  expect(abort).toHaveBeenCalledOnce();
});
