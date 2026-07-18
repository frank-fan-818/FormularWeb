import { supabase } from '@/utils/supabase';
import { measureRequest } from '@/utils/performance';
import { logger } from '@/utils/logger';
import type {
  ConstructorHistorySummaryRecord,
  DriverHistorySummaryRecord,
  SupabaseCircuitDetailRow,
  SupabaseCircuitListRow,
  SupabaseConstructorDetailRow,
  SupabaseConstructorListRow,
  SupabaseDriverDetailRow,
  SupabaseDriverListRow,
} from '@/types';
import type { ZodType } from 'zod';
import {
  ConstructorHistorySummaryRecordSchema,
  DriverHistorySummaryRecordSchema,
  SupabaseCircuitDetailRowSchema,
  SupabaseCircuitListRowSchema,
  SupabaseConstructorDetailRowSchema,
  SupabaseConstructorListRowSchema,
  SupabaseDriverDetailRowSchema,
  SupabaseDriverListRowSchema,
  SupabaseRowSchema,
} from './supabaseSchemas';

type RowPatch = Record<string, string | number | boolean | null>;

export class SupabaseDataValidationError extends Error {
  constructor(table: string, paths: string[]) {
    super(`Supabase ${table} 数据结构无效${paths.length ? `: ${paths.join(', ')}` : ''}`);
    this.name = 'SupabaseDataValidationError';
  }
}

function parseRows<T extends object>(table: string, schema: ZodType<T>, data: unknown): T[] {
  const parsed = schema.array().safeParse(data ?? []);
  if (parsed.success) return parsed.data;

  const paths = parsed.error.issues
    .slice(0, 5)
    .map((issue) => issue.path.join('.') || 'row');
  logger.warn({
    event: 'exit',
    module: 'supabase',
    function: `${table}.validate`,
    status: 'failed',
    error: `Supabase ${table} 返回字段不符合约定: ${paths.join(', ')}`,
  });
  throw new SupabaseDataValidationError(table, paths);
}

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

async function listRows<T extends object>(table: string, schema: ZodType<T>, options?: {
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

  return parseRows(table, schema, data);
}

async function getSingleRow<T extends object>(
  table: string,
  key: string,
  value: string | number,
  schema: ZodType<T>,
  columns = '*',
): Promise<T | null> {
  const query = supabase
    .from(table)
    .select(columns)
    .eq(key, value);

  const { data, error } = await measureRequest('supabase', `${table}.getById`, async () => query);

  if (error) {
    logger.warn({
      event: 'exit',
      module: 'supabase',
      function: `${table}.getById`,
      status: 'failed',
      error: `加载 ${table} 行数据失败`,
    });
    return null;
  }

  if (!data || data.length === 0) return null;
  return parseRows(table, schema, data)[0] || null;
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

  return SupabaseRowSchema.parse(data);
}

export const supabaseApi = {
  circuits: {
    getAll: async (limit = 400): Promise<SupabaseCircuitDetailRow[]> => listRows('circuits', SupabaseCircuitDetailRowSchema, { orderBy: 'name', limit }),
    getListMetadata: async (limit = 400): Promise<SupabaseCircuitListRow[]> => listRows('circuits', SupabaseCircuitListRowSchema, {
      columns: SUPABASE_COLUMNS.circuitListMetadata,
      orderBy: 'name',
      limit,
    }),
    getById: async (circuitId: string): Promise<SupabaseCircuitDetailRow | null> =>
      getSingleRow('circuits', 'circuit_id', circuitId, SupabaseCircuitDetailRowSchema, SUPABASE_COLUMNS.circuitDetail),
    update: async (circuitId: string, patch: RowPatch) => updateRow('circuits', 'circuit_id', circuitId, patch),
  },

  drivers: {
    getAll: async (limit = 1000): Promise<SupabaseDriverDetailRow[]> => listRows('drivers', SupabaseDriverDetailRowSchema, { orderBy: 'last_name', limit }),
    getListMetadata: async (limit = 1000): Promise<SupabaseDriverListRow[]> => listRows('drivers', SupabaseDriverListRowSchema, {
      columns: SUPABASE_COLUMNS.driverListMetadata,
      orderBy: 'last_name',
      limit,
    }),
    getById: async (driverId: string): Promise<SupabaseDriverDetailRow | null> =>
      getSingleRow('drivers', 'driver_id', driverId, SupabaseDriverDetailRowSchema, SUPABASE_COLUMNS.driverDetail),
    update: async (driverId: string, patch: RowPatch) => updateRow('drivers', 'driver_id', driverId, patch),
  },

  constructors: {
    getAll: async (limit = 300): Promise<SupabaseConstructorDetailRow[]> => listRows('constructors', SupabaseConstructorDetailRowSchema, { orderBy: 'name', limit }),
    getListMetadata: async (limit = 300): Promise<SupabaseConstructorListRow[]> => listRows('constructors', SupabaseConstructorListRowSchema, {
      columns: SUPABASE_COLUMNS.constructorListMetadata,
      orderBy: 'name',
      limit,
    }),
    getById: async (constructorId: string): Promise<SupabaseConstructorDetailRow | null> =>
      getSingleRow('constructors', 'constructor_id', constructorId, SupabaseConstructorDetailRowSchema, SUPABASE_COLUMNS.constructorDetail),
    update: async (constructorId: string, patch: RowPatch) => updateRow('constructors', 'constructor_id', constructorId, patch),
  },

  driverHistorySummaries: {
    getById: async (driverId: string): Promise<DriverHistorySummaryRecord | null> =>
      getSingleRow('driver_history_summary', 'driver_id', driverId, DriverHistorySummaryRecordSchema),
  },

  constructorHistorySummaries: {
    getById: async (constructorId: string): Promise<ConstructorHistorySummaryRecord | null> =>
      getSingleRow('constructor_history_summary', 'constructor_id', constructorId, ConstructorHistorySummaryRecordSchema),
  },

  seasons: {
    getAll: async (limit = 200) => listRows('seasons', SupabaseRowSchema, { orderBy: 'year', ascending: false, limit }),
    getByYear: async (year: number) => getSingleRow('seasons', 'year', year, SupabaseRowSchema),
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

      return parseRows('races', SupabaseRowSchema, data);
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

      return parseRows('races', SupabaseRowSchema, data);
    },
    getById: async (id: number) => getSingleRow('races', 'id', id, SupabaseRowSchema),
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

      return parseRows('race_results', SupabaseRowSchema, data);
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

      return parseRows('race_results', SupabaseRowSchema, data);
    },
    getById: async (id: number) => getSingleRow('race_results', 'id', id, SupabaseRowSchema),
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

      return parseRows('qualifying_results', SupabaseRowSchema, data);
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

      return parseRows('qualifying_results', SupabaseRowSchema, data);
    },
    getById: async (id: number) => getSingleRow('qualifying_results', 'id', id, SupabaseRowSchema),
    update: async (id: number, patch: RowPatch) => updateRow('qualifying_results', 'id', id, patch),
  },
};

export default supabaseApi;
