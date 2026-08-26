import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFastF1AnalyticsCacheForTests,
  fastF1AnalyticsApi,
  hasMeaningfulFastF1Analytics,
} from '@/api/fastf1Analytics';
import type { FastF1RaceAnalytics } from '@/types';

const supabaseMock = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.abortSignal = vi.fn(() => query);
  query.maybeSingle = vi.fn();
  return { from: vi.fn(() => query), query };
});

vi.mock('@/utils/supabase', () => ({
  supabase: { from: supabaseMock.from },
}));

function createSnapshot(overrides: Partial<FastF1RaceAnalytics> = {}): FastF1RaceAnalytics {
  return {
    source: 'fastf1',
    generatedAt: '2026-08-25T00:00:00Z',
    season: '2026',
    round: '14',
    session: 'R',
    eventName: 'Dutch Grand Prix',
    sessionName: 'Race',
    sessionResults: [],
    lapTimeSeries: [],
    tyreStrategies: [],
    trackStatusPeriods: [],
    ...overrides,
  } as FastF1RaceAnalytics;
}

describe('FastF1 analytics source selection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-with-enough-characters');
    supabaseMock.from.mockClear();
    supabaseMock.query.maybeSingle.mockReset();
    clearFastF1AnalyticsCacheForTests();
  });

  it('treats an exported empty session as a placeholder so another source can be used', () => {
    expect(hasMeaningfulFastF1Analytics(createSnapshot())).toBe(false);
  });

  it('accepts a snapshot when any core race-analysis collection contains data', () => {
    expect(hasMeaningfulFastF1Analytics(createSnapshot({
      lapTimeSeries: [{ driver: 'NOR', team: 'McLaren', laps: [] }],
    }))).toBe(true);
  });

  it('falls through an empty static export to a populated database snapshot', async () => {
    const staticPlaceholder = createSnapshot();
    const databaseSnapshot = createSnapshot({
      lapTimeSeries: [{ driver: 'NOR', team: 'McLaren', laps: [] }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(staticPlaceholder), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })));
    supabaseMock.query.maybeSingle.mockResolvedValue({
      data: { payload: databaseSnapshot },
      error: null,
    });

    const result = await fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');

    expect(result).toEqual(databaseSnapshot);
    expect(supabaseMock.from).toHaveBeenCalledWith('fastf1_session_analytics');
  });

  it('reuses a populated snapshot without repeating the fetch', async () => {
    const snapshot = createSnapshot({
      lapTimeSeries: [{ driver: 'NOR', team: 'McLaren', laps: [] }],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');
    const second = await fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');

    expect(first).toEqual(snapshot);
    expect(second).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('joins concurrent requests for the same session', async () => {
    const snapshot = createSnapshot({
      lapTimeSeries: [{ driver: 'NOR', team: 'McLaren', laps: [] }],
    });
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);

    const firstRequest = fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');
    const secondRequest = fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');
    resolveFetch?.(new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const [first, second] = await Promise.all([firstRequest, secondRequest]);
    expect(first).toEqual(snapshot);
    expect(second).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a shared request alive when one caller aborts', async () => {
    const snapshot = createSnapshot({
      lapTimeSeries: [{ driver: 'NOR', team: 'McLaren', laps: [] }],
    });
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => (
      new Promise<Response>((resolve, reject) => {
        resolveFetch = resolve;
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Request aborted', 'AbortError'));
        }, { once: true });
      })
    ));
    vi.stubGlobal('fetch', fetchMock);

    const firstController = new AbortController();
    const firstRequest = fastF1AnalyticsApi.getRaceAnalytics(
      '2026', '14', 'R', firstController.signal,
    );
    const secondRequest = fastF1AnalyticsApi.getRaceAnalytics('2026', '14', 'R');
    const secondOutcome = secondRequest.catch((error: unknown) => error);

    firstController.abort();
    await expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' });
    resolveFetch?.(new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    expect(await secondOutcome).toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
