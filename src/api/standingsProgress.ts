import ergastApi, { seasonApi } from './ergast';
import type { ErgastResponse } from '@/types';
import type { PointsComparisonKind, PointsSnapshot, SeasonPointsProgress } from '@/types/pointsComparison';
import { assertCompleteList, assertContiguousRounds, assertUniqueValues } from '@/utils/dataCompleteness';

const snapshots = new Map<string, { expires: number; request: Promise<PointsSnapshot> }>();

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
  async getSeasonProgress(kind: PointsComparisonKind, season: string): Promise<SeasonPointsProgress> {
    const [latest, calendar] = await Promise.all([getSnapshot(kind, season), seasonApi.getSeasonRaces(season)]);
    const races = calendar.filter(race => Number(race.round) <= latest.round)
      .sort((a, b) => Number(a.round) - Number(b.round));
    assertContiguousRounds(races, race => Number(race.round), 'points comparison calendar');
    if (races.length !== latest.round) throw new Error('赛历不完整，暂时无法对齐分站');
    const rounds: SeasonPointsProgress['rounds'] = [];
    // Fetch complete standings once per round, reused when another opponent is selected.
    for (let offset = 0; offset < races.length; offset += 4) {
      const batch = await Promise.all(races.slice(offset, offset + 4).map(async race => {
        const round = Number(race.round);
        const snapshot = round === latest.round ? latest : await getSnapshot(kind, season, round).catch(() => null);
        return { round, name: race.raceName.replace(/\s+Grand Prix$/i, ''), snapshot };
      }));
      rounds.push(...batch);
    }
    return { latest, rounds };
  },
};
