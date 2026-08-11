import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const rowsByTable = new Map<string, unknown[]>();
  const failedTables = new Set<string>();
  const ranges: Array<{ table: string; from: number; to: number }> = [];

  return {
    rowsByTable,
    failedTables,
    ranges,
    client: {
      from(table: string) {
        const query = {
          select: () => query,
          order: () => query,
          range: async (from: number, to: number) => {
            ranges.push({ table, from, to });
            if (failedTables.has(table)) {
              return { data: null, error: new Error(`${table} unavailable`) };
            }
            return {
              data: (rowsByTable.get(table) || []).slice(from, to + 1),
              error: null,
            };
          },
        };
        return query;
      },
    },
  };
});

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock.client,
}));

vi.mock('@/utils/logger', () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : String(error),
  logger: { warn: vi.fn() },
}));

import { searchApi } from './search';

describe('searchApi', () => {
  beforeEach(() => {
    supabaseMock.rowsByTable.clear();
    supabaseMock.failedTables.clear();
    supabaseMock.ranges.length = 0;
  });

  it('paginates through the complete historical race index', async () => {
    const races = Array.from({ length: 1171 }, (_, index) => ({
      season: String(1950 + Math.floor(index / 24)),
      round: String((index % 24) + 1),
      race_name: `Race ${index + 1}`,
      circuit_id: `circuit-${index + 1}`,
    }));
    supabaseMock.rowsByTable.set('races', races);

    const sources = await searchApi.getSearchSources();

    expect(sources.races).toHaveLength(1171);
    expect(supabaseMock.ranges.filter(({ table }) => table === 'races')).toEqual([
      { table: 'races', from: 0, to: 499 },
      { table: 'races', from: 500, to: 999 },
      { table: 'races', from: 1000, to: 1499 },
    ]);
  });

  it('rejects an incomplete index instead of caching false negative results', async () => {
    supabaseMock.rowsByTable.set('drivers', [{
      driver_id: 'leclerc',
      first_name: 'Charles',
      last_name: 'Leclerc',
      code: 'LEC',
      nationality: 'Monegasque',
    }]);
    supabaseMock.failedTables.add('races');

    await expect(searchApi.getSearchSources()).rejects.toThrow('races unavailable');
  });

  it('rejects when every search source is unavailable', async () => {
    ['drivers', 'constructors', 'circuits', 'races'].forEach((table) => {
      supabaseMock.failedTables.add(table);
    });

    await expect(searchApi.getSearchSources()).rejects.toThrow('drivers unavailable');
  });
});
