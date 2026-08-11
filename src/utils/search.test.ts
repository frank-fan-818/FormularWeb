import { describe, expect, it } from 'vitest';
import { buildSearchIndex, searchIndex, type SearchSources } from '@/utils/search';

const searchSources: SearchSources = {
  drivers: [
    {
      driver_id: 'max_verstappen',
      first_name: 'Max',
      last_name: 'Verstappen',
      code: 'VER',
      nationality: 'Dutch',
    },
  ],
  constructors: [
    {
      constructor_id: 'mercedes',
      name: 'Mercedes',
      nationality: 'German',
    },
  ],
  circuits: [
    {
      circuit_id: 'americas',
      name: 'Circuit of the Americas',
      locality: 'Austin',
      location: null,
      country: 'USA',
    },
  ],
  races: [
    {
      season: 2024,
      round: 6,
      race_name: 'Miami Grand Prix',
      circuit_id: 'miami',
    },
  ],
};

describe('global search index', () => {
  it('matches constructor and circuit aliases', () => {
    const index = buildSearchIndex(searchSources);

    const constructorGroup = searchIndex(index, 'silver arrows').find((group) => group.type === 'constructor');
    const circuitGroup = searchIndex(index, 'cota').find((group) => group.type === 'circuit');

    expect(constructorGroup?.items[0].title).toBe('Mercedes');
    expect(circuitGroup?.items[0].title).toBe('Circuit of the Americas');
  });

  it('keeps search result routes stable', () => {
    const groups = searchIndex(buildSearchIndex(searchSources), 'ver');

    expect(groups.find((group) => group.type === 'driver')?.items[0].route).toBe('/history/drivers/max_verstappen');
    expect(searchIndex(buildSearchIndex(searchSources), 'mercedes')[0].items[0].route).toBe('/history/constructors/mercedes');
    expect(searchIndex(buildSearchIndex(searchSources), 'austin')[0].items[0].route).toBe('/circuits/americas');
    expect(searchIndex(buildSearchIndex(searchSources), 'miami grand prix')[0].items[0].route)
      .toBe('/races/6/info?season=2024');
  });

  it('limits each result group to five entries', () => {
    const manyDrivers: SearchSources = {
      drivers: Array.from({ length: 8 }, (_, index) => ({
        driver_id: `test_driver_${index}`,
        first_name: 'Test',
        last_name: `Driver ${index}`,
        code: `T${index}`,
        nationality: 'Testland',
      })),
      constructors: [],
      circuits: [],
      races: [],
    };

    const driverGroup = searchIndex(buildSearchIndex(manyDrivers), 'test').find((group) => group.type === 'driver');

    expect(driverGroup?.items).toHaveLength(5);
  });

  it('keeps presentation-neutral group identities for localization', () => {
    const groups = searchIndex(buildSearchIndex(searchSources), 'max');

    expect(groups[0].type).toBe('driver');
    expect(groups[0]).not.toHaveProperty('label');
  });
});
