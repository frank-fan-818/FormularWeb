import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  mapConstructorHistorySummary,
  mapDriverHistorySummary,
} from '@/api/historySummaries';
import { logger } from '@/utils/logger';
import { validateOrWarn } from '@/api/validation';
import { RaceSchema } from '@/api/schemas';
import { withRetry } from '@/utils/withRetry';
import { assertCompleteList, assertUniqueValues } from '@/utils/dataCompleteness';
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
  SupabaseConstructorDetailRow,
  SupabaseDriverDetailRow,
} from '@/types';

async function getSupabaseClient() {
  return (await import('@/utils/supabase')).supabase;
}

async function getSupabaseApi() {
  return (await import('@/api/supabase')).supabaseApi;
}

// Same-origin proxy avoids browser CORS failures in development and production.
const baseURL = '/f1-api';

const ergastApi = axios.create({
  baseURL,
  timeout: 15000,
});

async function getCompleteRaceEndpoint(
  season: string,
  round: string,
  endpoint: string,
  listKey: 'Results' | 'QualifyingResults' | 'SprintResults',
): Promise<Race | null> {
  const response = await withRetry(
    (signal) => ergastApi.get<never, ErgastResponse<never>>(
      `/${season}/${round}/${endpoint}.json?limit=100`,
      { signal },
    ),
    { timeoutMs: 10_000, maxRetries: 2 },
  );
  const race = response.MRData.RaceTable?.Races[0] || null;
  if (!race) return null;
  const entries = (race[listKey] || []) as Array<{ Driver: { driverId: string } }>;
  assertUniqueValues(
    assertCompleteList(entries, response.MRData.total, `Jolpica ${endpoint} results`),
    (entry) => entry.Driver.driverId,
    `Jolpica ${endpoint} results`,
  );
  return validateOrWarn(RaceSchema, race, `race-${season}-${round}-${endpoint}`) as Race;
}

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
export const seasonApi = {
  getAllSeasons: async (limit = 100): Promise<Season[]> => {
    const response: ErgastResponse<never> = await ergastApi.get(`/seasons.json?limit=${limit}`);
    return response.MRData.SeasonTable?.Seasons || [];
  },

  // Sprint results for a season.
  getSeasonSprintResults: async (season: string): Promise<Race[]> => {
    return getCachedSeasonRaceResults(seasonSprintResultsCache, season, async () => {
      const response: ErgastResponse<never> = await ergastApi.get(`/${season}/sprint.json?limit=100`);
      return response.MRData.RaceTable?.Races || [];
    });
  },

  getSeasonRaces: async (season: string): Promise<Race[]> => {
    const seasonNumber = parseInt(season, 10);

    // Try Supabase first
    if (Number.isInteger(seasonNumber)) {
      const supabase = await getSupabaseClient();
      const { data: dbRaces, error } = await supabase
        .from('races')
        .select('*')
        .eq('season', seasonNumber)
        .order('round');

      if (!error && dbRaces && dbRaces.length > 0) {
        // Fetch related circuits for location data
        const circuitIds = [...new Set(dbRaces.map((r) => r.circuit_id).filter(Boolean))] as string[];
        const { data: dbCircuits } = circuitIds.length > 0
          ? await supabase.from('circuits').select('*').in('circuit_id', circuitIds)
          : { data: [] };

        const circuitMap = new Map((dbCircuits || []).map((c) => [c.circuit_id, c]));

        return dbRaces.map((row) => {
          const circuit = circuitMap.get(row.circuit_id);
          return {
            season: String(row.season),
            round: String(row.round),
            url: row.url || '#',
            raceName: row.race_name,
            Circuit: {
              circuitId: row.circuit_id,
              url: '#',
              circuitName: circuit?.name || row.circuit_id,
              Location: {
                lat: circuit?.lat?.toString() || '0',
                long: circuit?.long?.toString() || '0',
                locality: row.locality || circuit?.locality || '',
                country: row.country || circuit?.country || '',
              },
            },
            date: row.date,
            time: row.time || undefined,
            isSprintWeekend: Boolean(row.is_sprint_weekend),
          } as Race;
        });
      }
    }

    // Fall back to Jolpica
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}.json`);
    const races = response.MRData.RaceTable?.Races || [];
    return races.map((r) => validateOrWarn(RaceSchema, r, `race-${r.season}-${r.round}`) as Race);
  },

  getDriverStandings: async (season: string): Promise<DriverStanding[]> => {
    // Try Supabase first
    const supabase = await getSupabaseClient();
    const { data: dbData, error } = await supabase
      .from('season_driver_standings')
      .select('*')
      .eq('season', parseInt(season, 10))
      .order('position', { ascending: true });

    if (!error && dbData && dbData.length > 0) {
      return dbData.map((row) => ({
        position: String(row.position),
        positionText: String(row.position),
        points: String(row.points),
        wins: String(row.wins),
        Driver: {
          driverId: row.driver_id,
          permanentNumber: row.permanent_number || '',
          code: row.code || '',
          url: '#',
          givenName: row.given_name,
          familyName: row.family_name,
          dateOfBirth: row.date_of_birth || '',
          nationality: row.nationality || '',
        },
        Constructors: [{
          constructorId: row.constructor_id,
          url: '#',
          name: row.constructor_name,
          nationality: '',
        }],
      }));
    }

    // Fall back to Jolpica
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/driverStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings || [];
  },

  getConstructorStandings: async (season: string): Promise<ConstructorStanding[]> => {
    // Try Supabase first
    const supabase = await getSupabaseClient();
    const { data: dbData, error } = await supabase
      .from('season_constructor_standings')
      .select('*')
      .eq('season', parseInt(season, 10))
      .order('position', { ascending: true });

    if (!error && dbData && dbData.length > 0) {
      return dbData.map((row) => ({
        position: String(row.position),
        positionText: String(row.position),
        points: String(row.points),
        wins: String(row.wins),
        Constructor: {
          constructorId: row.constructor_id,
          url: '#',
          name: row.constructor_name,
          nationality: '',
        },
      }));
    }

    // Fall back to Jolpica
    const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructorStandings.json`);
    return response.MRData.StandingsTable?.StandingsLists[0]?.ConstructorStandings || [];
  },

  getRaceResults: async (season: string, round: string): Promise<Race | null> => {
    return getCompleteRaceEndpoint(season, round, 'results', 'Results');
  },

  getQualifyingResults: async (season: string, round: string): Promise<Race | null> => {
    return getCompleteRaceEndpoint(season, round, 'qualifying', 'QualifyingResults');
  },

  getSprintResults: async (season: string, round: string): Promise<Race | null> => {
    return getCompleteRaceEndpoint(season, round, 'sprint', 'SprintResults');
  },

};

