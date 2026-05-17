import { describe, expect, it } from 'vitest';
import {
  predictNonlinearWinnerRace,
  scoreNonlinearWinnerCandidate,
  trainNonlinearWinnerPredictionModel,
  trainResidualWinnerPredictionModel,
} from './raceWinnerNonlinearPrediction.ts';
import type { WinnerPredictionCandidate } from './raceWinnerPrediction.ts';

describe('raceWinnerNonlinearPrediction', () => {
  it('normalizes probabilities for a race', () => {
    const candidates: WinnerPredictionCandidate[] = [
      {
        raceKey: '2025:1',
        driverId: 'driver-a',
        constructorId: 'team-a',
        winner: true,
        features: { gridAdvantage: 1, driverChaosForm: 0.8 },
      },
      {
        raceKey: '2025:1',
        driverId: 'driver-b',
        constructorId: 'team-b',
        winner: false,
        features: { gridAdvantage: 0.3, driverChaosForm: 0.2 },
      },
    ];
    const model = trainNonlinearWinnerPredictionModel([candidates], {
      featureNames: ['gridAdvantage', 'driverChaosForm'],
      hiddenSize: 4,
      iterations: 4,
    });
    const prediction = predictNonlinearWinnerRace(candidates, model);
    const total = prediction.reduce((sum, result) => sum + result.probability, 0);

    expect(total).toBeCloseTo(1);
    expect(prediction).toHaveLength(2);
  });

  it('learns a residual direction for correction samples', () => {
    const high: WinnerPredictionCandidate = {
      raceKey: '2025:2',
      driverId: 'driver-high',
      constructorId: 'team-a',
      winner: true,
      features: { driverChaosForm: 0.9, gridAdvantage: 0.7 },
    };
    const low: WinnerPredictionCandidate = {
      raceKey: '2025:2',
      driverId: 'driver-low',
      constructorId: 'team-b',
      winner: false,
      features: { driverChaosForm: 0.1, gridAdvantage: 0.7 },
    };
    const model = trainResidualWinnerPredictionModel([
      { candidate: high, target: 0.4 },
      { candidate: low, target: -0.4 },
      { candidate: high, target: 0.4 },
      { candidate: low, target: -0.4 },
    ], {
      featureNames: ['driverChaosForm', 'gridAdvantage'],
      hiddenSize: 4,
      iterations: 80,
      learningRate: 0.08,
      l2: 0.001,
    });

    expect(scoreNonlinearWinnerCandidate(high, model)).toBeGreaterThan(scoreNonlinearWinnerCandidate(low, model));
  });
});
