import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  mapConstructorHistorySummary,
  mapDriverHistorySummary,
} from '@/api/historySummaries';
import { supabaseApi } from '@/api/supabase';
import { supabase } from '@/utils/supabase';
import { logger } from '@/utils/logger';
import { validateOrWarn } from '@/api/validation';
import { RaceSchema } from '@/api/schemas';
import type {
  ErgastResponse,
  Season,
  DriverStanding,
  ConstructorStanding,
  Race,
  Circuit,
  Driver,
  Constructor,
  DriverHistoryProfile,
  DriverSeasonHistoryItem,
  ConstructorHistoryProfile,
  ConstructorSeasonHistoryItem,
  HistoryCareerSummary,
  BestFinishSummary,
} from '@/types';

// Use the local Vite proxy in development and Jolpica directly in production.
const baseURL = import.meta.env.DEV ? '/f1-api' : 'https://api.jolpi.ca/ergast/f1';

const ergastApi = axios.create({
  baseURL,
  timeout: 15000,
});

type TimedAxiosConfig = InternalAxiosRequestConfig & {
  requestStartedAt?: number;
};

function getNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function logJolpicaRequest(config: TimedAxiosConfig, status: 'success' | 'failed') {
  if (!import.meta.env.DEV || typeof config.requestStartedAt !== 'number') {
    return;
  }

  logger.debug({
    event: 'step',
    module: 'jolpica',
    function: config.url || 'unknown',
    status,
    durationMs: Math.round(getNow() - config.requestStartedAt),
  });
}

ergastApi.interceptors.request.use((config) => {
  (config as TimedAxiosConfig).requestStartedAt = getNow();
  return config;
});

ergastApi.interceptors.response.use(
  (response) => {
    logJolpicaRequest(response.config as TimedAxiosConfig, 'success');
    return response.data;
  },
  async (error) => {
    if (error.config) {
      logJolpicaRequest(error.config as TimedAxiosConfig, 'failed');
    }

    const status = error.response?.status;
    const url = (error.config as TimedAxiosConfig)?.url || 'unknown';

    // 4xx = data not available yet (expected), 5xx/timeout = real problem
    if (status && status >= 400 && status < 500) {
      logger.warn({
        event: 'exit',
        module: 'jolpica',
        function: url,
        status: 'failed',
        error: `数据暂不可用 (HTTP ${status})`,
      });
    } else {
      logger.error({
        event: 'exit',
        module: 'jolpica',
        function: url,
        status: 'failed',
        error: `Jolpica API 请求失败: ${error.message}`,
      });
    }
    // Keep fallback handling in consumers so API callers can decide how to recover.
    return Promise.reject(error);
  }
);

export type DriverCareerStandingList = {
  season: string;
  round: string;
  DriverStandings: DriverStanding[];
  ConstructorStandings: never[];
};
export type ConstructorCareerStandingList = {
  season: string;
  round: string;
  DriverStandings: never[];
  ConstructorStandings: ConstructorStanding[];
};
type SupabaseDriverRow = {
  driver_id: string;
  permanent_number?: string | null;
  code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  total_race_starts?: number | null;
  total_pole_positions?: number | null;
  total_podiums?: number | null;
};
type SupabaseConstructorRow = {
  constructor_id: string;
  name?: string | null;
  nationality?: string | null;
  total_race_entries?: number | null;
  total_pole_positions?: number | null;
  total_podiums?: number | null;
};