let allSeasonIdsPromise: Promise<string[]> | null = null;
const driverStandingBySeasonAndIdCache = new Map<string, Promise<DriverStanding | null>>();
const constructorStandingsBySeasonCache = new Map<string, Promise<ConstructorStanding[]>>();
const driverCareerStandingsCache = new Map<string, Promise<DriverCareerStandingList[]>>();
const constructorCareerStandingsCache = new Map<string, Promise<ConstructorCareerStandingList[]>>();
const driverCareerRaceResultsCache = new Map<string, Promise<Race[]>>();
const constructorCareerRaceResultsCache = new Map<string, Promise<Race[]>>();
const driverSeasonRaceResultsCache = new Map<string, Promise<Race[]>>();
const constructorSeasonRaceResultsCache = new Map<string, Promise<Race[]>>();
const seasonSprintResultsCache = new Map<string, Promise<Race[]>>();
const STANDINGS_BATCH_SIZE = 6;
const DRIVER_HISTORY_BATCH_SIZE = 2;
const RESULTS_PAGE_LIMIT = 100;
const RATE_LIMIT_RETRY_DELAYS_MS = [250, 600, 1200, 2400];
const BETWEEN_BATCH_DELAY_MS = 180;

function getCachedSeasonRaceResults(
  cache: Map<string, Promise<Race[]>>,
  cacheKey: string,
  loader: () => Promise<Race[]>,
): Promise<Race[]> {
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = loader().catch((error) => {
    cache.delete(cacheKey);
    throw error;
  });
  cache.set(cacheKey, request);
  return request;
}

async function getAllSeasonIds(): Promise<string[]> {
  if (!allSeasonIdsPromise) {
    allSeasonIdsPromise = seasonApi.getAllSeasons(100)
      .then((seasons) => seasons.map((season) => season.season))
      .catch((error) => {
        allSeasonIdsPromise = null;
        throw error;
      });
  }

  return allSeasonIdsPromise;
}

function getCachedConstructorStandingsBySeason(season: string): Promise<ConstructorStanding[]> {
  if (!constructorStandingsBySeasonCache.has(season)) {
    const request = getStandingsWithRetry(() => seasonApi.getConstructorStandings(season)).catch((error) => {
      constructorStandingsBySeasonCache.delete(season);
      throw error;
    });
    constructorStandingsBySeasonCache.set(season, request);
  }

  return constructorStandingsBySeasonCache.get(season)!;
}

