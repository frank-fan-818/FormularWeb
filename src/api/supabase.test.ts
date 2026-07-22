import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResponse = {
  data: unknown[] | null;
  error: Error | null;
};

const supabaseMock = vi.hoisted(() => {
  const state = {
    response: { data: [], error: null } as QueryResponse,
    calls: [] as Array<{ table: string; columns: string }>,
  };

  function createQuery() {
    return {
      order: vi.fn(() => createQuery()),
      limit: vi.fn(() => createQuery()),
      eq: vi.fn(() => createQuery()),
      then: (
        onFulfilled?: (value: QueryResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(state.response).then(onFulfilled, onRejected),
    };
  }

  return {
    state,
    client: {
      from: vi.fn((table: string) => ({
        select: vi.fn((columns: string) => {
          state.calls.push({ table, columns });
          return createQuery();
        }),
      })),
    },
  };
});

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock.client,
}));

describe('supabaseApi metadata queries', () => {
  beforeEach(() => {
    supabaseMock.state.response = { data: [], error: null };
    supabaseMock.state.calls = [];
    vi.clearAllMocks();
  });

  it('requests precise driver list metadata columns', async () => {
    const { SUPABASE_COLUMNS, supabaseApi } = await import('./supabase');

    await supabaseApi.drivers.getListMetadata();

    expect(supabaseMock.state.calls).toContainEqual({
      table: 'drivers',
      columns: SUPABASE_COLUMNS.driverListMetadata,
    });
  });

  it('requests precise constructor and circuit metadata columns', async () => {
    const { SUPABASE_COLUMNS, supabaseApi } = await import('./supabase');

    await supabaseApi.constructors.getListMetadata();
    await supabaseApi.circuits.getListMetadata();

    expect(supabaseMock.state.calls).toContainEqual({
      table: 'constructors',
      columns: SUPABASE_COLUMNS.constructorListMetadata,
    });
    expect(supabaseMock.state.calls).toContainEqual({
      table: 'circuits',
      columns: SUPABASE_COLUMNS.circuitListMetadata,
    });
  });

  it('returns an empty array when metadata rows are missing', async () => {
    const { supabaseApi } = await import('./supabase');

    supabaseMock.state.response = { data: null, error: null };

    await expect(supabaseApi.drivers.getListMetadata()).resolves.toEqual([]);
  });

  it('throws Supabase metadata errors', async () => {
    const { supabaseApi } = await import('./supabase');
    const error = new Error('permission denied');

    supabaseMock.state.response = { data: null, error };

    await expect(supabaseApi.drivers.getListMetadata()).rejects.toThrow('permission denied');
  });

  it('returns metadata only after runtime schema validation', async () => {
    const { supabaseApi } = await import('./supabase');
    const row = {
      driver_id: 'max_verstappen',
      total_wins: 65,
      total_pole_positions: 45,
      total_fastest_laps: 35,
      total_race_starts: 220,
    };
    supabaseMock.state.response = { data: [row], error: null };

    await expect(supabaseApi.drivers.getListMetadata()).resolves.toEqual([row]);
  });

  it('rejects metadata with drifted field types at the API boundary', async () => {
    const { SupabaseDataValidationError, supabaseApi } = await import('./supabase');
    supabaseMock.state.response = {
      data: [{
        driver_id: 'max_verstappen',
        total_wins: '65',
        total_pole_positions: 45,
        total_fastest_laps: 35,
        total_race_starts: 220,
      }],
      error: null,
    };

    const request = supabaseApi.drivers.getListMetadata();
    await expect(request).rejects.toBeInstanceOf(SupabaseDataValidationError);
    await expect(request).rejects.toThrow('0.total_wins');
  });

  it('requests precise detail columns for detail pages', async () => {
    const { SUPABASE_COLUMNS, supabaseApi } = await import('./supabase');

    await supabaseApi.drivers.getById('max_verstappen');
    await supabaseApi.constructors.getById('red_bull');
    await supabaseApi.circuits.getById('americas');

    expect(supabaseMock.state.calls).toContainEqual({
      table: 'drivers',
      columns: SUPABASE_COLUMNS.driverDetail,
    });
    expect(supabaseMock.state.calls).toContainEqual({
      table: 'constructors',
      columns: SUPABASE_COLUMNS.constructorDetail,
    });
    expect(supabaseMock.state.calls).toContainEqual({
      table: 'circuits',
      columns: SUPABASE_COLUMNS.circuitDetail,
    });
  });
});
