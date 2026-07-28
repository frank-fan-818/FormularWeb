import { describe, expect, it } from 'vitest';
import { getRaceSeasonFromSearch } from './raceRoute';

describe('getRaceSeasonFromSearch', () => {
  it('uses a valid historical season', () => {
    expect(getRaceSeasonFromSearch('?season=2024', '2026')).toBe('2024');
  });

  it.each([
    '',
    '?season=1949',
    '?season=2101',
    '?season=2024%2F..%2Flogin',
    '?season=not-a-year',
  ])('falls back for invalid search params: %s', (search) => {
    expect(getRaceSeasonFromSearch(search, '2026')).toBe('2026');
  });
});
