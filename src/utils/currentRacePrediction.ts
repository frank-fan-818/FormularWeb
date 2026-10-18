import type { PredictionSeasonRaceData } from '@/types/predictionData';
import type { RacePredictionPhase } from '@/types/racePrediction';
import { buildPriorCircuitHistory, latestPreRaceObservation, summarizeRaceFormWindows } from './racePredictionHistory';
import type {
  ConstructorRecentForm,
  DriverRecentForm,
  WinnerFeatureInput,
} from '@/utils/winnerFeatureBuilder';

export interface ScheduledPredictionRace extends PredictionSeasonRaceData {
  raceStartAt: string;
}

export const MINIMUM_PREDICTION_FIELD_SIZE = 15;

export function hasCompletePredictionField(candidateCount: number): boolean {
  return Number.isInteger(candidateCount) && candidateCount >= MINIMUM_PREDICTION_FIELD_SIZE;
}

function hasWinner(race: PredictionSeasonRaceData): boolean {
  return race.results.some((result) => result.position === 1);
}

export function selectPredictionTarget(
  races: ScheduledPredictionRace[],
  now = Date.now(),
): ScheduledPredictionRace | null {
  return [...races]
    .filter((race) => !hasWinner(race) && Date.parse(race.raceStartAt) > now)
    .sort((left, right) => Date.parse(left.raceStartAt) - Date.parse(right.raceStartAt))[0] || null;
}

export function getPredictionPhase(race: PredictionSeasonRaceData): RacePredictionPhase {
  return race.qualifying.length > 1 ? 'post_quali' : 'pre_weekend';
}

function buildDriverForm(
  history: PredictionSeasonRaceData[],
  driverId: string,
): DriverRecentForm {
  const entries = history.flatMap((race) => {
    const result = race.results.find((item) => item.driverId === driverId);
    if (!result) return [];
    const qualifyingPosition = race.qualifying.find((item) => item.driverId === driverId)?.position || result.gridPosition || 20;
    return [{ result, qualifyingPosition, raceLaps: Math.max(1, ...race.results.map((row) => row.laps)) }];
  }).slice(-10);

  return {
    windows: summarizeRaceFormWindows(entries.map(({ result }) => ({ won: result.position === 1, podium: result.position <= 3,
      finish: result.position, reliability: /finished|\+\d+ laps?/i.test(result.status) ? 1 : 0 }))),
    last10Steps: entries.map(({ result, qualifyingPosition }) => ({
      finishAdvantage: Math.max(0, 1 - (result.position - 1) / 19),
      qualifyingAdvantage: Math.max(0, 1 - (qualifyingPosition - 1) / 19),
      podium: result.position <= 3 ? 1 : 0,
      win: result.position === 1 ? 1 : 0,
      reliability: /finished|\+\d+ laps?/i.test(result.status) ? 1 : 0,
    })),
    finishPositions: entries.map(({ result }) => result.position),
    qualifyingPositions: entries.map(({ qualifyingPosition }) => qualifyingPosition),
    winCount: entries.filter(({ result }) => result.position === 1).length,
    podiumCount: entries.filter(({ result }) => result.position <= 3).length,
    raceCount: entries.length,
    dnfCount: entries.filter(({ result }) => !/finished|\+\d+ laps?/i.test(result.status)).length,
    totalLapsCompleted: entries.reduce((sum, { result }) => sum + result.laps, 0),
    totalLapsPossible: entries.reduce((sum, { raceLaps }) => sum + raceLaps, 0),
  };
}

function buildConstructorForm(
  history: PredictionSeasonRaceData[],
  constructorId: string,
): ConstructorRecentForm {
  const entries = history.flatMap((race) => race.results
    .filter((result) => result.constructorId === constructorId)
    .map((result) => ({ result, qualifyingPosition: race.qualifying.find((item) => item.driverId === result.driverId)?.position || result.gridPosition || 20 })))
    .slice(-20);

  return {
    windows: summarizeRaceFormWindows(history.flatMap((race) => {
      const rows = race.results.filter((row) => row.constructorId === constructorId);
      return rows.length ? [{ won: rows.some((row) => row.position === 1), podium: rows.some((row) => row.position <= 3),
        finish: rows.reduce((sum, row) => sum + row.position, 0) / rows.length,
        reliability: rows.filter((row) => /finished|\+\d+ laps?/i.test(row.status)).length / rows.length }] : [];
    })),
    last10Steps: entries.slice(-10).map(({ result, qualifyingPosition }) => ({
      finishAdvantage: Math.max(0, 1 - (result.position - 1) / 19),
      qualifyingAdvantage: Math.max(0, 1 - (qualifyingPosition - 1) / 19),
      podium: result.position <= 3 ? 1 : 0,
      win: result.position === 1 ? 1 : 0,
      reliability: /finished|\+\d+ laps?/i.test(result.status) ? 1 : 0,
    })),
    finishPositions: entries.map(({ result }) => result.position),
    winCount: entries.filter(({ result }) => result.position === 1).length,
    podiumCount: entries.filter(({ result }) => result.position <= 3).length,
    raceCount: entries.length,
  };
}

