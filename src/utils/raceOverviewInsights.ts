import type { FastF1RaceAnalytics, QualifyingResult, Result } from '@/types';

export interface PositionMovement {
  result: Result;
  places: number;
}

export interface FastestLapInsight {
  result: Result;
  time: string;
  lap: string;
}

export interface RaceOverviewInsights {
  podium: Result[];
  winner: Result | null;
  pole: QualifyingResult | null;
  fastestLap: FastestLapInsight | null;
  biggestGain: PositionMovement | null;
  biggestLoss: PositionMovement | null;
  retirements: Result[];
  totalLaps: number | null;
  interruptionCount: number;
}

function toPositiveInteger(value: string | number | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLapTimeMs(value: string): number | null {
  const parts = value.trim().split(':');
  if (!parts.length || parts.length > 2) return null;

  const seconds = Number(parts[parts.length - 1]);
  const minutes = parts.length === 2 ? Number(parts[0]) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes)) return null;

  return (minutes * 60 + seconds) * 1000;
}

function isClassifiedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === 'finished'
    || normalized === 'lapped'
    || /^\+\d+\s+laps?$/.test(normalized)
    || /^\d+\s+laps?$/.test(normalized);
}

function getMovement(results: Result[], direction: 'gain' | 'loss'): PositionMovement | null {
  return results.reduce<PositionMovement | null>((best, result) => {
    const grid = toPositiveInteger(result.grid);
    const position = toPositiveInteger(result.position);
    if (grid === null || position === null) return best;

    const places = direction === 'gain' ? grid - position : position - grid;
    if (places <= 0 || (best && best.places >= places)) return best;
    return { result, places };
  }, null);
}

function getFastestLap(results: Result[]): FastestLapInsight | null {
  return results.reduce<FastestLapInsight | null>((best, result) => {
    const time = result.FastestLap?.Time?.time;
    if (!time) return best;

    const timeMs = parseLapTimeMs(time);
    if (timeMs === null) return best;
    const bestTimeMs = best ? parseLapTimeMs(best.time) : null;

    if (bestTimeMs !== null && bestTimeMs <= timeMs) return best;
    return {
      result,
      time,
      lap: result.FastestLap?.lap || '-',
    };
  }, null);
}

export function buildRaceOverviewInsights(
  raceResults: Result[],
  qualifyingResults: QualifyingResult[],
  analytics: FastF1RaceAnalytics | null,
): RaceOverviewInsights {
  const orderedResults = [...raceResults].sort((left, right) => (
    (toPositiveInteger(left.position) ?? Number.MAX_SAFE_INTEGER)
      - (toPositiveInteger(right.position) ?? Number.MAX_SAFE_INTEGER)
  ));

  const pole = qualifyingResults.find((result) => toPositiveInteger(result.position) === 1) || null;
  const winner = orderedResults.find((result) => toPositiveInteger(result.position) === 1) || null;
  const totalLaps = analytics?.totalLaps
    ?? toPositiveInteger(winner?.laps)
    ?? null;

  return {
    podium: orderedResults.filter((result) => {
      const position = toPositiveInteger(result.position);
      return position !== null && position <= 3;
    }),
    winner,
    pole,
    fastestLap: getFastestLap(raceResults),
    biggestGain: getMovement(raceResults, 'gain'),
    biggestLoss: getMovement(raceResults, 'loss'),
    retirements: raceResults.filter((result) => !isClassifiedStatus(result.status)),
    totalLaps,
    interruptionCount: analytics?.trackStatusPeriods?.length || 0,
  };
}
