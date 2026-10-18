import type { PredictionSeasonRaceData } from '@/types/predictionData';
import type { RacePredictionPhase, RaceWinnerPrediction } from '@/types/racePrediction';
import { hasCompletePredictionField } from './currentRacePrediction';

export interface PublishedPredictionScore {
  runId: string;
  season: number;
  round: number;
  phase: RacePredictionPhase;
  modelVersion: string;
  generatedAt: string;
  winnerDriverId: string;
  winnerInField: boolean;
  winnerRank: number | null;
  winnerProbability: number;
  top1Hit: boolean;
  top3Hit: boolean;
  logLoss: number;
  brierScore: number;
  candidateCount: number;
}

/** Score only the immutable probabilities that were actually saved before race start. */
export function evaluatePublishedForecast(forecast: RaceWinnerPrediction, race: PredictionSeasonRaceData): PublishedPredictionScore | null {
  const start = Date.parse(race.raceStartAt || '');
  const generated = Date.parse(forecast.generatedAt);
  const cutoff = Date.parse(forecast.dataCutoffAt);
  const winnerIds = race.results.filter((row) => row.position === 1).map((row) => row.driverId);
  if (forecast.season !== race.season || forecast.round !== race.round || winnerIds.length !== 1 ||
    !Number.isFinite(start) || !Number.isFinite(generated) || !Number.isFinite(cutoff) ||
    generated >= start || cutoff > generated || !hasCompletePredictionField(forecast.candidates.length)) return null;
  const candidates = forecast.candidates;
  if (new Set(candidates.map((row) => row.driverId)).size !== candidates.length ||
    new Set(candidates.map((row) => row.rank)).size !== candidates.length ||
    candidates.some((row) => !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 1 || !Number.isInteger(row.rank) || row.rank < 1) ||
    Math.abs(candidates.reduce((sum, row) => sum + row.probability, 0) - 1) > 0.001) return null;
  const sorted = [...candidates].sort((a, b) => b.probability - a.probability || a.rank - b.rank);
  const winnerIndex = sorted.findIndex((row) => row.driverId === winnerIds[0]);
  const winner = sorted[winnerIndex];
  return { runId: forecast.runId, season: race.season, round: race.round, phase: forecast.phase,
    modelVersion: forecast.modelVersion, generatedAt: forecast.generatedAt, winnerDriverId: winnerIds[0],
    winnerInField: Boolean(winner), winnerRank: winner ? winnerIndex + 1 : null,
    winnerProbability: winner?.probability || 0, top1Hit: winnerIndex === 0, top3Hit: winnerIndex >= 0 && winnerIndex < 3,
    logLoss: -Math.log(Math.max(winner?.probability || 0, 1e-12)),
    brierScore: candidates.reduce((sum, row) => sum + (row.probability - Number(row.driverId === winnerIds[0])) ** 2, winner ? 0 : 1),
    candidateCount: candidates.length };
}

/** Frequent refreshes must not give a single race more weight in aggregate accuracy. */
export function latestScoredForecasts(rows: PublishedPredictionScore[]): PublishedPredictionScore[] {
  const latest = new Map<string, PublishedPredictionScore>();
  for (const row of rows) {
    const key = `${row.season}-${row.round}-${row.phase}`;
    const previous = latest.get(key);
    if (!previous || Date.parse(row.generatedAt) > Date.parse(previous.generatedAt)) latest.set(key, row);
  }
  return [...latest.values()];
}
