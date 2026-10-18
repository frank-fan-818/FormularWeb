import { describe, expect, it } from 'vitest';
import { mergeSearchSources } from './searchSources';
import { buildSearchIndex, searchIndex, type SearchSources } from './search';

const empty: SearchSources = { drivers: [], constructors: [], circuits: [], races: [] };
const database: SearchSources = {
  ...empty,
  drivers: [
    { driver_id: 'charles_leclerc', first_name: 'Charles', last_name: 'Leclerc', code: 'LEC', nationality: 'monaco', date_of_birth: '1997-10-16' },
    { driver_id: 'charles_de_tornaco', first_name: 'Charles', last_name: 'De Tornaco', code: 'DET', nationality: 'belgium', date_of_birth: '1927-06-07' },
  ],
};
const upstream: SearchSources = {
  ...empty,
  drivers: [
    { driver_id: 'leclerc', first_name: 'Charles', last_name: 'Leclerc', code: 'LEC', nationality: 'Monegasque', date_of_birth: '1997-10-16' },
    { driver_id: 'tornaco', first_name: 'Charles', last_name: 'de Tornaco', nationality: 'Belgian', date_of_birth: '1927-06-07' },
  ],
};

describe('search source identity reconciliation', () => {
  it('reproduces the screenshot and keeps one database-backed result per driver', () => {
    const merged = mergeSearchSources(database, upstream);
    expect(merged.drivers).toHaveLength(2);
    const results = searchIndex(buildSearchIndex(merged), 'Charles')[0].items;
    expect(results.map(item => item.id).sort()).toEqual(['charles_de_tornaco', 'charles_leclerc']);
    expect(results.find(item => item.id === 'charles_leclerc')?.route).toBe('/history/drivers/charles_leclerc');
    expect(merged.drivers.find(driver => driver.driver_id === 'charles_de_tornaco')?.code).toBe('DET');
  });

  it('preserves upstream names and IDs as searchable aliases of the database route', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'kimi_antonelli', first_name: 'Kimi', last_name: 'Antonelli', date_of_birth: '2006-08-25' },
    ] }, { ...empty, drivers: [
      { driver_id: 'antonelli', first_name: 'Andrea Kimi', last_name: 'Antonelli', date_of_birth: '2006-08-25' },
    ] });
    expect(merged.drivers).toHaveLength(1);
    expect(searchIndex(buildSearchIndex(merged), 'Andrea Kimi')[0].items[0].route).toBe('/history/drivers/kimi_antonelli');
    expect(searchIndex(buildSearchIndex(mergeSearchSources(database, upstream)), 'leclerc')[0].items).toHaveLength(1);
  });

  it('normalizes case, punctuation and accents without merging relatives or reused driver codes', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'jose_driver', first_name: 'José', last_name: 'Driver', code: 'JDR', date_of_birth: '1980-01-01' },
      { driver_id: 'another_driver', first_name: 'Another', last_name: 'Driver', code: 'JDR' },
    ] }, { ...empty, drivers: [
      { driver_id: 'driver', first_name: 'JOSE', last_name: 'Driver', date_of_birth: '1980-01-01' },
      { driver_id: 'junior', first_name: 'José', last_name: 'Driver', code: 'JDR', date_of_birth: '2000-01-01' },
    ] });
    expect(merged.drivers.map(driver => driver.driver_id).sort()).toEqual(['another_driver', 'jose_driver', 'junior']);
  });

  it('does not identify unrelated people by birthday or empty names', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'bruce_halford', first_name: 'Bruce', last_name: 'Halford', date_of_birth: '1931-05-18' },
      { driver_id: 'unknown_a', first_name: '', last_name: '' },
    ] }, { ...empty, drivers: [
      { driver_id: 'clapham', first_name: 'David', last_name: 'Clapham', date_of_birth: '1931-05-18' },
      { driver_id: 'unknown_b', first_name: '', last_name: '' },
    ] });
    expect(merged.drivers).toHaveLength(4);
  });

  it('reconciles historical birth-date disagreements only with a corroborating full-name ID', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'clemente_biondetti', first_name: 'Clemente', last_name: 'Biondetti', date_of_birth: '1898-10-18' },
    ] }, { ...empty, drivers: [
      { driver_id: 'biondetti', first_name: 'Clemente', last_name: 'Biondetti', date_of_birth: '1898-08-18' },
    ] });
    expect(merged.drivers).toHaveLength(1);
    expect(merged.drivers[0].date_of_birth).toBe('1898-10-18');
  });

  it('does not guess when matching names without birth dates is ambiguous', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'john_a', first_name: 'John', last_name: 'Smith', date_of_birth: '1940-01-01' },
      { driver_id: 'john_b', first_name: 'John', last_name: 'Smith', date_of_birth: '1970-01-01' },
    ] }, { ...empty, drivers: [{ driver_id: 'smith', first_name: 'John', last_name: 'Smith' }] });
    expect(merged.drivers).toHaveLength(3);
  });

  it('fills missing metadata without overwriting database values', () => {
    const merged = mergeSearchSources({ ...empty, drivers: [
      { driver_id: 'charles_leclerc', first_name: 'Charles', last_name: 'Leclerc', code: null, nationality: 'monaco' },
    ] }, upstream);
    expect(merged.drivers.find(driver => driver.driver_id === 'charles_leclerc')).toMatchObject({ code: 'LEC', nationality: 'monaco' });
  });

  it('reconciles circuit aliases even when display names differ', () => {
    const merged = mergeSearchSources({ ...empty, circuits: [
      { circuit_id: 'melbourne', name: 'Melbourne' },
      { circuit_id: 'spa_francorchamps', name: 'Spa-Francorchamps' },
      { circuit_id: 'rouen', name: 'Rouen-Les-Essarts' },
    ] }, { ...empty, circuits: [
      { circuit_id: 'albert_park', name: 'Albert Park Grand Prix Circuit' },
      { circuit_id: 'spa', name: 'Circuit de Spa-Francorchamps' },
      { circuit_id: 'essarts', name: 'Rouen-Les-Essarts' },
    ] });
    expect(merged.circuits).toHaveLength(3);
    expect(searchIndex(buildSearchIndex(merged), 'Albert Park')[0].items[0].route).toBe('/circuits/melbourne');
  });

  it('keeps the Valencia road and street circuits separate despite the upstream ID collision', () => {
    const merged = mergeSearchSources({ ...empty, circuits: [
      { circuit_id: 'valencia', name: 'Valencia' },
      { circuit_id: 'valencia_street', name: 'Valencia Street' },
    ] }, { ...empty, circuits: [
      { circuit_id: 'valencia', name: 'Valencia Street Circuit', country: 'Spain' },
    ] });
    expect(merged.circuits).toHaveLength(2);
    expect(merged.circuits.find(circuit => circuit.circuit_id === 'valencia')?.country).toBeUndefined();
    expect(searchIndex(buildSearchIndex(merged), 'Valencia Street Circuit')[0].items[0].route).toBe('/circuits/valencia_street');
  });

  it('normalizes constructor IDs and unique names while keeping historical namesakes separate', () => {
    const merged = mergeSearchSources({ ...empty, constructors: [
      { constructor_id: 'alfa_romeo', name: 'Alfa Romeo' },
      { constructor_id: 'behra_porsche', name: 'Behra-Porsche' },
      { constructor_id: 'lotus', name: 'Lotus' },
      { constructor_id: 'lotus_f1', name: 'Lotus' },
      { constructor_id: 'ats', name: 'ATS' },
      { constructor_id: 'ats_wheels', name: 'ATS' },
    ] }, { ...empty, constructors: [
      { constructor_id: 'alfa', name: 'Alfa Romeo' },
      { constructor_id: 'behra-porsche', name: 'Behra-Porsche' },
      { constructor_id: 'lotus_f1', name: 'Lotus F1' },
      { constructor_id: 'ats', name: 'ATS', nationality: 'German' },
    ] });
    expect(merged.constructors).toHaveLength(6);
    expect(merged.constructors.find(team => team.constructor_id === 'ats')?.nationality).toBeUndefined();
    expect(merged.constructors.find(team => team.constructor_id === 'ats_wheels')?.nationality).toBe('German');
  });

  it('keeps distinct race seasons and rounds and gives the database precedence', () => {
    const merged = mergeSearchSources({ ...empty, races: [{ season: 2024, round: 1, race_name: 'Database race' }] },
      { ...empty, races: [
        { season: '2024', round: '1', race_name: 'Upstream race' },
        { season: '2025', round: '1', race_name: 'Upstream race' },
      ] });
    expect(merged.races.map(race => race.race_name)).toEqual(['Database race', 'Upstream race']);
  });

  it('keeps upstream-only results and retryable fallback behavior', () => {
    const merged = mergeSearchSources(null, upstream);
    expect(merged.drivers.map(driver => driver.driver_id)).toEqual(['leclerc', 'tornaco']);
    expect(merged.cacheable).toBe(false);
    expect(mergeSearchSources(database, { ...upstream, cacheable: false }).cacheable).toBe(false);
  });
});
