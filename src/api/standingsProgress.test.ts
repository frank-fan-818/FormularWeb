import { beforeEach, describe, expect, it, vi } from 'vitest';
import { standingsProgressApi } from './standingsProgress';

const mocks = vi.hoisted(() => ({ get: vi.fn(), completed: vi.fn(), snapshots: vi.fn(), databaseCalendar: vi.fn() }));
vi.mock('./ergast', () => ({ default: { get: mocks.get }, seasonApi: { getSeasonRaces: mocks.databaseCalendar } }));

function response(season: string, round: number, points = '53.5') {
  return { MRData: { total: '1', StandingsTable: { StandingsLists: [{ season, round: String(round),
    DriverStandings: [{ Driver: { driverId: 'a' }, points }],
    ConstructorStandings: [{ Constructor: { constructorId: 'team_a' }, points }],
  }] } } };
}

describe('official points progress API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.get.mockImplementation(async (path: string) => {
      if (!path.includes('/results/1.json')) return mocks.snapshots(path);
      const season = path.split('/')[1];
      const races = await mocks.completed();
      return { MRData: { total: String(races.length), RaceTable: { season, Races: races.map((race: object) => ({
        season, Results: [{ position: '1' }], ...race,
      })) } } };
    });
    mocks.completed.mockResolvedValue([3, 1, 2, 4].map(round => ({ round: String(round), raceName: `Round ${round}`, Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
  });
  it('uses official points including fractional scores, sorts rounds and excludes future rounds', async () => {
    mocks.snapshots.mockImplementation(async (path: string) => response('2027', Number(/\/2027\/(\d+)\//.exec(path)?.[1] || 3)));
    const data = await standingsProgressApi.getSeasonProgress('driver', '2027');
    expect(data.latest.points.a).toBe(53.5);
    expect(data.rounds.map(item => item.round)).toEqual([1, 2, 3]);
    expect(data.rounds[2].snapshot?.points.a).toBe(53.5);
    expect(mocks.get.mock.calls.some(([path]) => path.includes('/4/'))).toBe(false);
  });
  it('never substitutes zero for a failed or incomplete standings snapshot', async () => {
    mocks.snapshots.mockImplementation(async (path: string) => {
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
    mocks.snapshots.mockResolvedValue(response('2029', 3));
    const data = await standingsProgressApi.getSeasonProgress('constructor', '2029');
    expect(data.rounds[0].snapshot).toBeNull();
    expect(data.latest.points.team_a).toBe(53.5);
  });
  it('reports empty current standings as unavailable rather than a tied 0–0', async () => {
    mocks.snapshots.mockResolvedValue({ MRData: { total: '0', StandingsTable: { StandingsLists: [] } } });
    await expect(standingsProgressApi.getSeasonProgress('driver', '2030')).rejects.toThrow();
  });
  it('shares snapshots across opponents, caps parallel requests and separates driver/team caches', async () => {
    mocks.completed.mockResolvedValue(Array.from({ length: 10 }, (_, i) => ({ round: String(i + 1), raceName: `Round ${i + 1}`, Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
    let active = 0;
    let peak = 0;
    mocks.snapshots.mockImplementation(async (path: string) => {
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
    expect(mocks.completed).toHaveBeenCalledTimes(1);
    await standingsProgressApi.getSeasonProgress('constructor', '2031');
    expect(mocks.get.mock.calls.length).toBeGreaterThan(count);
  });

  it('uses compact venue names even when official names contain sponsors and years', async () => {
    mocks.completed.mockResolvedValue([{ round: '1', raceName: 'Formula 1 Singapore Airlines Singapore Grand Prix 2026',
      Circuit: { circuitId: 'marina_bay', Location: { country: 'Singapore', locality: 'Singapore' } } }]);
    mocks.snapshots.mockResolvedValue(response('2032', 1));
    const data = await standingsProgressApi.getSeasonProgress('driver', '2032');
    expect(data.rounds[0].name).toBe('Singapore');
  });

  it('starts the next queued round without waiting for the slowest request and reports progress', async () => {
    mocks.completed.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ round: String(i + 1), raceName: `Round ${i + 1}`,
      Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
    let release!: () => void;
    const slowRound = new Promise<void>(resolve => { release = resolve; });
    mocks.snapshots.mockImplementation(async (path: string) => {
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
    mocks.snapshots.mockImplementation(async (path: string) => {
      const round = Number(/\/2034\/(\d+)\//.exec(path)?.[1] || 3);
      if (round === 2 && missing) throw new Error('unavailable');
      return response('2034', round);
    });
    const first = await standingsProgressApi.getSeasonProgress('driver', '2034');
    expect(first.rounds[1].snapshot).toBeNull();
    missing = false;
    const count = mocks.snapshots.mock.calls.length;
    const retried = await standingsProgressApi.getSeasonProgress('driver', '2034');
    expect(retried.rounds[1].snapshot?.round).toBe(2);
    expect(mocks.snapshots).toHaveBeenCalledTimes(count + 1);
  });

  it.each(['driver', 'constructor'] as const)('aligns %s snapshots with published results instead of a shifted database calendar', async kind => {
    const completed = Array.from({ length: 17 }, (_, i) => ({ round: String(i + 1), raceName: `Round ${i + 1}`,
      Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } }));
    completed[16] = { ...completed[16], raceName: 'Singapore Grand Prix',
      Circuit: { circuitId: 'marina_bay', Location: { country: 'Singapore', locality: 'Singapore' } } };
    mocks.completed.mockResolvedValue(completed);
    mocks.databaseCalendar.mockResolvedValue([...completed.slice(0, 16), { ...completed[16], raceName: 'United States Grand Prix',
      Circuit: { circuitId: 'americas', Location: { country: 'United States', locality: 'Austin' } } }]);
    mocks.snapshots.mockImplementation(async (path: string) => response('2035', Number(/\/2035\/(\d+)\//.exec(path)?.[1] || 17)));
    const data = await standingsProgressApi.getSeasonProgress(kind, '2035');
    expect(data.rounds[data.rounds.length - 1]).toMatchObject({ round: 17, name: 'Singapore' });
    expect(data.rounds.some(race => race.name.includes('United States'))).toBe(false);
    expect(mocks.databaseCalendar).not.toHaveBeenCalled();
  });

  it('stops at the last published race when standings already reference an unraced round', async () => {
    mocks.completed.mockResolvedValue([1, 2].map(round => ({ round: String(round), raceName: `Round ${round}`,
      Circuit: { circuitId: 'unknown', Location: { country: '', locality: '' } } })));
    mocks.snapshots.mockImplementation(async (path: string) => {
      const round = Number(/\/2036\/(\d+)\//.exec(path)?.[1] || 3);
      return response('2036', round, String(round * 25));
    });
    const data = await standingsProgressApi.getSeasonProgress('driver', '2036');
    expect(data.latest.round).toBe(2);
    expect(data.latest.points.a).toBe(50);
    expect(data.rounds.map(race => race.round)).toEqual([1, 2]);
  });

  it('does not substitute an unrelated calendar when published results are unavailable', async () => {
    mocks.completed.mockRejectedValue(new Error('results unavailable'));
    mocks.snapshots.mockResolvedValue(response('2037', 3));
    await expect(standingsProgressApi.getSeasonProgress('driver', '2037')).rejects.toThrow('results unavailable');
    expect(mocks.databaseCalendar).not.toHaveBeenCalled();
  });

  it.each([
    { season: '2038', Results: [] },
    { season: '1999', Results: [{ position: '1' }] },
  ])('rejects incomplete or wrong-season published results: $season', async invalid => {
    mocks.completed.mockResolvedValue([{ round: '1', raceName: 'Round 1', ...invalid }]);
    mocks.snapshots.mockResolvedValue(response('2038', 1));
    await expect(standingsProgressApi.getSeasonProgress('driver', '2038')).rejects.toThrow();
    expect(mocks.databaseCalendar).not.toHaveBeenCalled();
  });
});
