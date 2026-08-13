import { supabase } from '@/utils/supabase';
import type { SearchSources } from '@/utils/search';
import type { ErgastResponse } from '@/types';

const SEARCH_SOURCE_TIMEOUT_MS = 3_000;
const JOLPICA_SEARCH_TIMEOUT_MS = 8_000;
const FALLBACK_HEDGE_DELAY_MS = 500;

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
    const response = await fetch(`/f1-api/${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Jolpica search fallback failed with ${response.status}`);
    return response.json() as Promise<ErgastResponse<never>>;
  };
  const [driverResult, constructorResult, circuitResult, raceResult] = await Promise.allSettled([
    get('drivers.json?limit=2000'), get('constructors.json?limit=1000'),
    get('circuits.json?limit=1000'), get('races.json?limit=2000'),
  ]).finally(() => clearTimeout(timeoutId));
  if ([driverResult, constructorResult, circuitResult, raceResult].every((result) => result.status === 'rejected')) {
    throw driverResult.status === 'rejected' ? driverResult.reason : new Error('Jolpica search unavailable');
  }
  const driverResponse = driverResult.status === 'fulfilled' ? driverResult.value : null;
  const constructorResponse = constructorResult.status === 'fulfilled' ? constructorResult.value : null;
  const circuitResponse = circuitResult.status === 'fulfilled' ? circuitResult.value : null;
  const raceResponse = raceResult.status === 'fulfilled' ? raceResult.value : null;

  return {
    drivers: (driverResponse?.MRData.DriverTable?.Drivers || []).map((driver) => ({
      driver_id: driver.driverId,
      first_name: driver.givenName,
      last_name: driver.familyName,
      code: driver.code,
      nationality: driver.nationality,
    })),
    constructors: (constructorResponse?.MRData.ConstructorTable?.Constructors || []).map((constructor) => ({
      constructor_id: constructor.constructorId,
      name: constructor.name,
      nationality: constructor.nationality,
    })),
    circuits: (circuitResponse?.MRData.CircuitTable?.Circuits || []).map((circuit) => ({
      circuit_id: circuit.circuitId,
      name: circuit.circuitName,
      locality: circuit.Location.locality,
      country: circuit.Location.country,
    })),
    races: (raceResponse?.MRData.RaceTable?.Races || []).map((race) => ({
      season: race.season,
      round: race.round,
      race_name: race.raceName,
      circuit_id: race.Circuit.circuitId,
    })),
    cacheable: [driverResult, constructorResult, circuitResult, raceResult]
      .every((result) => result.status === 'fulfilled'),
  };
}

export const searchApi = {
  async getSearchSources(): Promise<SearchSources> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_SOURCE_TIMEOUT_MS);
    let fallbackStarted = false;
    let startFallback!: () => void;
    const jolpicaFallback = new Promise<{ data: SearchSources | null; error: unknown }>((resolve) => {
      startFallback = () => {
        if (fallbackStarted) return;
        fallbackStarted = true;
        void getJolpicaSearchSources().then(
          (data) => resolve({ data, error: null }),
          (error: unknown) => resolve({ data: null, error }),
        );
      };
    });
    const fallbackTimer = setTimeout(startFallback, FALLBACK_HEDGE_DELAY_MS);
    try {
      const sources = await getSupabaseSearchSources(controller.signal);
      clearTimeout(fallbackTimer);
      return sources;
    } catch (supabaseError) {
      try {
        startFallback();
        const fallback = await jolpicaFallback;
        if (fallback.data) return fallback.data;
        throw fallback.error;
      } catch {
        throw supabaseError;
      }
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimer);
    }
  },
};
