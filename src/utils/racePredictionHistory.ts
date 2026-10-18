import type { PredictionPreRaceObservation, PredictionSeasonRaceData } from '@/types/predictionData';
import type { RacePredictionPhase } from '@/types/racePrediction';
import type { RaceFormWindows } from '@/types/racePredictionFeatures';
import type { CircuitHistoryInput } from './winnerFeatureBuilder';

interface FormStep { won: boolean; podium: boolean; finish: number; reliability: number }

export function summarizeRaceFormWindows(steps: FormStep[]): RaceFormWindows {
  const summarize = (size: number) => {
    const rows = steps.slice(-size);
    const average = (read: (row: FormStep) => number) => rows.length ? rows.reduce((sum, row) => sum + read(row), 0) / rows.length : 0;
    return { raceCount: rows.length, winRate: average((row) => Number(row.won)), podiumRate: average((row) => Number(row.podium)),
      averageFinish: rows.length ? average((row) => row.finish) : 20, reliabilityRate: average((row) => row.reliability) };
  };
  return { short: summarize(3), recent: summarize(5), long: summarize(10) };
}

export function buildPriorCircuitHistory(history: PredictionSeasonRaceData[], circuitId: string, driverId: string, constructorId: string): CircuitHistoryInput | undefined {
  const races = history.filter((race) => race.circuitId === circuitId);
  if (!races.length) return undefined;
  const driverRows = races.flatMap((race) => race.results.filter((row) => row.driverId === driverId));
  const constructorRaces = races.map((race) => race.results.filter((row) => row.constructorId === constructorId)).filter((rows) => rows.length);
  const winners = races.flatMap((race) => race.results.filter((row) => row.position === 1 && row.gridPosition > 0));
  const percent = (test: (row: typeof winners[number]) => boolean) => winners.length ? 100 * winners.filter(test).length / winners.length : null;
  return { driverTotalRaces: driverRows.length, driverWinCount: driverRows.filter((row) => row.position === 1).length,
    driverPodiumCount: driverRows.filter((row) => row.position <= 3).length,
    constructorTotalRaces: constructorRaces.length, constructorWinCount: constructorRaces.filter((rows) => rows.some((row) => row.position === 1)).length,
    poleWinConversionPct: percent((row) => row.gridPosition === 1), top3GridWinPct: percent((row) => row.gridPosition <= 3),
    overtakeUpsetRate: winners.length ? winners.filter((row) => row.gridPosition > 5).length / winners.length : null,
    scRate: null, vscRate: null, redFlagRate: null, totalSamples: races.length };
}

export function predictionPhaseCutoff(race: PredictionSeasonRaceData, phase: RacePredictionPhase): number {
  const start = Date.parse(race.raceStartAt || '');
  return start - (phase === 'pre_weekend' ? 72 * 60 * 60 * 1000 : 1);
}

export function latestPreRaceObservation(race: PredictionSeasonRaceData, phase: RacePredictionPhase, asOf?: string): PredictionPreRaceObservation | undefined {
  const start = Date.parse(race.raceStartAt || '');
  const cutoff = Math.min(asOf ? Date.parse(asOf) : predictionPhaseCutoff(race, phase), start - 1);
  return race.preRaceObservations?.filter((row) => {
    const time = Date.parse(row.observedAt);
    const entries = row.entries;
    const grids = entries.flatMap((entry) => entry.gridPosition && entry.gridPosition > 0 ? [entry.gridPosition] : []);
    return Number.isFinite(time) && time <= cutoff && entries.length >= 15 && row.source.trim().length > 0 &&
      new Set(entries.map((entry) => entry.driverId)).size === entries.length &&
      new Set(grids).size === grids.length && entries.every((entry) => entry.driverId && entry.constructorId &&
        (entry.gridPosition === undefined || (Number.isInteger(entry.gridPosition) && entry.gridPosition >= 0 && entry.gridPosition <= entries.length)));
  }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}
