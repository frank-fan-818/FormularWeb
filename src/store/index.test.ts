import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let values: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('persisted time zone settings', () => {
  it('defaults to UTC+8 and persists changes across store reloads', async () => {
    const { useAppStore } = await import('./index');
    expect(useAppStore.getState().timeZoneOffsetMinutes).toBe(480);
    useAppStore.getState().setTimeZoneOffsetMinutes(-300);
    vi.resetModules();
    const { useAppStore: reloaded } = await import('./index');
    expect(reloaded.getState().timeZoneOffsetMinutes).toBe(-300);
  });

  it('adds the default for existing settings without resetting a chosen season or theme', async () => {
    values.set('f1-dashboard-storage', JSON.stringify({ version: 3, state: {
      currentSeason: '2025', theme: 'dark', sidebarCollapsed: true, features: { 'race-predictions': true },
    } }));
    const { useAppStore } = await import('./index');
    expect(useAppStore.getState()).toMatchObject({
      currentSeason: '2025', theme: 'dark', sidebarCollapsed: true,
      features: { 'race-predictions': true }, timeZoneOffsetMinutes: 480,
    });
  });

  it('recovers from an invalid saved offset and rejects invalid updates', async () => {
    values.set('f1-dashboard-storage', JSON.stringify({ version: 4, state: { timeZoneOffsetMinutes: 99999 } }));
    const { useAppStore } = await import('./index');
    expect(useAppStore.getState().timeZoneOffsetMinutes).toBe(480);
    useAppStore.getState().setTimeZoneOffsetMinutes(NaN);
    expect(useAppStore.getState().timeZoneOffsetMinutes).toBe(480);
  });
});
