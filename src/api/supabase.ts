import { supabase } from '@/utils/supabase';

type RowPatch = Record<string, string | number | boolean | null>;

async function listRows(table: string, options?: {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}) {
  let query = supabase
    .from(table)
    .select('*');

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? true });
  }

  if (typeof options?.limit === 'number') {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data || [];
}

async function getSingleRow(table: string, key: string, value: string | number) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(key, value);

  if (error) {
    console.warn(`Failed to load ${table} row:`, error);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

async function updateRow(table: string, key: string, value: string | number, patch: RowPatch) {
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq(key, value)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const supabaseApi = {
  circuits: {
    getAll: async (limit = 400) => listRows('circuits', { orderBy: 'name', limit }),
    getById: async (circuitId: string) => getSingleRow('circuits', 'circuit_id', circuitId),
    update: async (circuitId: string, patch: RowPatch) => updateRow('circuits', 'circuit_id', circuitId, patch),
  },

  drivers: {
    getAll: async (limit = 1000) => listRows('drivers', { orderBy: 'last_name', limit }),
    getById: async (driverId: string) => getSingleRow('drivers', 'driver_id', driverId),
    update: async (driverId: string, patch: RowPatch) => updateRow('drivers', 'driver_id', driverId, patch),
  },

  constructors: {
    getAll: async (limit = 300) => listRows('constructors', { orderBy: 'name', limit }),
    getById: async (constructorId: string) => getSingleRow('constructors', 'constructor_id', constructorId),
    update: async (constructorId: string, patch: RowPatch) => updateRow('constructors', 'constructor_id', constructorId, patch),
  },

  driverHistorySummaries: {
    getById: async (driverId: string) => getSingleRow('driver_history_summary', 'driver_id', driverId),
  },

  constructorHistorySummaries: {
    getById: async (constructorId: string) => getSingleRow('constructor_history_summary', 'constructor_id', constructorId),
  },

  seasons: {
    getAll: async (limit = 200) => listRows('seasons', { orderBy: 'year', ascending: false, limit }),
    getByYear: async (year: number) => getSingleRow('seasons', 'year', year),
    update: async (year: number, patch: RowPatch) => updateRow('seasons', 'year', year, patch),
  },

  races: {
    getBySeason: async (season: number) => {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .eq('season', season)
        .order('round');

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const { data, error } = await supabase
        .from('races')
        .select('*')
        .order('season', { ascending: false })
        .order('round')
        .limit(limit);

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
      const { data, error } = await supabase
        .from('race_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const { data, error } = await supabase
        .from('race_results')
        .select('*')
        .order('race_id', { ascending: false })
        .order('position')
        .limit(limit);

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
      const { data, error } = await supabase
        .from('qualifying_results')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (error) {
        throw error;
      }

      return data || [];
    },
    getAll: async (limit = 300) => {
      const { data, error } = await supabase
        .from('qualifying_results')
        .select('*')
        .order('race_id', { ascending: false })
        .order('position')
        .limit(limit);

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
