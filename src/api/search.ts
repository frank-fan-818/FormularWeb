import { supabase } from '@/utils/supabase';
import type { SearchSources } from '@/utils/search';

async function listSearchRows<T>(params: {
  table: string;
  columns: string;
  orderBy: string;
  ascending?: boolean;
  pageSize?: number;
}): Promise<T[]> {
  const pageSize = params.pageSize ?? 500;
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(params.table)
      .select(params.columns)
      .order(params.orderBy, { ascending: params.ascending ?? true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export const searchApi = {
  async getSearchSources(): Promise<SearchSources> {
    const [drivers, constructors, circuits, races] = await Promise.all([
      listSearchRows<SearchSources['drivers'][number]>({
        table: 'drivers',
        columns: 'driver_id, first_name, last_name, code, nationality',
        orderBy: 'last_name',
      }),
      listSearchRows<SearchSources['constructors'][number]>({
        table: 'constructors',
        columns: 'constructor_id, name, nationality',
        orderBy: 'name',
      }),
      listSearchRows<SearchSources['circuits'][number]>({
        table: 'circuits',
        columns: 'circuit_id, name, locality, country',
        orderBy: 'name',
      }),
      listSearchRows<SearchSources['races'][number]>({
        table: 'races',
        columns: 'season, round, race_name, circuit_id',
        orderBy: 'date',
        ascending: false,
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