function parseLapTime(value: string | null): number | null {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

export function buildCurrentRaceFeatureInputs(
  target: PredictionSeasonRaceData,
  completedRaces: PredictionSeasonRaceData[],
  phase: RacePredictionPhase = getPredictionPhase(target),
  options: { multiWindow?: boolean; circuitHistory?: boolean; asOf?: string } = {},
): WinnerFeatureInput[] {
  completedRaces = [...new Map(completedRaces.filter((race) => hasWinner(race) && (
    race.season < target.season || (race.season === target.season && race.round < target.round)
  )).map((race) => [`${race.season}-${race.round}`, race])).values()]
    .sort((a, b) => a.season - b.season || a.round - b.round);
  // Historical outcomes and sessions unavailable at this phase are never inputs.
  target = { ...target, results: [], qualifying: phase === 'post_quali' ? target.qualifying : [],
    sprintResults: phase === 'post_quali' ? target.sprintResults : [],
    sprintQualifying: phase === 'post_quali' ? target.sprintQualifying : [] };
  const seasonHistory = completedRaces.filter((race) => race.season === target.season);
  const latestCompleted = completedRaces[completedRaces.length - 1];
  const confirmed = latestPreRaceObservation(target, phase, options.asOf);
  const entrants = confirmed?.entries || (target.qualifying.length
    ? target.qualifying.map((item) => ({ driverId: item.driverId, constructorId: item.constructorId }))
    : (latestCompleted?.results || []).map((item) => ({ driverId: item.driverId, constructorId: item.constructorId })));
  const uniqueEntrants = [...new Map(entrants.map((entry) => [entry.driverId, entry])).values()];
  const fieldSize = Math.max(uniqueEntrants.length, 2);
  const constructors = [...new Set(uniqueEntrants.map((entry) => entry.constructorId))];
  const driverPoints = new Map<string, number>();
  const driverWins = new Map<string, number>();
  const constructorPoints = new Map<string, number>();
  const constructorWins = new Map<string, number>();

  seasonHistory.forEach((race) => {
    race.results.forEach((result) => {
      driverPoints.set(result.driverId, (driverPoints.get(result.driverId) || 0) + result.points);
      constructorPoints.set(result.constructorId, (constructorPoints.get(result.constructorId) || 0) + result.points);
      if (result.position === 1) {
        driverWins.set(result.driverId, (driverWins.get(result.driverId) || 0) + 1);
        constructorWins.set(result.constructorId, (constructorWins.get(result.constructorId) || 0) + 1);
      }
    });
  });
  const sortedDrivers = uniqueEntrants.map((entry) => entry.driverId).sort((a, b) => (driverPoints.get(b) || 0) - (driverPoints.get(a) || 0));
  const sortedConstructors = [...constructors].sort((a, b) => (constructorPoints.get(b) || 0) - (constructorPoints.get(a) || 0));
  const totalDriverPoints = [...driverPoints.values()].reduce((sum, points) => sum + points, 0);
  const totalConstructorPoints = [...constructorPoints.values()].reduce((sum, points) => sum + points, 0);
  const qualifyingTimes = target.qualifying.map((item) => parseLapTime(item.q3 || item.q2 || item.q1));
  const qualifyingPositions = target.qualifying.map((item) => item.position);
  const racesCompleted = seasonHistory.length;

  return uniqueEntrants.map((entry) => {
    const driverForm = buildDriverForm(completedRaces, entry.driverId);
    const constructorForm = buildConstructorForm(completedRaces, entry.constructorId);
    if (options.multiWindow === false) { delete driverForm.windows; delete constructorForm.windows; }
    const qualifying = target.qualifying.find((item) => item.driverId === entry.driverId);
    const teamMate = target.qualifying.find((item) => item.constructorId === entry.constructorId && item.driverId !== entry.driverId);
    const sprint = target.sprintResults.find((item) => item.driverId === entry.driverId);
    const sprintQualifying = target.sprintQualifying.find((item) => item.driverId === entry.driverId);
    return {
      season: target.season,
      round: target.round,
      circuitId: target.circuitId,
      driverId: entry.driverId,
      constructorId: entry.constructorId,
      qualifying: qualifying ? {
        position: qualifying.position,
        gridPosition: confirmed?.entries.find((row) => row.driverId === entry.driverId)?.gridPosition,
        totalDrivers: fieldSize,
        q1TimeSeconds: parseLapTime(qualifying.q1),
        q2TimeSeconds: parseLapTime(qualifying.q2),
        q3TimeSeconds: parseLapTime(qualifying.q3),
        allPositions: qualifyingPositions,
        allQ3TimesSeconds: qualifyingTimes,
        teamMatePosition: teamMate?.position,
        teamMateQ3TimeSeconds: parseLapTime(teamMate?.q3 || teamMate?.q2 || teamMate?.q1 || null),
      } : undefined,
      driverStanding: {
        position: Math.max(1, sortedDrivers.indexOf(entry.driverId) + 1),
        points: driverPoints.get(entry.driverId) || 0,
        wins: driverWins.get(entry.driverId) || 0,
        totalDrivers: fieldSize,
        racesCompleted,
        fieldPointsTotal: totalDriverPoints,
      },
      constructorStanding: {
        position: Math.max(1, sortedConstructors.indexOf(entry.constructorId) + 1),
        points: constructorPoints.get(entry.constructorId) || 0,
        wins: constructorWins.get(entry.constructorId) || 0,
        totalDrivers: Math.max(constructors.length, 2),
        racesCompleted,
        fieldPointsTotal: totalConstructorPoints,
      },
      driverRecentForm: driverForm,
      constructorRecentForm: constructorForm,
      circuitHistory: options.circuitHistory === false ? undefined : buildPriorCircuitHistory(completedRaces, target.circuitId, entry.driverId, entry.constructorId),
      sprint: {
        isSprintWeekend: target.isSprintWeekend,
        sprintPosition: sprint?.position,
        sprintQualifyingPosition: sprintQualifying?.position,
        totalSprintDrivers: target.sprintResults.length || target.sprintQualifying.length || undefined,
      },
    };
  });
}