export const seasonApi = {
  getAllSeasons: async (limit = 100): Promise<Season[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/seasons.json?limit=${limit}`);
    return response.MRData.SeasonTable?.Seasons || [];
  },

  // Sprint results for a season.
  getSeasonSprintResults: async (season: string): Promise<Race[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/sprint.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  getSeasonRaces: async (season: string): Promise<Race[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}.json`);
    const races = response.MRData.RaceTable?.Races || [];
    return races.map((r) => validateOrWarn(RaceSchema, r, `race-${r.season}-${r.round}`) as Race);
  },

  getDriverStandings: async (season: string): Promise<DriverStanding[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/driverStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
  },

  getConstructorStandings: async (season: string): Promise<ConstructorStanding[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructorStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];
  },

  getRaceResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/results.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getQualifyingResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/qualifying.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getSprintResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/sprint.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getPracticeResults: async (season: string, round: string, practiceNumber: 1 | 2 | 3): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/practice/${practiceNumber}.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },

  getSprintQualifyingResults: async (season: string, round: string): Promise<Race | null> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/${round}/sprintQualifying.json`);
    return response.MRData.RaceTable?.Races[0] || null;
  },
};

let allSeasonIdsPromise: Promise<string[]> | null = null;
const driverStandingsBySeasonCache = new Map<string, Promise<DriverStanding[]>>();
const constructorStandingsBySeasonCache = new Map<string, Promise<ConstructorStanding[]>>();
const driverCareerStandingsCache = new Map<string, Promise<DriverCareerStandingList[]>>();
const constructorCareerStandingsCache = new Map<string, Promise<ConstructorCareerStandingList[]>>();
const driverCareerRaceResultsCache = new Map<string, Promise<Race[]>>();
const constructorCareerRaceResultsCache = new Map<string, Promise<Race[]>>();
const STANDINGS_BATCH_SIZE = 6;
const RESULTS_PAGE_LIMIT = 100;
const RATE_LIMIT_RETRY_DELAYS_MS = [250, 600, 1200, 2400];
const BETWEEN_BATCH_DELAY_MS = 180;

async function getAllSeasonIds(): Promise<string[]> {
  if (!allSeasonIdsPromise) {
    allSeasonIdsPromise = seasonApi.getAllSeasons(100).then((seasons) => seasons.map((season) => season.season));
  }

  return allSeasonIdsPromise;
}

function getCachedDriverStandingsBySeason(season: string): Promise<DriverStanding[]> {
  if (!driverStandingsBySeasonCache.has(season)) {
    driverStandingsBySeasonCache.set(season, getStandingsWithRetry(() => seasonApi.getDriverStandings(season)));
  }

  return driverStandingsBySeasonCache.get(season)!;
}

function getCachedConstructorStandingsBySeason(season: string): Promise<ConstructorStanding[]> {
  if (!constructorStandingsBySeasonCache.has(season)) {
    constructorStandingsBySeasonCache.set(season, getStandingsWithRetry(() => seasonApi.getConstructorStandings(season)));
  }

  return constructorStandingsBySeasonCache.get(season)!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const maybeAxiosError = error as { response?: { status?: number }; message?: string };
  return maybeAxiosError.response?.status === 429
    || (maybeAxiosError.message || '').includes('429');
}

async function getStandingsWithRetry<T>(loader: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === RATE_LIMIT_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

async function mapSeasonsInBatches<T>(
  seasons: string[],
  mapper: (season: string) => Promise<T | null>,
): Promise<T[]> {
  const results: T[] = [];

  for (let start = 0; start < seasons.length; start += STANDINGS_BATCH_SIZE) {
    const batch = seasons.slice(start, start + STANDINGS_BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map((season) => mapper(season)));

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    });

    if (start + STANDINGS_BATCH_SIZE < seasons.length) {
      await sleep(BETWEEN_BATCH_DELAY_MS);
    }
  }

  return results;
}

async function mapValuesInBatches<TValue, TResult>(
  values: TValue[],
  mapper: (value: TValue) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let start = 0; start < values.length; start += STANDINGS_BATCH_SIZE) {
    const batch = values.slice(start, start + STANDINGS_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((value) => mapper(value)));
    results.push(...batchResults);

    if (start + STANDINGS_BATCH_SIZE < values.length) {
      await sleep(BETWEEN_BATCH_DELAY_MS);
    }
  }

  return results;
}

function normalizeNameToken(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeIdentifierToken(value: string | null | undefined): string {
  return normalizeNameToken(value).replace(/\s+/g, '_');
}

export function getDriverIdCandidates(
  driverId: string,
  identity?: { givenName?: string; familyName?: string },
): string[] {
  const candidates = [driverId];
  const parts = driverId.split('_').filter(Boolean);

  if (parts.length > 1) {
    candidates.push(parts[parts.length - 1]);
    candidates.push(parts.slice(1).join('_'));
  }

  if (identity?.familyName) {
    const normalizedFamily = normalizeIdentifierToken(identity.familyName);
    if (normalizedFamily) {
      candidates.push(normalizedFamily);

      const familyParts = normalizedFamily.split('_').filter(Boolean);
      if (familyParts.length > 1) {
        candidates.push(familyParts[familyParts.length - 1]);
      }

      if (familyParts[familyParts.length - 1] === 'jr' && familyParts.length > 1) {
        candidates.push(familyParts.slice(0, -1).join('_'));
        candidates.push(familyParts[familyParts.length - 2]);
      }
    }
  }

  return [...new Set(candidates.filter(Boolean))];
}

function findDriverStandingMatch(
  standings: DriverStanding[],
  params: { driverId: string; givenName?: string; familyName?: string },
): DriverStanding | null {
  const candidates = getDriverIdCandidates(params.driverId, params);
  const normalizedGivenName = normalizeNameToken(params.givenName);
  const normalizedFamilyName = normalizeNameToken(params.familyName);

  return standings.find((standing) => {
    if (candidates.includes(standing.Driver.driverId)) {
      return true;
    }

    if (!normalizedGivenName || !normalizedFamilyName) {
      return false;
    }

    return normalizeNameToken(standing.Driver.givenName) === normalizedGivenName
      && normalizeNameToken(standing.Driver.familyName) === normalizedFamilyName;
  }) || null;
}

async function getDriverCareerStandings(
  params: { driverId: string; givenName?: string; familyName?: string },
): Promise<DriverCareerStandingList[]> {
  const cacheKey = [
    normalizeIdentifierToken(params.driverId),
    normalizeIdentifierToken(params.givenName),
    normalizeIdentifierToken(params.familyName),
  ].join('|');

  if (!driverCareerStandingsCache.has(cacheKey)) {
    driverCareerStandingsCache.set(cacheKey, loadDriverCareerStandings(params));
  }

  return driverCareerStandingsCache.get(cacheKey)!;
}

async function loadDriverCareerStandings(
  params: { driverId: string; givenName?: string; familyName?: string },
): Promise<DriverCareerStandingList[]> {
  const seasonIds = await getAllSeasonIds();
  const matches = await mapSeasonsInBatches(seasonIds, async (season) => {
    const standings = await getCachedDriverStandingsBySeason(season);
    const matchedStanding = findDriverStandingMatch(standings, params);

    if (!matchedStanding) {
      return null;
    }

      return {
        season,
        round: '',
        DriverStandings: [matchedStanding],
        ConstructorStandings: [],
    };
  });

  return sortSeasonsDescending(matches);
}

async function getConstructorCareerStandings(
  constructorId: string,
): Promise<ConstructorCareerStandingList[]> {
  const cacheKey = normalizeIdentifierToken(constructorId);

  if (!constructorCareerStandingsCache.has(cacheKey)) {
    constructorCareerStandingsCache.set(cacheKey, loadConstructorCareerStandings(constructorId));
  }

  return constructorCareerStandingsCache.get(cacheKey)!;
}

async function loadConstructorCareerStandings(
  constructorId: string,
): Promise<ConstructorCareerStandingList[]> {
  const seasonIds = await getAllSeasonIds();
  const matches = await mapSeasonsInBatches(seasonIds, async (season) => {
    const standings = await getCachedConstructorStandingsBySeason(season);
    const matchedStanding = standings.find((standing) => standing.Constructor.constructorId === constructorId) || null;

    if (!matchedStanding) {
      return null;
    }

    return {
      season,
      round: '',
      DriverStandings: [],
      ConstructorStandings: [matchedStanding],
    };
  });

  return sortSeasonsDescending(matches);
}

export const circuitApi = {
  getAllCircuits: async (limit = 100): Promise<Circuit[]> => {
    const { data } = await supabase
      .from('circuits')
      .select('*')
      .limit(limit);

    // Map Supabase circuit rows into the Ergast-shaped UI type.
    return (data || []).map(circuit => ({
      circuitId: circuit.circuit_id,
      url: '#',
      circuitName: circuit.name,
      Location: {
        lat: circuit.lat?.toString() || '0',
        long: circuit.long?.toString() || '0',
        locality: circuit.locality || '',
        country: circuit.country || ''
      }
    }));
  },
};

export const driverApi = {
  getAllDrivers: async (limit = 1000): Promise<Driver[]> => {
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .limit(limit);

    // Map Supabase driver rows into the Ergast-shaped UI type.
    return (data || []).map(driver => ({
      driverId: driver.driver_id,
      permanentNumber: driver.permanent_number || '',
      code: driver.code || '',
      url: '#',
      givenName: driver.first_name,
      familyName: driver.last_name,
      dateOfBirth: driver.date_of_birth || '',
      nationality: driver.nationality || ''
    }));
  },

  // Race results for one driver in one season.
  getDriverSeasonRaceResults: async (driverId: string, season: string): Promise<Race[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/drivers/${driverId}/results.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  getDriverCareer: async (
    driverId: string,
    identity?: { givenName?: string; familyName?: string },
  ): Promise<DriverCareerStandingList[]> => {
    return getDriverCareerStandings({
      driverId,
      givenName: identity?.givenName,
      familyName: identity?.familyName,
    });
  },

  // Total race starts for a driver.
  getDriverRaceCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/results.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // Total pole positions for a driver.
  getDriverPoleCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/qualifying/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // Total race wins for a driver.
  getDriverWinCount: async (driverId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/drivers/${driverId}/results/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  getDriverPodiumCount: async (driverId: string): Promise<number> => {
    const [wins, secondPlaces, thirdPlaces] = await Promise.all([
      ergastApi.get(`/drivers/${driverId}/results/1.json?limit=1000`) as Promise<ErgastResponse<never>>,
      ergastApi.get(`/drivers/${driverId}/results/2.json?limit=1000`) as Promise<ErgastResponse<never>>,
      ergastApi.get(`/drivers/${driverId}/results/3.json?limit=1000`) as Promise<ErgastResponse<never>>,
    ]);

    return [wins, secondPlaces, thirdPlaces]
      .map((response) => parseInt(response.MRData.total || '0', 10))
      .reduce((total, value) => total + value, 0);
  },

  // Total championship-winning seasons for a driver.
  getDriverChampionshipCount: async (driverId: string): Promise<number> => {
    const standings = await driverApi.getDriverCareer(driverId);
    return standings.filter((standing) => standing.DriverStandings?.[0]?.position === '1').length;
  },

  // Total career points for a driver.
  getDriverTotalPoints: async (driverId: string): Promise<number> => {
    const standings = await driverApi.getDriverCareer(driverId);
    return standings.reduce((total, standingList) => {
      return total + toNumericValue(standingList.DriverStandings?.[0]?.points);
    }, 0);
  },
};

export const constructorApi = {
  getAllConstructors: async (limit = 200): Promise<Constructor[]> => {
    const { data } = await supabase
      .from('constructors')
      .select('*')
      .limit(limit);

    // Map Supabase constructor rows into the Ergast-shaped UI type.
    return (data || []).map(constructor => ({
      constructorId: constructor.constructor_id,
      url: '#',
      name: constructor.name,
      nationality: constructor.nationality || ''
    }));
  },

  // Race results for one constructor in one season.
  getConstructorSeasonRaceResults: async (constructorId: string, season: string): Promise<Race[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructors/${constructorId}/results.json?limit=100`);
    return response.MRData.RaceTable?.Races || [];
  },

  // Total race entries for a constructor.
  getConstructorRaceCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/results.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // Total pole positions for a constructor.
  getConstructorPoleCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/qualifying/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // Total race wins for a constructor.
  getConstructorWinCount: async (constructorId: string): Promise<number> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/constructors/${constructorId}/results/1.json?limit=1000`);
    return parseInt(response.MRData.total || '0', 10);
  },

  // Total championship-winning seasons for a constructor.
  getConstructorChampionshipCount: async (constructorId: string): Promise<number> => {
    const standings = await getConstructorCareerStandings(constructorId);
    return standings.filter((standing) => standing.ConstructorStandings?.[0]?.position === '1').length;
  },

  // Total career points for a constructor.
  getConstructorTotalPoints: async (constructorId: string): Promise<number> => {
    const standings = await getConstructorCareerStandings(constructorId);
    return standings.reduce((total, standingList) => {
      return total + toNumericValue(standingList.ConstructorStandings?.[0]?.points);
    }, 0);
  },
};

function toNumericValue(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getResultPositionValue(value: string | null | undefined): number {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortSeasonsDescending<T extends { season: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => parseInt(right.season, 10) - parseInt(left.season, 10));
}

async function loadPaginatedRaceResults(path: string): Promise<Race[]> {
  const firstResponse = await getStandingsWithRetry(() => (
    ergastApi.get(`${path}?limit=${RESULTS_PAGE_LIMIT}&offset=0`) as Promise<ErgastResponse<never>>
  ));
  const firstPageRaces = firstResponse.MRData.RaceTable?.Races || [];
  const total = parseInt(firstResponse.MRData.total || '0', 10);

  if (total <= RESULTS_PAGE_LIMIT) {
    return firstPageRaces;
  }

  const offsets: number[] = [];
  for (let offset = RESULTS_PAGE_LIMIT; offset < total; offset += RESULTS_PAGE_LIMIT) {
    offsets.push(offset);
  }

  const remainingPages = await mapValuesInBatches(offsets, async (offset) => {
    const response = await getStandingsWithRetry(() => (
      ergastApi.get(`${path}?limit=${RESULTS_PAGE_LIMIT}&offset=${offset}`) as Promise<ErgastResponse<never>>
    ));
    return response.MRData.RaceTable?.Races || [];
  });

  return [...firstPageRaces, ...remainingPages.flat()];
}

function extractBestFinishSummary(races: Race[]): BestFinishSummary | null {
  let bestPosition = Number.POSITIVE_INFINITY;
  const seasons = new Set<string>();

  races.forEach((race) => {
    const raceBestPosition = (race.Results || []).reduce((best, result) => {
      return Math.min(best, getResultPositionValue(result.position));
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(raceBestPosition)) {
      return;
    }

    if (raceBestPosition < bestPosition) {
      bestPosition = raceBestPosition;
      seasons.clear();
      seasons.add(String(race.season));
      return;
    }

    if (raceBestPosition === bestPosition) {
      seasons.add(String(race.season));
    }
  });

  if (!Number.isFinite(bestPosition)) {
    return null;
  }

  return {
    position: String(bestPosition),
    seasons: [...seasons].sort((left, right) => parseInt(left, 10) - parseInt(right, 10)),
  };
}

async function getDriverCareerRaceResults(driverId: string): Promise<Race[]> {
  const cacheKey = normalizeIdentifierToken(driverId);

  if (!driverCareerRaceResultsCache.has(cacheKey)) {
    driverCareerRaceResultsCache.set(cacheKey, loadPaginatedRaceResults(`/drivers/${driverId}/results.json`));
  }

  return driverCareerRaceResultsCache.get(cacheKey)!;
}

async function getConstructorCareerRaceResults(constructorId: string): Promise<Race[]> {
  const cacheKey = normalizeIdentifierToken(constructorId);

  if (!constructorCareerRaceResultsCache.has(cacheKey)) {
    constructorCareerRaceResultsCache.set(cacheKey, loadPaginatedRaceResults(`/constructors/${constructorId}/results.json`));
  }

  return constructorCareerRaceResultsCache.get(cacheKey)!;
}

export function mapDriverSeasonHistory(standingsLists: DriverCareerStandingList[]): DriverSeasonHistoryItem[] {
  const seasons = standingsLists
    .map((standingList) => {
      const standing = standingList.DriverStandings?.[0];
      const constructor = standing?.Constructors?.[0];

      if (!standing || !standingList.season) {
        return null;
      }

      return {
        season: String(standingList.season),
        position: standing.position || '-',
        points: toNumericValue(standing.points),
        wins: parseInt(standing.wins || '0', 10) || 0,
        constructorName: constructor?.name || '',
        constructorId: constructor?.constructorId || '',
      };
    })
    .filter((item): item is DriverSeasonHistoryItem => item !== null);

  return sortSeasonsDescending(seasons);
}

export function mapConstructorSeasonHistory(standingsLists: ConstructorCareerStandingList[]): ConstructorSeasonHistoryItem[] {
  const seasons = standingsLists
    .map((standingList) => {
      const standing = standingList.ConstructorStandings?.[0];

      if (!standing || !standingList.season) {
        return null;
      }

      return {
        season: String(standingList.season),
        position: standing.position || '-',
        points: toNumericValue(standing.points),
        wins: parseInt(standing.wins || '0', 10) || 0,
      };
    })
    .filter((item): item is ConstructorSeasonHistoryItem => item !== null);

  return sortSeasonsDescending(seasons);
}

function buildCareerSummary(params: {
  raceCount: number;
  poleCount: number;
  podiumCount: number;
  seasons: Array<{ position: string; points: number; wins: number }>;
  winCount?: number;
  championshipCount?: number;
  totalPoints?: number;
}): HistoryCareerSummary {
  const championshipCount = params.championshipCount ?? params.seasons.filter((season) => season.position === '1').length;
  const totalPoints = params.totalPoints ?? params.seasons.reduce((total, season) => total + season.points, 0);
  const winCount = params.winCount ?? params.seasons.reduce((total, season) => total + season.wins, 0);

  return {
    raceCount: params.raceCount,
    poleCount: params.poleCount,
    podiumCount: params.podiumCount,
    championshipCount,
    totalPoints,
    winCount,
  };
}

function mapSupabaseDriverHistoryProfile(driver: SupabaseDriverRow): Omit<DriverHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons' | 'recentConstructorName' | 'recentConstructorId'> {
  return {
    driverId: driver.driver_id,
    permanentNumber: driver.permanent_number || '',
    code: driver.code || '',
    url: '#',
    givenName: driver.first_name || '',
    familyName: driver.last_name || '',
    dateOfBirth: driver.date_of_birth || '',
    nationality: driver.nationality || '',
  };
}

function mapSupabaseConstructorHistoryProfile(constructor: SupabaseConstructorRow): Omit<ConstructorHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons'> {
  return {
    constructorId: constructor.constructor_id,
    url: '#',
    name: constructor.name || '',
    nationality: constructor.nationality || '',
  };
}

function buildDriverFallbackProfile(driverId: string, standingsLists: DriverCareerStandingList[]): Omit<DriverHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons' | 'recentConstructorName' | 'recentConstructorId'> | null {
  const latestStanding = sortSeasonsDescending(standingsLists).find((standingList) => standingList.DriverStandings?.[0]);
  const driver = latestStanding?.DriverStandings?.[0]?.Driver;

  if (!driver) {
    return null;
  }

  return {
    driverId: driver.driverId || driverId,
    permanentNumber: driver.permanentNumber || '',
    code: driver.code || '',
    url: driver.url || '#',
    givenName: driver.givenName || '',
    familyName: driver.familyName || '',
    dateOfBirth: driver.dateOfBirth || '',
    nationality: driver.nationality || '',
  };
}

async function resolveDriverHistoryIdentity(
  driverId: string,
  identity?: { givenName?: string; familyName?: string },
): Promise<{
  resolvedDriverId: string;
  standingsLists: DriverCareerStandingList[];
}> {
  const standingsLists = await driverApi.getDriverCareer(driverId, identity);
  const latestStandingDriverId = standingsLists.find((standingList) => standingList.DriverStandings?.[0])
    ?.DriverStandings?.[0]?.Driver?.driverId;

  if (latestStandingDriverId) {
    return {
      resolvedDriverId: latestStandingDriverId,
      standingsLists,
    };
  }

  const candidates = getDriverIdCandidates(driverId, identity);

  for (const candidate of candidates) {
    try {
      const raceCount = await driverApi.getDriverRaceCount(candidate);
      if (raceCount > 0) {
        return {
          resolvedDriverId: candidate,
          standingsLists: [],
        };
      }
    } catch {
      // Same fallback logic as above: keep scanning candidates.
    }
  }

  return {
    resolvedDriverId: driverId,
    standingsLists: [],
  };
}

async function getDriverHistorySummaryProfile(driverId: string): Promise<DriverHistoryProfile | null> {
  const summary = await supabaseApi.driverHistorySummaries.getById(driverId);
  return mapDriverHistorySummary(summary);
}

async function getConstructorHistorySummaryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  const summary = await supabaseApi.constructorHistorySummaries.getById(constructorId);
  return mapConstructorHistorySummary(summary);
}

export const historyApi = {
  getMostDriverChampionships: async (): Promise<{ count: number; driver: Driver } | null> => {
    const response: ErgastResponse<never> = await ergastApi.get('/driverStandings/1.json?limit=100');
    const standings = response.MRData.StandingsTable?.StandingsLists || [];
    const driverCounts: Record<string, { count: number; driver: Driver }> = {};

    standings.forEach((standingList) => {
      if (standingList.DriverStandings && standingList.DriverStandings[0]) {
        const driver = standingList.DriverStandings[0].Driver;
        const driverId = driver.driverId;
        if (!driverCounts[driverId]) {
          driverCounts[driverId] = { count: 0, driver };
        }
        driverCounts[driverId].count++;
      }
    });

    const sorted = Object.values(driverCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  },

  getMostDriverWins: async (): Promise<Driver | null> => {
    const response: ErgastResponse<never> = await ergastApi.get('/results/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.Results?.[0]?.Driver || null;
  },

  getMostDriverPoles: async (): Promise<Driver | null> => {
    const response: ErgastResponse<never> = await ergastApi.get('/qualifying/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.QualifyingResults?.[0]?.Driver || null;
  },

  getMostConstructorChampionships: async (): Promise<{ count: number; constructor: Constructor } | null> => {
    const response: ErgastResponse<never> = await ergastApi.get('/constructorStandings/1.json?limit=100');
    const standings = response.MRData.StandingsTable?.StandingsLists || [];
    const constructorCounts: Record<string, { count: number; constructor: Constructor }> = {};

    standings.forEach((standingList) => {
      if (standingList.ConstructorStandings && standingList.ConstructorStandings[0]) {
        const constructor = standingList.ConstructorStandings[0].Constructor;
        const constructorId = constructor.constructorId;
        if (!constructorCounts[constructorId]) {
          constructorCounts[constructorId] = { count: 0, constructor };
        }
        constructorCounts[constructorId].count++;
      }
    });

    const sorted = Object.values(constructorCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  },

  getMostConstructorWins: async (): Promise<Constructor | null> => {
    const response: ErgastResponse<never> = await ergastApi.get('/results/1.json?limit=1');
    return response.MRData.RaceTable?.Races?.[0]?.Results?.[0]?.Constructor || null;
  },

  getDriverHistoryProfile: async (driverId: string): Promise<DriverHistoryProfile | null> => {
    const directSummaryProfile = await getDriverHistorySummaryProfile(driverId);
    if (directSummaryProfile) {
      return directSummaryProfile;
    }

    const exactSupabaseDriver = await supabaseApi.drivers.getById<SupabaseDriverRow>(driverId);
    const { resolvedDriverId, standingsLists } = await resolveDriverHistoryIdentity(driverId, exactSupabaseDriver
      ? {
        givenName: exactSupabaseDriver.first_name || undefined,
        familyName: exactSupabaseDriver.last_name || undefined,
      }
      : undefined);

    if (resolvedDriverId !== driverId) {
      const resolvedSummaryProfile = await getDriverHistorySummaryProfile(resolvedDriverId);
      if (resolvedSummaryProfile) {
        return resolvedSummaryProfile;
      }
    }

    const seasons = mapDriverSeasonHistory(standingsLists);
    const latestSeason = seasons[0];

    let baseProfile = exactSupabaseDriver
      ? mapSupabaseDriverHistoryProfile(exactSupabaseDriver)
      : null;

    if (!baseProfile && resolvedDriverId !== driverId) {
      const resolvedSupabaseDriver = await supabaseApi.drivers.getById<SupabaseDriverRow>(resolvedDriverId);
      if (resolvedSupabaseDriver) {
        baseProfile = mapSupabaseDriverHistoryProfile(resolvedSupabaseDriver);
      }
    }

    if (!baseProfile && standingsLists.length > 0) {
      const allDrivers = await supabaseApi.drivers.getAll<SupabaseDriverRow>();
      const latestStandingDriver = standingsLists
        .slice()
        .reverse()
        .find((standingList) => standingList.DriverStandings?.[0])
        ?.DriverStandings?.[0]?.Driver;

      const matchedDriver = latestStandingDriver
        ? allDrivers.find((driver) =>
          driver.first_name === latestStandingDriver.givenName
          && driver.last_name === latestStandingDriver.familyName)
        : null;

      if (matchedDriver) {
        baseProfile = mapSupabaseDriverHistoryProfile(matchedDriver);
      }
    }

    baseProfile = baseProfile || buildDriverFallbackProfile(driverId, standingsLists);

    if (!baseProfile) {
      return null;
    }

    const [raceCountResult, poleCountResult, podiumCountResult, winCountResult, championshipCountResult, totalPointsResult, bestFinishResult] = await Promise.allSettled([
      driverApi.getDriverRaceCount(resolvedDriverId),
      driverApi.getDriverPoleCount(resolvedDriverId),
      driverApi.getDriverPodiumCount(resolvedDriverId),
      driverApi.getDriverWinCount(resolvedDriverId),
      driverApi.getDriverChampionshipCount(resolvedDriverId),
      driverApi.getDriverTotalPoints(resolvedDriverId),
      getDriverCareerRaceResults(resolvedDriverId).then(extractBestFinishSummary),
    ]);

    const fallbackPodiumCount = exactSupabaseDriver?.total_podiums || 0;
    const fallbackRaceCount = exactSupabaseDriver?.total_race_starts || 0;
    const fallbackPoleCount = exactSupabaseDriver?.total_pole_positions || 0;

    return {
      ...baseProfile,
      recentConstructorName: latestSeason?.constructorName || '',
      recentConstructorId: latestSeason?.constructorId || '',
      careerSummary: buildCareerSummary({
        raceCount: raceCountResult.status === 'fulfilled' ? raceCountResult.value : fallbackRaceCount,
        poleCount: poleCountResult.status === 'fulfilled' ? poleCountResult.value : fallbackPoleCount,
        podiumCount: podiumCountResult.status === 'fulfilled' ? podiumCountResult.value : fallbackPodiumCount,
        seasons,
        winCount: winCountResult.status === 'fulfilled' ? winCountResult.value : undefined,
        championshipCount: championshipCountResult.status === 'fulfilled' ? championshipCountResult.value : undefined,
        totalPoints: totalPointsResult.status === 'fulfilled' ? totalPointsResult.value : undefined,
      }),
      bestRaceFinish: bestFinishResult.status === 'fulfilled' ? bestFinishResult.value : null,
      seasons,
    };
  },

  getConstructorHistoryProfile: async (constructorId: string): Promise<ConstructorHistoryProfile | null> => {
    const summaryProfile = await getConstructorHistorySummaryProfile(constructorId);
    if (summaryProfile) {
      return summaryProfile;
    }

    const constructorInfo = await supabaseApi.constructors.getById<SupabaseConstructorRow>(constructorId);
    const standingsLists = await getConstructorCareerStandings(constructorId);
    const seasons = mapConstructorSeasonHistory(standingsLists);

    const baseProfile = constructorInfo
      ? mapSupabaseConstructorHistoryProfile(constructorInfo)
      : {
        constructorId,
        url: '#',
        name: standingsLists[0]?.ConstructorStandings?.[0]?.Constructor?.name || constructorId,
        nationality: standingsLists[0]?.ConstructorStandings?.[0]?.Constructor?.nationality || '',
      };

    if (!baseProfile.name && seasons.length === 0) {
      return null;
    }

    const [raceCountResult, poleCountResult, winCountResult, championshipCountResult, totalPointsResult, bestFinishResult] = await Promise.allSettled([
      constructorApi.getConstructorRaceCount(constructorId),
      constructorApi.getConstructorPoleCount(constructorId),
      constructorApi.getConstructorWinCount(constructorId),
      constructorApi.getConstructorChampionshipCount(constructorId),
      constructorApi.getConstructorTotalPoints(constructorId),
      getConstructorCareerRaceResults(constructorId).then(extractBestFinishSummary),
    ]);

    return {
      ...baseProfile,
      careerSummary: buildCareerSummary({
        raceCount: raceCountResult.status === 'fulfilled'
          ? raceCountResult.value
          : (constructorInfo?.total_race_entries || 0),
        poleCount: poleCountResult.status === 'fulfilled'
          ? poleCountResult.value
          : (constructorInfo?.total_pole_positions || 0),
        podiumCount: constructorInfo?.total_podiums || 0,
        seasons,
        winCount: winCountResult.status === 'fulfilled' ? winCountResult.value : undefined,
        championshipCount: championshipCountResult.status === 'fulfilled' ? championshipCountResult.value : undefined,
        totalPoints: totalPointsResult.status === 'fulfilled' ? totalPointsResult.value : undefined,
      }),
      bestRaceFinish: bestFinishResult.status === 'fulfilled' ? bestFinishResult.value : null,
      seasons,
    };
  },
};

export default ergastApi;
