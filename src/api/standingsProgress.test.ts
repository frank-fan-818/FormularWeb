import { beforeEach, describe, expect, it, vi } from 'vitest';
import { standingsProgressApi } from './standingsProgress';

const mocks = vi.hoisted(() => ({ get: vi.fn(), races: vi.fn() }));
vi.mock('./ergast', () => ({ default: { get: mocks.get }, seasonApi: { getSeasonRaces: mocks.races } }));

function response(season: string, round: number, points = '53.5') {
  return { MRData: { total: '1', StandingsTable: { StandingsLists: [{ season, round: String(round),
    DriverStandings: [{ Driver: { driverId: 'a' }, points }],
    ConstructorStandings: [{ Constructor: { constructorId: 'team_a' }, points }],
  }] } } };
}

describe('official points progress API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.races.mockResolvedValue([3, 1, 2, 4].map(round => ({ round: String(round), raceName: `Round ${round}`, Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
  });
  it('uses official points including fractional scores, sorts rounds and excludes future rounds', async () => {
    mocks.get.mockImplementation(async (path: string) => response('2027', Number(/\/2027\/(\d+)\//.exec(path)?.[1] || 3)));
    const data = await standingsProgressApi.getSeasonProgress('driver', '2027');
    expect(data.latest.points.a).toBe(53.5);
    expect(data.rounds.map(item => item.round)).toEqual([1, 2, 3]);
    expect(data.rounds[2].snapshot?.points.a).toBe(53.5);
    expect(mocks.get.mock.calls.some(([path]) => path.includes('/4/'))).toBe(false);
  });
  it('never substitutes zero for a failed or incomplete standings snapshot', async () => {
    mocks.get.mockImplementation(async (path: string) => {
      const round = Number(/\/2028\/(\d+)\//.exec(path)?.[1] || 3);
      if (round === 1) throw new Error('network');
      if (round === 2) return { ...response('2028', 2), MRData: { ...response('2028', 2).MRData, total: '2' } };
      return response('2028', 3);
    });
    const data = await standingsProgressApi.getSeasonProgress('driver', '2028');
    expect(data.rounds.map(item => item.snapshot?.round ?? null)).toEqual([null, null, 3]);
    expect(data.latest.points.a).toBe(53.5);
  });
  it('rejects stale round metadata instead of plotting it at the requested round', async () => {
    mocks.get.mockResolvedValue(response('2029', 3));
    const data = await standingsProgressApi.getSeasonProgress('constructor', '2029');
    expect(data.rounds[0].snapshot).toBeNull();
    expect(data.latest.points.team_a).toBe(53.5);
  });
  it('reports empty current standings as unavailable rather than a tied 0–0', async () => {
    mocks.get.mockResolvedValue({ MRData: { total: '0', StandingsTable: { StandingsLists: [] } } });
    await expect(standingsProgressApi.getSeasonProgress('driver', '2030')).rejects.toThrow();
  });
  it('shares snapshots across opponents, caps parallel requests and separates driver/team caches', async () => {
    mocks.races.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ round: String(i + 1), raceName: `Round ${i + 1}`, Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
    let active = 0;
    let peak = 0;
    mocks.get.mockImplementation(async (path: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active -= 1;
      return response('2031', Number(/\/2031\/(\d+)\//.exec(path)?.[1] || 10));
    });
    await standingsProgressApi.getSeasonProgress('driver', '2031');
    expect(peak).toBeLessThanOrEqual(4);
    const count = mocks.get.mock.calls.length;
    await standingsProgressApi.getSeasonProgress('driver', '2031');
    expect(mocks.get).toHaveBeenCalledTimes(count);
    expect(mocks.races).toHaveBeenCalledTimes(1);
    await standingsProgressApi.getSeasonProgress('constructor', '2031');
    expect(mocks.get.mock.calls.length).toBeGreaterThan(count);
  });

  it('uses compact venue names even when official names contain sponsors and years', async () => {
    mocks.races.mockResolvedValue([{ round: '1', raceName: 'Formula 1 Singapore Airlines Singapore Grand Prix 2026',
      Circuit: { circuitId: 'marina_bay', Location: { country: 'Singapore', locality: 'Singapore' } } }]);
    mocks.get.mockResolvedValue(response('2032', 1));
    const data = await standingsProgressApi.getSeasonProgress('driver', '2032');
    expect(data.rounds[0].name).toBe('Singapore');
  });

  it('starts the next queued round without waiting for the slowest request and reports progress', async () => {
    mocks.races.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ round: String(i + 1), raceName: `Round ${i + 1}`,
      Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
    let release!: () => void;
    const slowRound = new Promise<void>(resolve => { release = resolve; });
    mocks.get.mockImplementation(async (path: string) => {
      const round = Number(/\/2033\/(\d+)\//.exec(path)?.[1] || 6);
      if (round === 1) await slowRound;
      return response('2033', round);
    });
    const onProgress = vi.fn();
    const request = standingsProgressApi.getSeasonProgress('driver', '2033', onProgress);
    try {
      await vi.waitFor(() => expect(mocks.get.mock.calls.some(([path]) => path.includes('/5/'))).toBe(true));
      expect(onProgress).toHaveBeenCalledWith({ completed: 5, total: 6 });
    } finally { release(); }
    await request;
    expect(onProgress).toHaveBeenLastCalledWith({ completed: 6, total: 6 });
  });

  it('retries missing rounds without throwing away successful snapshots', async () => {
    let missing = true;
    mocks.get.mockImplementation(async (path: string) => {
      const round = Number(/\/2034\/(\d+)\//.exec(path)?.[1] || 3);
      if (round === 2 && missing) throw new Error('unavailable');
      return response('2034', round);
    });
    const first = await standingsProgressApi.getSeasonProgress('driver', '2034');
    expect(first.rounds[1].snapshot).toBeNull();
    missing = false;
    const count = mocks.get.mock.calls.length;
    const retried = await standingsProgressApi.getSeasonProgress('driver', '2034');
    expect(retried.rounds[1].snapshot?.round).toBe(2);
    expect(mocks.get).toHaveBeenCalledTimes(count + 1);
  });
});
