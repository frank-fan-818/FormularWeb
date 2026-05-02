import { describe, expect, it } from 'vitest';
import {
  getDefaultCurrentSeason,
  getSeasonCacheDuration,
  isActiveSeason,
} from './currentSeason';

describe('current season helpers', () => {
  it('uses the current calendar year once the live era has started', () => {
    expect(getDefaultCurrentSeason(new Date('2026-05-02T00:00:00Z'))).toBe('2026');
  });

  it('does not fall below the first supported live season', () => {
    expect(getDefaultCurrentSeason(new Date('2024-05-02T00:00:00Z'))).toBe('2025');
  });

  it('treats only the default current season as active', () => {
    const now = new Date('2026-05-02T00:00:00Z');

    expect(isActiveSeason('2026', now)).toBe(true);
    expect(isActiveSeason('2025', now)).toBe(false);
  });

  it('keeps active-season data fresher than historical data', () => {
    const now = new Date('2026-05-02T00:00:00Z');

    expect(getSeasonCacheDuration('2026', now)).toBe(60 * 1000);
    expect(getSeasonCacheDuration('2025', now)).toBe(60 * 60 * 1000);
  });
});
