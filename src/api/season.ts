import type {
  ConstructorStanding,
  DriverStanding,
  ErgastResponse,
  Race,
  Season,
} from '@/types';
import { withRetry } from '@/utils/withRetry';
import { assertCompleteList, assertContiguousRounds, assertUniqueValues } from '@/utils/dataCompleteness';
import { measureRequest } from '@/utils/performance';

const baseURL = '/f1-api';

function getJolpica<T>(path: string): Promise<T> {
  return withRetry((signal) => measureRequest('jolpica', path, async () => {
    const response = await fetch(`${baseURL}${path}`, { signal });
    if (!response.ok) {
      const error = new Error(`Jolpica request failed with ${response.status}`) as Error & {
        status: number;
        retryAfterMs?: number;
      };
      error.status = response.status;
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfterSeconds)) error.retryAfterMs = retryAfterSeconds * 1000;
      throw error;
    }
    return response.json() as Promise<T>;
  }), { timeoutMs: 8000, maxRetries: 2 });
}

export const seasonApi = {
  async getAllSeasons(limit = 100): Promise<Season[]> {
    const response = await getJolpica<ErgastResponse<never>>(`/seasons.json?limit=${limit}`);
    return response.MRData.SeasonTable?.Seasons || [];
  },

  async getSeasonRaces(season: string): Promise<Race[]> {
    const response = await getJolpica<ErgastResponse<never>>(`/${season}.json`);
    const races = response.MRData.RaceTable?.Races || [];
    return assertUniqueValues(
      assertContiguousRounds(
        assertCompleteList(races, response.MRData.total, 'Jolpica season races'),
        (race) => Number(race.round),
        'Jolpica season races',
      ),
      (race) => race.round,
      'Jolpica season races',
    );
  },

  async getDriverStandings(season: string): Promise<DriverStanding[]> {
    const response = await getJolpica<ErgastResponse<never>>(`/${season}/driverStandings.json`);
    const standings = response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
    return assertUniqueValues(
      standings,
      (standing) => standing.Driver.driverId,
      'driver standings',
    );
  },

  async getConstructorStandings(season: string): Promise<ConstructorStanding[]> {
    const response = await getJolpica<ErgastResponse<never>>(`/${season}/constructorStandings.json`);
    const standings = response.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];
    return assertUniqueValues(
      standings,
      (standing) => standing.Constructor.constructorId,
      'constructor standings',
    );
  },
};