function getCachedDriverStandingBySeasonAndId(
  season: string,
  driverId: string,
): Promise<DriverStanding | null> {
  const cacheKey = `${season}|${driverId}`;
  if (!driverStandingBySeasonAndIdCache.has(cacheKey)) {
    const request = getStandingsWithRetry(async () => {
      const response = await ergastApi.get<never, ErgastResponse<never>>(
        `/${season}/drivers/${driverId}/driverStandings.json`,
      );
      return response.MRData.StandingsTable?.StandingsLists[0]?.DriverStandings?.[0] || null;
    }).catch((error) => {
      driverStandingBySeasonAndIdCache.delete(cacheKey);
      throw error;
    });
    driverStandingBySeasonAndIdCache.set(cacheKey, request);
  }

  return driverStandingBySeasonAndIdCache.get(cacheKey)!;
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
  batchSize = STANDINGS_BATCH_SIZE,
): Promise<T[]> {
  const results: T[] = [];

  for (let start = 0; start < seasons.length; start += batchSize) {
    const batch = seasons.slice(start, start + batchSize);
    const batchResults = await Promise.allSettled(batch.map((season) => mapper(season)));

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    });

    if (start + batchSize < seasons.length) {
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
    const request = loadDriverCareerStandings(params).catch((error) => {
      driverCareerStandingsCache.delete(cacheKey);
      throw error;
    });
    driverCareerStandingsCache.set(cacheKey, request);
  }

  return driverCareerStandingsCache.get(cacheKey)!;
}

async function loadDriverCareerStandings(
  params: { driverId: string; givenName?: string; familyName?: string },
): Promise<DriverCareerStandingList[]> {
  const candidates = getDriverIdCandidates(params.driverId, params);
  let resolvedDriverId = params.driverId;
  let careerRaces: Race[] = [];

  for (const candidate of candidates) {
    try {
      const races = await getDriverCareerRaceResults(candidate);
      if (races.length > 0) {
        resolvedDriverId = candidate;
        careerRaces = races;
        break;
      }
    } catch {
      // A full-name database id may not be a Jolpica id; keep checking aliases.
    }
  }

  const seasonIds = getRaceSeasonIds(careerRaces);
  if (seasonIds.length === 0) {
    return [];
  }

  const resolvedParams = { ...params, driverId: resolvedDriverId };
  const matches = await mapSeasonsInBatches(seasonIds, async (season) => {
    const directStanding = await getCachedDriverStandingBySeasonAndId(season, resolvedDriverId);
    const matchedStanding = directStanding
      ? findDriverStandingMatch([directStanding], resolvedParams)
      : null;

    if (!matchedStanding) {
      return null;
    }

      return {
        season,
        round: '',
        DriverStandings: [matchedStanding],
        ConstructorStandings: [],
    };
  }, DRIVER_HISTORY_BATCH_SIZE);

  return sortSeasonsDescending(matches);
}

