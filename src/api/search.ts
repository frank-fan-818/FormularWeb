import { supabase } from '@/utils/supabase';
import type { SearchSources } from '@/utils/search';
import type { ErgastResponse } from '@/types';

const SEARCH_SOURCE_TIMEOUT_MS = 3_000;
const JOLPICA_SEARCH_TIMEOUT_MS = 15_000;

async function listSearchRows<T>(params: {
  table: string;
  columns: string;
  orderBy: string;
  ascending?: boolean;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<T[]> {
  const pageSize = params.pageSize ?? 500;
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(params.table)
      .select(params.columns)
      .order(params.orderBy, { ascending: params.ascending ?? true })
      .abortSignal(params.signal ?? new AbortController().signal)
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function getSupabaseSearchSources(signal: AbortSignal): Promise<SearchSources> {
  const [drivers, constructors, circuits, races] = await Promise.all([
    listSearchRows<SearchSources['drivers'][number]>({
      table: 'drivers', columns: 'driver_id, first_name, last_name, code, nationality',
      orderBy: 'last_name', signal,
    }),
    listSearchRows<SearchSources['constructors'][number]>({
      table: 'constructors', columns: 'constructor_id, name, nationality', orderBy: 'name', signal,
    }),
    listSearchRows<SearchSources['circuits'][number]>({
      table: 'circuits', columns: 'circuit_id, name, locality, country', orderBy: 'name', signal,
    }),
    listSearchRows<SearchSources['races'][number]>({
      table: 'races', columns: 'season, round, race_name, circuit_id',
      orderBy: 'date', ascending: false, signal,
    }),
  ]);
  if (drivers.length + constructors.length + circuits.length + races.length === 0) {
    throw new Error('Supabase returned an empty search index');
  }
  return { drivers, constructors, circuits, races };
}

async function getJolpicaSearchSources(): Promise<SearchSources> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), JOLPICA_SEARCH_TIMEOUT_MS);
  const get = async (path: string) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(`/f1-api/${path}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Jolpica search fallback failed with ${response.status}`);
        return await response.json() as ErgastResponse<never>;
      } catch (error) {
        lastError = error;
        if (controller.signal.aborted) throw error;
      }
    }
    throw lastError;
  };
  const getComplete = async <T>(
    path: string,
    readRows: (response: ErgastResponse<never>) => T[],
  ): Promise<T[]> => {
    const first = await get(`${path}?limit=100&offset=0`);
    const firstRows = readRows(first);
    const total = Number(first.MRData.total);
    if (!Number.isFinite(total) || firstRows.length >= total || firstRows.length === 0) return firstRows;

    const pageSize = firstRows.length;
    const offsets = Array.from(
      { length: Math.ceil((total - pageSize) / pageSize) },
      (_, index) => pageSize * (index + 1),
    );
    const remaining = await Promise.allSettled(
      offsets.map((offset) => get(`${path}?limit=${pageSize}&offset=${offset}`).then(readRows)),
    );
    return [
      ...firstRows,
      ...remaining.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
    ];
  };
  const [driverResult, constructorResult, circuitResult, raceResult] = await Promise.allSettled([
    getComplete('drivers.json', (response) => response.MRData.DriverTable?.Drivers || []),
    getComplete('constructors.json', (response) => response.MRData.ConstructorTable?.Constructors || []),
    getComplete('circuits.json', (response) => response.MRData.CircuitTable?.Circuits || []),
    getComplete('races.json', (response) => response.MRData.RaceTable?.Races || []),
  ]).finally(() => clearTimeout(timeoutId));
  if ([driverResult, constructorResult, circuitResult, raceResult].every((result) => result.status === 'rejected')) {
    throw driverResult.status === 'rejected' ? driverResult.reason : new Error('Jolpica search unavailable');
  }
  const drivers = driverResult.status === 'fulfilled' ? driverResult.value : [];
  const constructors = constructorResult.status === 'fulfilled' ? constructorResult.value : [];
  const circuits = circuitResult.status === 'fulfilled' ? circuitResult.value : [];
  const races = raceResult.status === 'fulfilled' ? raceResult.value : [];

  return {
    drivers: drivers.map((driver) => ({
      driver_id: driver.driverId,
      first_name: driver.givenName,
      last_name: driver.familyName,
      code: driver.code,
      nationality: driver.nationality,
    })),
    constructors: constructors.map((constructor) => ({
      constructor_id: constructor.constructorId,
      name: constructor.name,
      nationality: constructor.nationality,
    })),
    circuits: circuits.map((circuit) => ({
      circuit_id: circuit.circuitId,
      name: circuit.circuitName,
      locality: circuit.Location.locality,
      country: circuit.Location.country,
    })),
    races: races.map((race) => ({
      season: race.season,
      round: race.round,
      race_name: race.raceName,
      circuit_id: race.Circuit.circuitId,
    })),
    cacheable: [driverResult, constructorResult, circuitResult, raceResult]
      .every((result) => result.status === 'fulfilled'),
  };
}

function mergeByKey<T>(primary: T[], fallback: T[], getKey: (item: T) => string): T[] {
  const merged = new Map(fallback.map((item) => [getKey(item), item]));
  primary.forEach((item) => merged.set(getKey(item), item));
  return [...merged.values()];
}

export function mergeSearchSources(
  supabaseSources: SearchSources | null,
  jolpicaSources: SearchSources | null,
): SearchSources {
  const database = supabaseSources || { drivers: [], constructors: [], circuits: [], races: [] };
  const upstream = jolpicaSources || { drivers: [], constructors: [], circuits: [], races: [] };
  return {
    drivers: mergeByKey(database.drivers, upstream.drivers, (driver) => driver.driver_id),
    constructors: mergeByKey(database.constructors, upstream.constructors, (constructor) => constructor.constructor_id),
    circuits: mergeByKey(database.circuits, upstream.circuits, (circuit) => circuit.circuit_id),
    races: mergeByKey(database.races, upstream.races, (race) => `${race.season}:${race.round}`),
    cacheable: Boolean(supabaseSources && jolpicaSources?.cacheable !== false),
  };
}

export const searchApi = {
  async getSearchSources(): Promise<SearchSources> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_SOURCE_TIMEOUT_MS);
    const [supabaseResult, jolpicaResult] = await Promise.allSettled([
      getSupabaseSearchSources(controller.signal),
      getJolpicaSearchSources(),
    ]).finally(() => {
      clearTimeout(timeoutId);
    });

    const supabaseSources = supabaseResult.status === 'fulfilled' ? supabaseResult.value : null;
    const jolpicaSources = jolpicaResult.status === 'fulfilled' ? jolpicaResult.value : null;
    if (!supabaseSources && !jolpicaSources) {
      throw supabaseResult.status === 'rejected'
        ? supabaseResult.reason
        : new Error('All search sources are unavailable');
    }

    return mergeSearchSources(supabaseSources, jolpicaSources);
  },
};
