import { describe, expect, it } from 'vitest';
import type { RaceWinnerPrediction } from '@/types/racePrediction';
import type { PredictionSeasonRaceData } from '@/types/predictionData';
import { evaluatePublishedForecast, latestScoredForecasts } from './racePredictionEvaluation';

const race: PredictionSeasonRaceData = { season: 2026, round: 1, raceName: 'GP', circuitId: 'test',
  raceStartAt: '2026-03-01T12:00:00Z', isSprintWeekend: false,
  results: [{ driverId: 'd0', constructorId: 'c', position: 1, points: 25, gridPosition: 1, laps: 50, status: 'Finished' }],
  qualifying: [], sprintResults: [], sprintQualifying: [] };
const forecast: RaceWinnerPrediction = { runId: 'run-1', season: 2026, round: 1, raceName: 'GP', phase: 'pre_weekend',
  modelVersion: 'model', generatedAt: '2026-02-28T12:00:00Z', dataCutoffAt: '2026-02-28T12:00:00Z',
  candidates: Array.from({ length: 16 }, (_, index) => ({ driverId: `d${index}`, constructorId: 'c', rank: index + 1,
    probability: index === 0 ? 0.4 : 0.6 / 15, factors: [] })) };

describe('actual publication evaluation', () => {
  it('scores saved probabilities without rerunning or changing the forecast', () => {
    const original = JSON.stringify(forecast);
    const scored = evaluatePublishedForecast(forecast, race);
    expect(scored).toMatchObject({ runId: 'run-1', modelVersion: 'model', winnerDriverId: 'd0', winnerProbability: 0.4, top1Hit: true, top3Hit: true });
    expect(scored?.logLoss).toBeCloseTo(-Math.log(0.4));
    expect(scored?.brierScore).toBeCloseTo(0.36 + 15 * 0.04 ** 2);
    expect(JSON.stringify(forecast)).toBe(original);
  });

  it('refuses late, partial, mismatched and invalid forecasts', () => {
    expect(evaluatePublishedForecast({ ...forecast, generatedAt: race.raceStartAt! }, race)).toBeNull();
    expect(evaluatePublishedForecast({ ...forecast, dataCutoffAt: '2026-03-02T00:00:00Z' }, race)).toBeNull();
    expect(evaluatePublishedForecast({ ...forecast, round: 2 }, race)).toBeNull();
    expect(evaluatePublishedForecast(forecast, { ...race, results: [] })).toBeNull();
    expect(evaluatePublishedForecast({ ...forecast, candidates: forecast.candidates.slice(0, 5) }, race)).toBeNull();
    expect(evaluatePublishedForecast({ ...forecast, candidates: forecast.candidates.map((row) => ({ ...row, probability: 0.5 })) }, race)).toBeNull();
    expect(evaluatePublishedForecast(forecast, { ...race, raceStartAt: undefined })).toBeNull();
  });

  it('keeps missing winners as misses and aggregates only the latest forecast per phase', () => {
    const missing = evaluatePublishedForecast(forecast, { ...race, results: [{ ...race.results[0], driverId: 'new' }] })!;
    expect(missing).toMatchObject({ winnerInField: false, top1Hit: false, top3Hit: false, winnerProbability: 0 });
    const newer = evaluatePublishedForecast({ ...forecast, runId: 'run-2', generatedAt: '2026-03-01T10:00:00Z' }, race)!;
    const otherPhase = evaluatePublishedForecast({ ...forecast, runId: 'run-3', phase: 'post_quali' }, race)!;
    expect(latestScoredForecasts([newer, missing, otherPhase]).map((row) => row.runId).sort()).toEqual(['run-2', 'run-3']);
  });
});
