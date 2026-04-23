import { describe, expect, it } from 'vitest';
import { isSeasonComplete } from '@/utils/seasonCompletion';

describe('isSeasonComplete', () => {
  it('returns true when every scheduled race is in the past', () => {
    const now = Date.parse('2026-12-31T12:00:00Z');
    const races = [
      { date: '2026-03-15', time: '13:00:00Z' },
      { date: '2026-10-25', time: '14:00:00Z' },
    ];

    expect(isSeasonComplete(races, now)).toBe(true);
  });

  it('returns false when there is a future scheduled race', () => {
    const now = Date.parse('2026-06-01T12:00:00Z');
    const races = [
      { date: '2026-03-15', time: '13:00:00Z' },
      { date: '2026-12-06', time: '14:00:00Z' },
    ];

    expect(isSeasonComplete(races, now)).toBe(false);
  });

  it('treats a season without race schedule as incomplete', () => {
    expect(isSeasonComplete([], Date.parse('2026-06-01T12:00:00Z'))).toBe(false);
  });
});
