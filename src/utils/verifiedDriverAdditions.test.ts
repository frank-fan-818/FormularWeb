import { describe, expect, it } from 'vitest';
import manifest from '../../data/reference/verified-driver-additions.json';
import { buildVerifiedDriverAdditions, preserveVerifiedDriverSummaries } from './verifiedDriverAdditions';
import { mapDriverHistorySummary } from '../api/historySummaries';
import { mergeSearchSources } from './searchSources';
import { buildSearchIndex, searchIndex } from './search';

describe('verified search driver additions', () => {
  it('produces complete base and usable archive rows for all fifteen verified identities', () => {
    const { drivers, summaries } = buildVerifiedDriverAdditions(manifest);
    expect(drivers).toHaveLength(15);
    expect(drivers.every(driver => !('url' in driver))).toBe(true);
    expect(summaries).toHaveLength(15);
    for (const summary of summaries) {
      const profile = mapDriverHistorySummary(summary);
      expect(profile?.driverId).toBe(summary.driver_id);
      expect(profile?.careerSummary).toEqual({
        raceCount: 0, winCount: 0, podiumCount: 0, championshipCount: 0, poleCount: 0, totalPoints: 0,
      });
      expect(profile?.seasons).toEqual([]);
      expect(profile?.bestRaceFinish).toBeNull();
    }
  });

  it('preserves uncertain birth dates and verified racing nationality corrections', () => {
    const { drivers } = buildVerifiedDriverAdditions(manifest);
    expect(drivers.find(driver => driver.driver_id === 'david_clapham')?.date_of_birth).toBeNull();
    expect(drivers.find(driver => driver.driver_id === 'thomas_monarch')?.date_of_birth).toBeNull();
    expect(drivers.find(driver => driver.driver_id === 'ernie_de_vos')?.nationality).toBe('Canadian');
    expect(drivers.find(driver => driver.driver_id === 'ray_reed')?.nationality).toBe('Rhodesian');
    expect(drivers.find(driver => driver.driver_id === 'leonardo_fornaroli')?.date_of_birth).toBe('2004-12-03');
  });

  it('distinguishes verified entries from starts and does not assign permanent numbers or timing codes', () => {
    const { drivers } = buildVerifiedDriverAdditions(manifest);
    expect(drivers.find(driver => driver.driver_id === 'carlo_abate')).toMatchObject({ total_race_entries: 3, total_race_starts: 0 });
    expect(drivers.find(driver => driver.driver_id === 'colton_herta')).toMatchObject({ total_race_entries: 0, total_race_starts: 0 });
    expect(drivers.every(driver => driver.code === null && driver.permanent_number === null)).toBe(true);
  });

  it('keeps the added database identity unique when the original upstream records return', () => {
    const { drivers } = buildVerifiedDriverAdditions(manifest);
    const upstream = manifest.drivers.map(driver => ({
      driver_id: driver.upstreamId, first_name: driver.givenName, last_name: driver.familyName,
      date_of_birth: driver.dateOfBirth, nationality: driver.nationality,
    }));
    const sources = mergeSearchSources({ drivers, constructors: [], circuits: [], races: [] },
      { drivers: upstream, constructors: [], circuits: [], races: [] });
    expect(sources.drivers).toHaveLength(15);
    for (const driver of manifest.drivers) {
      const results = searchIndex(buildSearchIndex(sources), `${driver.givenName} ${driver.familyName}`);
      expect(results[0].items).toHaveLength(1);
      expect(results[0].items[0].route).toBe(`/history/drivers/${driver.driverId}`);
    }
  });

  it('rejects repeated identities rather than preparing duplicate inserts', () => {
    expect(() => buildVerifiedDriverAdditions({ ...manifest, drivers: [manifest.drivers[0], manifest.drivers[0]] })).toThrow('Duplicate');
  });

  it('preserves verified zero-start metadata when routine aggregation rebuilds empty histories', () => {
    const { summaries } = buildVerifiedDriverAdditions(manifest);
    const empty = summaries.map(row => ({ ...row, url: '#', recent_constructor_id: null, recent_constructor_name: null,
      career_summary: { raceCount: 0, winCount: 0, podiumCount: 0, championshipCount: 0, poleCount: 0, totalPoints: 0 } }));
    const preserved = preserveVerifiedDriverSummaries(empty, manifest);
    for (const row of preserved) expect(mapDriverHistorySummary(row)).not.toBeNull();
    expect(preserved.find(row => row.driver_id === 'colton_herta')?.recent_constructor_id).toBe('cadillac');
  });

  it('lets real race history replace a previously verified zero-start profile', () => {
    const { summaries } = buildVerifiedDriverAdditions(manifest);
    const active = { ...summaries.find(row => row.driver_id === 'colton_herta')!, career_summary: { raceCount: 1, winCount: 0, podiumCount: 0, championshipCount: 0, poleCount: 0, totalPoints: 0 },
      seasons: [{ season: '2027', position: '20', points: 0, wins: 0, constructorName: 'Team', constructorId: 'team' }] };
    expect(preserveVerifiedDriverSummaries([active], manifest)[0]).toBe(active);
    expect(mapDriverHistorySummary(active)?.participationStatus).toBeUndefined();
  });

  it.each([
    { dateOfBirth: '1932-99-99' }, { entryCount: -1 }, { entryCount: 1, participationStatus: 'test_reserve' },
    { sourceUrls: ['https://api.jolpi.ca/ergast/f1/drivers/abate.json', 'https://api.jolpi.ca/ergast/f1/drivers/abate/results.json'] },
  ])('rejects invalid dates, unsupported entry counts, or missing independent evidence: %j', patch => {
    expect(() => buildVerifiedDriverAdditions({ ...manifest, drivers: [{ ...manifest.drivers[0], ...patch }] })).toThrow();
  });
});
