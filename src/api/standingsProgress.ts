import ergastApi from './ergast';
import type { ErgastResponse } from '@/types';
import type { PointsComparisonKind, PointsLoadingProgress, PointsSnapshot, SeasonPointsProgress } from '@/types/pointsComparison';
import { assertCompleteList, assertContiguousRounds, assertUniqueValues } from '@/utils/dataCompleteness';
import { formatShortRaceName } from '@/utils/raceDisplayName';

const snapshots = new Map<string, { expires: number; request: Promise<PointsSnapshot> }>();
const seasons = new Map<string, { expires: number; data: SeasonPointsProgress }>();

async function getCompletedRaces(season: string) {
  // Calendar providers can assign different round numbers after schedule changes.
  // Published winners identify completed Grands Prix in the standings provider's own numbering.
  const response: ErgastResponse<never> = await ergastApi.get(`/${season}/results/1.json?limit=100`);
  const races = response.MRData.RaceTable?.Races || [];
  assertCompleteList(races.flatMap(race => race.Results || []), response.MRData.total, 'points comparison completed results');
  assertUniqueValues(races, race => race.round, 'points comparison completed results');
  if (!races.length || races.some(race => race.season !== season || !race.Results?.length
    || race.Results.some(result => result.position !== '1'))) throw new Error('暂无已完赛的积分数据');
  return races;
}

function getSnapshot(kind: PointsComparisonKind, season: string, round?: number): Promise<PointsSnapshot> {
  const endpoint = kind === 'driver' ? 'driverStandings' : 'constructorStandings';
  const path = `/${season}/${round ? `${round}/` : ''}${endpoint}.json?limit=100`;
  const cached = snapshots.get(path);
  if (cached && cached.expires > Date.now()) return cached.request;
  const request = (async () => {
    const response: ErgastResponse<never> = await ergastApi.get(path);
    const lists = response.MRData.StandingsTable?.StandingsLists;
    const list = lists?.[0];
    if (!list || list.season !== season || !Number.isInteger(Number(list.round)) || Number(list.round) < 1
      || (round !== undefined && Number(list.round) !== round)) throw new Error('暂无该站的完整积分榜');
    const entries = kind === 'driver'
      ? (list.DriverStandings || []).map(item => ({ id: item.Driver.driverId, points: Number(item.points) }))
      : (list.ConstructorStandings || []).map(item => ({ id: item.Constructor.constructorId, points: Number(item.points) }));
    assertCompleteList(entries, response.MRData.total, 'points comparison standings');
    assertUniqueValues(entries, item => item.id, 'points comparison standings');
    if (!entries.length || entries.some(item => !item.id || !Number.isFinite(item.points))) throw new Error('积分榜数据不完整');
    return { round: Number(list.round), points: Object.fromEntries(entries.map(item => [item.id, item.points])) };
  })().catch(error => {
    snapshots.delete(path);
    throw error;
  });
  snapshots.set(path, { expires: Date.now() + 5 * 60 * 1000, request });
  return request;
}

export const standingsProgressApi = {
  async getSeasonProgress(kind: PointsComparisonKind, season: string, onProgress?: (progress: PointsLoadingProgress) => void): Promise<SeasonPointsProgress> {
    const key = `${kind}:${season}`;
    const cached = seasons.get(key);
    if (cached && cached.expires > Date.now()) {
      onProgress?.({ completed: cached.data.rounds.length, total: cached.data.rounds.length });
      return cached.data;
    }
    const expires = Date.now() + 5 * 60 * 1000;
    const [reportedLatest, completedRaces] = await Promise.all([getSnapshot(kind, season), getCompletedRaces(season)]);
    const races = completedRaces.filter(race => Number(race.round) <= reportedLatest.round)
      .sort((a, b) => Number(a.round) - Number(b.round));
    assertContiguousRounds(races, race => Number(race.round), 'points comparison calendar');
    const lastRound = Number(races[races.length - 1]?.round);
    if (!lastRound) throw new Error('暂无已完赛的积分数据');
    const latest = lastRound === reportedLatest.round ? reportedLatest : await getSnapshot(kind, season, lastRound);
    const rounds: SeasonPointsProgress['rounds'] = races.map(race => ({
      round: Number(race.round), name: formatShortRaceName(race),
      snapshot: Number(race.round) === latest.round ? latest : null,
    }));
    const pending = rounds.filter(round => round.round !== latest.round);
    let cursor = 0;
    let completed = 1;
    onProgress?.({ completed, total: rounds.length });
    // Keep four requests active; one slow round must not hold up the next batch.
    await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
      while (cursor < pending.length) {
        const item = pending[cursor++];
        item.snapshot = await getSnapshot(kind, season, item.round).catch(() => null);
        onProgress?.({ completed: ++completed, total: rounds.length });
      }
    }));
    const data = { latest, rounds };
    // Incomplete snapshots must remain retryable instead of caching a partial season.
    if (rounds.every(round => round.snapshot)) seasons.set(key, { expires, data });
    return data;
  },
};
