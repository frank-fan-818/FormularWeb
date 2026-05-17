import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import type {
  ConstructorHistorySummaryRecord,
  DriverHistorySummaryRecord,
} from '@/types';

type RowPatch = Record<string, string | number | boolean | null>;
type SupabaseRow = Record<string, unknown>;

export const SUPABASE_COLUMNS = {
  circuitListMetadata: [
    'circuit_id',
    'length',
    'turns',
    'first_race',
    'total_races',
    'race_laps',
    'total_distance',
    'lap_record',
    'lap_record_driver',
    'lap_record_year',
  ].join(', '),
  constructorListMetadata: [
    'constructor_id',
    'nationality',
    'total_wins',
    'total_pole_positions',
    'total_fastest_laps',
    'total_race_entries',
  ].join(', '),
  driverListMetadata: [
    'driver_id',
    'total_wins',
    'total_pole_positions',
    'total_fastest_laps',
    'total_race_starts',
  ].join(', '),
  constructorDetail: [
    'constructor_id',
    'name',
    'nationality',
    'total_wins',
    'total_podiums',
    'total_pole_positions',
    'total_fastest_laps',
    'total_race_entries',
  ].join(', '),
  driverDetail: [
    'driver_id',
    'permanent_number',
    'code',
    'first_name',
    'last_name',
    'date_of_birth',
    'nationality',
    'total_wins',
    'total_podiums',
    'total_pole_positions',
    'total_fastest_laps',
    'total_race_starts',
  ].join(', '),
  circuitDetail: [
    'circuit_id',
    'name',
    'locality',
    'country',
    'lat',
    'long',
    'length',
    'turns',
    'first_race',
    'total_races',
    'race_laps',
    'total_distance',
    'lap_record',
    'lap_record_driver',
    'lap_record_year',
  ].join(', '),
};

async function listRows<T extends object = SupabaseRow>(table: string, options?: {
  columns?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}): Promise<T[]> {
  let query = supabase
    .from(table)
    .select(options?.columns || '*');

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }

  if (typeof options?.limit === 'number') {
    query = query.limit(options.limit);
  }

  const { data, error } = await measureRequest('supabase', `${table}.list`, async () => query);
  if (error) {
    throw error;
  }

  return (data || []) as unknown as T[];
}

async function getSingleRow<T extends object = SupabaseRow>(
  table: string,
  key: string,
  value: string | number,
  columns = '*',
): Promise<T | null> {
  const query = supabase
    .from(table)
    .select(columns)
    .eq(key, value);

  const { data, error } = await measureRequest('supabase', `${table}.getById`, async () => query);

  if (error) {
    console.warn(`Failed to load ${table} row:`, error);
    return null;
  }

  return data && data.length > 0 ? data[0] as unknown as T : null;
}

async function updateRow(table: string, key: string, value: string | number, patch: RowPatch) {
  const query = supabase
    .from(table)
    .update(patch)
    .eq(key, value)
    .select()
    .single();

  const { data, error } = await measureRequest('supabase', `${table}.update`, async () => query);

  if (error) {
    throw error;
  }

  return data;
}

