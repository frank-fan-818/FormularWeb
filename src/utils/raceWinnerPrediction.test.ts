import { describe, expect, it } from 'vitest';
import {
  buildPoleBaselineModel,
  evaluateWinnerPredictions,
  getWinnerPredictionEra,
  predictWinnerRace,
  trainWinnerPredictionModel,
  type WinnerPredictionCandidate,
} from './raceWinnerPrediction';

function candidate(
  raceKey: string,
  driverId: string,
  gridAdvantage: number,
  winner = false,
): WinnerPredictionCandidate {
  return {
    raceKey,
    driverId,
    constructorId: `${driverId}-team`,
    winner,
    features: {
      gridAdvantage,
      qualifyingAdvantage: gridAdvantage,
    },
  };
}

describe('race winner prediction utilities', () => {
  it('maps seasons to era-specific model buckets', () => {
    expect(getWinnerPredictionEra(1979)).toBe('classic');
    expect(getWinnerPredictionEra(1988)).toBe('turbo_na');
    expect(getWinnerPredictionEra(2007)).toBe('modern_refuel_end');
    expect(getWinnerPredictionEra(2021)).toBe('pirelli_hybrid');
    expect(getWinnerPredictionEra(2024)).toBe('ground_effect');
  });

  it('normalizes probabilities within a race', () => {
    const predictions = predictWinnerRace(
      [
        candidate('2024-1', 'max', 1, true),
        candidate('2024-1', 'charles', 0.8),
        candidate('2024-1', 'lando', 0.4),
      ],
      buildPoleBaselineModel(),
    );

    const totalProbability = predictions.reduce((sum, prediction) => sum + prediction.probability, 0);

    expect(totalProbability).toBeCloseTo(1, 8);
    expect(predictions[0].driverId).toBe('max');
    expect(predictions[0].rank).toBe(1);
  });

  it('learns a positive weight for repeated winner signals', () => {
    const trainingRaces = [
      [
        candidate('2024-1', 'a', 1, true),
        candidate('2024-1', 'b', 0.2),
      ],
      [
        candidate('2024-2', 'c', 0.9, true),
        candidate('2024-2', 'd', 0.1),
      ],
      [
        candidate('2024-3', 'e', 0.8, true),
        candidate('2024-3', 'f', 0.3),
      ],
    ];
    const model = trainWinnerPredictionModel(trainingRaces, {
      featureNames: ['gridAdvantage'],
      iterations: 120,
      learningRate: 0.2,
      l2: 0.001,
    });

    expect(model.weights.gridAdvantage).toBeGreaterThan(0);

    const metrics = evaluateWinnerPredictions(trainingRaces, model, ['gridAdvantage']);
    expect(metrics.top1Accuracy).toBe(1);
    expect(metrics.logLoss).toBeGreaterThan(0);
  });
});
