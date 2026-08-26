import type { ConstructorStanding, DriverStanding, Race } from '@/types';
import { getRacesByStatus } from '@/hooks/useRaceStatus';

export interface SeasonSummary {
  totalRounds: number;
  completedRounds: number;
  remainingRounds: number;
  latestCompletedRace: Race | null;
  driverLeader: DriverStanding | null;
  constructorLeader: ConstructorStanding | null;
  driverGap: number | null;
  constructorGap: number | null;
}

function numericGap(first: string | undefined, second: string | undefined): number | null {
  if (first === undefined || second === undefined) return null;
  const leader = Number(first);
  const runnerUp = Number(second);
  if (!Number.isFinite(leader) || !Number.isFinite(runnerUp)) return null;
  return Math.max(0, leader - runnerUp);
}

export function buildSeasonSummary(
  races: Race[],
  driverStandings: DriverStanding[],
  constructorStandings: ConstructorStanding[],
  now = new Date(),
): SeasonSummary {
  const { completedRaces } = getRacesByStatus(races, now);
  const sortedCompletedRaces = [...completedRaces]
    .sort((a, b) => Number(a.round) - Number(b.round));
  const latestCompletedRace = sortedCompletedRaces[sortedCompletedRaces.length - 1] ?? null;

  return {
    totalRounds: races.length,
    completedRounds: completedRaces.length,
    remainingRounds: Math.max(0, races.length - completedRaces.length),
    latestCompletedRace,
    driverLeader: driverStandings[0] ?? null,
    constructorLeader: constructorStandings[0] ?? null,
    driverGap: numericGap(driverStandings[0]?.points, driverStandings[1]?.points),
    constructorGap: numericGap(constructorStandings[0]?.points, constructorStandings[1]?.points),
  };
}
