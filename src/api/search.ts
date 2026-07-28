import { supabase } from '@/utils/supabase';
import type { SearchSources } from '@/utils/search';

async function listSearchRows<T>(params: {
  table: string;
  columns: string;
  orderBy: string;
  ascending?: boolean;
  limit: number;
}): Promise<T[]> {
  const { data, error } = await supabase
    .from(params.table)
    .select(params.columns)
    .order(params.orderBy, { ascending: params.ascending ?? true })
    .limit(params.limit);

  if (error) {
    throw error;
  }

  return (data || []) as T[];
}

export const searchApi = {
  async getSearchSources(): Promise<SearchSources> {
    const [drivers, constructors, circuits, races] = await Promise.all([
      listSearchRows<SearchSources['drivers'][number]>({
        table: 'drivers',
        columns: 'driver_id, first_name, last_name, code, nationality',
        orderBy: 'last_name',
        limit: 1000,
      }),
      listSearchRows<SearchSources['constructors'][number]>({
        table: 'constructors',
        columns: 'constructor_id, name, nationality',
        orderBy: 'name',
        limit: 300,
      }),
      listSearchRows<SearchSources['circuits'][number]>({
        table: 'circuits',
        columns: 'circuit_id, name, locality, country',
        orderBy: 'name',
        limit: 400,
      }),
      listSearchRows<SearchSources['races'][number]>({
        table: 'races',
        columns: 'season, round, race_name, circuit_id',
        orderBy: 'date',
        ascending: false,
        limit: 500,
      }),
    ]);

    return {
      drivers,
      constructors,
      circuits,
      races,
    };
  },
};
