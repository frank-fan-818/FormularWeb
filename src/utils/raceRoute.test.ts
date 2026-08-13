import { describe, expect, it } from 'vitest';
import { buildRaceSeasonLocation, getRaceSeasonFromSearch } from './raceRoute';

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

describe('buildRaceSeasonLocation', () => {
  it('keeps the latest race sub-route and unrelated query parameters', () => {
    expect(
      buildRaceSeasonLocation('/races/6/results', '?season=2024&view=compact', '2025'),
    ).toBe('/races/6/results?season=2025&view=compact');
  });

  it('rejects an unsupported season', () => {
    expect(buildRaceSeasonLocation('/races/6/results', '?season=2024', '1949')).toBeNull();
  });
});