async function getConstructorCareerStandings(
  constructorId: string,
): Promise<ConstructorCareerStandingList[]> {
  const cacheKey = normalizeIdentifierToken(constructorId);

  if (!constructorCareerStandingsCache.has(cacheKey)) {
    const request = loadConstructorCareerStandings(constructorId).catch((error) => {
      constructorCareerStandingsCache.delete(cacheKey);
      throw error;
    });
    constructorCareerStandingsCache.set(cacheKey, request);
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
    const supabase = await getSupabaseClient();
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
    const supabase = await getSupabaseClient();
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
    const cacheKey = `${season}:${driverId}`;
    return getCachedSeasonRaceResults(driverSeasonRaceResultsCache, cacheKey, async () => {
      const response: ErgastResponse<never> = await ergastApi.get(`/${season}/drivers/${driverId}/results.json?limit=100`);
      return response.MRData.RaceTable?.Races || [];
    });
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
    const supabase = await getSupabaseClient();
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
    const cacheKey = `${season}:${constructorId}`;
    return getCachedSeasonRaceResults(constructorSeasonRaceResultsCache, cacheKey, async () => {
      const response: ErgastResponse<never> = await ergastApi.get(`/${season}/constructors/${constructorId}/results.json?limit=100`);
      return response.MRData.RaceTable?.Races || [];
    });
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

export function getRaceSeasonIds(races: Race[]): string[] {
  return [...new Set(races.map((race) => String(race.season)).filter(Boolean))]
    .sort((left, right) => parseInt(right, 10) - parseInt(left, 10));
}

export function summarizeDriverRaceResults(races: Race[]): {
  raceCount: number;
  winCount: number;
  podiumCount: number;
  totalPoints: number;
} {
  return races.reduce((summary, race) => {
    const result = race.Results?.[0];
    if (!result) {
      return summary;
    }

    const position = getResultPositionValue(result.position);
    summary.raceCount += 1;
    summary.winCount += position === 1 ? 1 : 0;
    summary.podiumCount += position <= 3 ? 1 : 0;
    summary.totalPoints += toNumericValue(result.points);
    return summary;
  }, {
    raceCount: 0,
    winCount: 0,
    podiumCount: 0,
    totalPoints: 0,
  });
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
    const request = loadPaginatedRaceResults(`/drivers/${driverId}/results.json`).catch((error) => {
      driverCareerRaceResultsCache.delete(cacheKey);
      throw error;
    });
    driverCareerRaceResultsCache.set(cacheKey, request);
  }

  return driverCareerRaceResultsCache.get(cacheKey)!;
}

async function getConstructorCareerRaceResults(constructorId: string): Promise<Race[]> {
  const cacheKey = normalizeIdentifierToken(constructorId);

  if (!constructorCareerRaceResultsCache.has(cacheKey)) {
    const request = loadPaginatedRaceResults(`/constructors/${constructorId}/results.json`).catch((error) => {
      constructorCareerRaceResultsCache.delete(cacheKey);
      throw error;
    });
    constructorCareerRaceResultsCache.set(cacheKey, request);
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

function mapSupabaseDriverHistoryProfile(driver: SupabaseDriverDetailRow): Omit<DriverHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons' | 'recentConstructorName' | 'recentConstructorId'> {
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

function mapSupabaseConstructorHistoryProfile(constructor: SupabaseConstructorDetailRow): Omit<ConstructorHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons'> {
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

function buildDriverFallbackProfileFromRaces(
  driverId: string,
  races: Race[],
): Omit<DriverHistoryProfile, 'careerSummary' | 'bestRaceFinish' | 'seasons' | 'recentConstructorName' | 'recentConstructorId'> | null {
  const driver = races.find((race) => race.Results?.[0]?.Driver)?.Results?.[0]?.Driver;
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
  const supabaseApi = await getSupabaseApi();
  const summary = await supabaseApi.driverHistorySummaries.getById(driverId);
  return mapDriverHistorySummary(summary);
}

async function getConstructorHistorySummaryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  const supabaseApi = await getSupabaseApi();
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

    const supabaseApi = await getSupabaseApi();
    const exactSupabaseDriver = await supabaseApi.drivers.getById(driverId);
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
    const careerRaces = await getDriverCareerRaceResults(resolvedDriverId).catch(() => []);

    let baseProfile = exactSupabaseDriver
      ? mapSupabaseDriverHistoryProfile(exactSupabaseDriver)
      : null;

    if (!baseProfile && resolvedDriverId !== driverId) {
      const resolvedSupabaseDriver = await supabaseApi.drivers.getById(resolvedDriverId);
      if (resolvedSupabaseDriver) {
        baseProfile = mapSupabaseDriverHistoryProfile(resolvedSupabaseDriver);
      }
    }

    if (!baseProfile && standingsLists.length > 0) {
      try {
        const allDrivers = await supabaseApi.drivers.getAll();
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
      } catch {
        // Supabase is optional here; the Jolpica standings/results below contain the same identity.
      }
    }

    baseProfile = baseProfile
      || buildDriverFallbackProfile(driverId, standingsLists)
      || buildDriverFallbackProfileFromRaces(resolvedDriverId, careerRaces);

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
      Promise.resolve(extractBestFinishSummary(careerRaces)),
    ]);

    const fallbackPodiumCount = exactSupabaseDriver?.total_podiums || 0;
    const fallbackRaceCount = exactSupabaseDriver?.total_race_starts || 0;
    const fallbackPoleCount = exactSupabaseDriver?.total_pole_positions || 0;
    const resultSummary = summarizeDriverRaceResults(careerRaces);

    return {
      ...baseProfile,
      recentConstructorName: latestSeason?.constructorName || '',
      recentConstructorId: latestSeason?.constructorId || '',
      careerSummary: buildCareerSummary({
        raceCount: raceCountResult.status === 'fulfilled' && raceCountResult.value > 0
          ? raceCountResult.value
          : (resultSummary.raceCount || fallbackRaceCount),
        poleCount: poleCountResult.status === 'fulfilled' ? poleCountResult.value : fallbackPoleCount,
        podiumCount: podiumCountResult.status === 'fulfilled' && podiumCountResult.value > 0
          ? podiumCountResult.value
          : (resultSummary.podiumCount || fallbackPodiumCount),
        seasons,
        winCount: winCountResult.status === 'fulfilled' && winCountResult.value > 0
          ? winCountResult.value
          : resultSummary.winCount,
        championshipCount: championshipCountResult.status === 'fulfilled' ? championshipCountResult.value : undefined,
        totalPoints: totalPointsResult.status === 'fulfilled' && totalPointsResult.value > 0
          ? totalPointsResult.value
          : resultSummary.totalPoints,
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

    const supabaseApi = await getSupabaseApi();
    const constructorInfo = await supabaseApi.constructors.getById(constructorId);
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