export const supabaseApi = {
  circuits: {
    getAll: async <T extends object = SupabaseRow>(limit = 400) => listRows<T>('circuits', { orderBy: 'name', limit }),
    getListMetadata: async <T extends object = SupabaseRow>(limit = 400) => listRows<T>('circuits', {
      columns: SUPABASE_COLUMNS.circuitListMetadata,
      orderBy: 'name',
      limit,
    }),
    getById: async <T extends object = SupabaseRow>(circuitId: string) =>
      getSingleRow<T>('circuits', 'circuit_id', circuitId, SUPABASE_COLUMNS.circuitDetail),
    update: async (circuitId: string, patch: RowPatch) => updateRow('circuits', 'circuit_id', circuitId, patch),
  },

  drivers: {
    getAll: async <T extends object = SupabaseRow>(limit = 1000) => listRows<T>('drivers', { orderBy: 'last_name', limit }),
    getListMetadata: async <T extends object = SupabaseRow>(limit = 1000) => listRows<T>('drivers', {
      columns: SUPABASE_COLUMNS.driverListMetadata,
      orderBy: 'last_name',
      limit,
    }),
    getById: async <T extends object = SupabaseRow>(driverId: string) =>
      getSingleRow<T>('drivers', 'driver_id', driverId, SUPABASE_COLUMNS.driverDetail),
    update: async (driverId: string, patch: RowPatch) => updateRow('drivers', 'driver_id', driverId, patch),
  },

  constructors: {
    getAll: async <T extends object = SupabaseRow>(limit = 300) => listRows<T>('constructors', { orderBy: 'name', limit }),
    getListMetadata: async <T extends object = SupabaseRow>(limit = 300) => listRows<T>('constructors', {
      columns: SUPABASE_COLUMNS.constructorListMetadata,
      orderBy: 'name',
      limit,
    }),
    getById: async <T extends object = SupabaseRow>(constructorId: string) =>
      getSingleRow<T>('constructors', 'constructor_id', constructorId, SUPABASE_COLUMNS.constructorDetail),
    update: async (constructorId: string, patch: RowPatch) => updateRow('constructors', 'constructor_id', constructorId, patch),
  },

  driverHistorySummaries: {
    getById: async (driverId: string) => getSingleRow<DriverHistorySummaryRecord>('driver_history_summary', 'driver_id', driverId),
  },

  constructorHistorySummaries: {
    getById: async (constructorId: string) => getSingleRow<ConstructorHistorySummaryRecord>('constructor_history_summary', 'constructor_id', constructorId),
  },

  seasons: {
    getAll: async (limit = 200) => listRows('seasons', { orderBy: 'year', ascending: false, limit }),
    getByYear: async (year: number) => getSingleRow('seasons', 'year', year),
    update: async (year: number, patch: RowPatch) => updateRow('seasons', 'year', year, patch),
  },

  races: {
    getBySeason: async (season: number) => {
      const query = supabase
        .from('races')
        .select('*')
        .eq('season', season)
        .order('round');
      const { data, error } = await measureRequest('supabase', 'races.getBySeason', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const query = supabase
        .from('races')
        .select('*')
        .order('season', { ascending: false })
        .order('round')
        .limit(limit);
      const { data, error } = await measureRequest('supabase', 'races.list', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getById: async (id: number) => getSingleRow('races', 'id', id),
    update: async (id: number, patch: RowPatch) => updateRow('races', 'id', id, patch),
  },

  raceResults: {
    getByRace: async (raceId: number) => {
      const query = supabase
        .from('race_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');
      const { data, error } = await measureRequest('supabase', 'race_results.getByRace', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const query = supabase
        .from('race_results')
        .select('*')
        .order('race_id', { ascending: false })
        .order('position')
        .limit(limit);
      const { data, error } = await measureRequest('supabase', 'race_results.list', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getById: async (id: number) => getSingleRow('race_results', 'id', id),
    update: async (id: number, patch: RowPatch) => updateRow('race_results', 'id', id, patch),
  },

  qualifyingResults: {
    getByRace: async (raceId: number) => {
      const query = supabase
        .from('qualifying_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');
      const { data, error } = await measureRequest('supabase', 'qualifying_results.getByRace', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const query = supabase
        .from('qualifying_results')
        .select('*')
        .order('race_id', { ascending: false })
        .order('position')
        .limit(limit);
      const { data, error } = await measureRequest('supabase', 'qualifying_results.list', async () => query);

      if (error) {
        throw error;
      }

      return data || [];
    },
    getById: async (id: number) => getSingleRow('qualifying_results', 'id', id),
    update: async (id: number, patch: RowPatch) => updateRow('qualifying_results', 'id', id, patch),
  },
};

export default supabaseApi;
