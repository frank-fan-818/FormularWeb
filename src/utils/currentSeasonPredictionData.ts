import type {
  PredictionQualifyingResultData,
  PredictionRaceResultData,
  PredictionSeasonSnapshot,
} from '@/types/predictionData';

interface JolpicaDriverRef {
  driverId: string;
}

interface JolpicaConstructorRef {
  constructorId: string;
}

interface JolpicaResult {
  position: string;
  points?: string;
  grid?: string;
  laps?: string;
  status?: string;
  Driver: JolpicaDriverRef;
  Constructor: JolpicaConstructorRef;
}

interface JolpicaQualifyingResult {
  position: string;
  Driver: JolpicaDriverRef;
  Constructor: JolpicaConstructorRef;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

interface JolpicaRaceBase {
  season: string;
  round: string;
}

interface JolpicaScheduleRace extends JolpicaRaceBase {
  raceName: string;
  Circuit: {
    circuitId: string;
  };
}

interface JolpicaResultRace extends JolpicaRaceBase {
  Results?: JolpicaResult[];
}

interface JolpicaQualifyingRace extends JolpicaRaceBase {
  QualifyingResults?: JolpicaQualifyingResult[];
}

interface JolpicaSprintRace extends JolpicaRaceBase {
  SprintResults?: JolpicaResult[];
}

interface JolpicaSprintQualifyingRace extends JolpicaRaceBase {
  SprintQualifyingResults?: JolpicaQualifyingResult[];
}

export interface PredictionSeasonApiData {
  schedule: JolpicaScheduleRace[];
  resultRaces: JolpicaResultRace[];
  qualifyingRaces: JolpicaQualifyingRace[];
  sprintRaces: JolpicaSprintRace[];
  sprintQualifyingRaces: JolpicaSprintQualifyingRace[];
}

function positiveInteger(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function normalizePredictionEntityId(value: string): string {
  return value.trim().replace(/_/g, '-');
}

function raceKey(race: JolpicaRaceBase): string {
  return `${positiveInteger(race.season)}-${positiveInteger(race.round)}`;
}

function mapRaceResult(result: JolpicaResult): PredictionRaceResultData {
  return {
    position: positiveInteger(result.position),
    driverId: normalizePredictionEntityId(result.Driver.driverId),
    constructorId: normalizePredictionEntityId(result.Constructor.constructorId),
    points: Number(result.points) || 0,
    gridPosition: Math.max(0, Number(result.grid) || 0),
    laps: Math.max(0, Number(result.laps) || 0),
    status: result.status || 'Unknown',
  };
}

function mapQualifyingResult(result: JolpicaQualifyingResult): PredictionQualifyingResultData {
  return {
    position: positiveInteger(result.position),
    driverId: normalizePredictionEntityId(result.Driver.driverId),
    constructorId: normalizePredictionEntityId(result.Constructor.constructorId),
    q1: result.Q1 || null,
    q2: result.Q2 || null,
    q3: result.Q3 || null,
  };
}

export function buildPredictionSeasonSnapshot(
  season: number,
  apiData: PredictionSeasonApiData,
): PredictionSeasonSnapshot {
  const resultByRace = new Map(apiData.resultRaces.map((race) => [raceKey(race), race.Results || []]));
  const qualifyingByRace = new Map(apiData.qualifyingRaces.map((race) => [raceKey(race), race.QualifyingResults || []]));
  const sprintByRace = new Map(apiData.sprintRaces.map((race) => [raceKey(race), race.SprintResults || []]));
  const sprintQualifyingByRace = new Map(
    apiData.sprintQualifyingRaces.map((race) => [raceKey(race), race.SprintQualifyingResults || []]),
  );

  const races = apiData.schedule
    .filter((race) => positiveInteger(race.season) === season)
    .map((race) => {
      const key = raceKey(race);
      const results = (resultByRace.get(key) || []).map(mapRaceResult);
      const qualifying = (qualifyingByRace.get(key) || []).map(mapQualifyingResult);
      const sprintResults = (sprintByRace.get(key) || []).map(mapRaceResult);
      const sprintQualifying = (sprintQualifyingByRace.get(key) || []).map(mapQualifyingResult);

      return {
        season,
        round: positiveInteger(race.round),
        raceName: race.raceName,
        circuitId: normalizePredictionEntityId(race.Circuit.circuitId),
        isSprintWeekend: sprintResults.length > 0 || sprintQualifying.length > 0,
        results,
        qualifying,
        sprintResults,
        sprintQualifying,
      };
    })
    .filter((race) => race.round > 0 && race.results.some((result) => result.position === 1))
    .sort((left, right) => left.round - right.round);

  return {
    schemaVersion: 1,
    season,
    races,
  };
}

export function mergePredictionRaceSources<T extends { season: number; round: number }>(
  baseRaces: T[],
  overlayRaces: T[],
): T[] {
  const byRace = new Map(baseRaces.map((race) => [`${race.season}-${race.round}`, race]));
  overlayRaces.forEach((race) => {
    byRace.set(`${race.season}-${race.round}`, race);
  });
  return [...byRace.values()].sort((left, right) =>
    left.season - right.season || left.round - right.round,
  );
}
