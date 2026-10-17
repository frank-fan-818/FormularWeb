import { describe, expect, it } from 'vitest';
import { WINNER_PREDICTION_FEATURES } from './raceWinnerPrediction';
import { formatDetailedProbability, getPredictionFactorLabel, getPredictionFactors, sortPredictionCandidates } from './racePredictionDetails';

describe('prediction details', () => {
  it('translates every published model feature and safely labels unknown features', () => {
    for (const feature of WINNER_PREDICTION_FEATURES) {
      const label = getPredictionFactorLabel(feature);
      expect(label, feature).not.toBe('其他模型指标');
      expect(label, feature).not.toMatch(/[a-zA-Z]/);
    }
    expect(getPredictionFactorLabel('futureFeature')).toBe('其他模型指标');
    expect(getPredictionFactorLabel('driverRecentPodiumRate')).toBe('车手近期领奖台率');
  });

  it('keeps positive and negative score influences and ignores neutral ones', () => {
    const factors = [
      { feature: 'gridTop3', contribution: 0.1 },
      { feature: 'driverRecentReliability', contribution: -0.3 },
      { feature: 'weatherRainRisk', contribution: 0 },
    ];
    expect(getPredictionFactors(factors)).toEqual([
      { label: '车手近期完赛可靠性', direction: 'negative' },
      { label: '前三位发车', direction: 'positive' },
    ]);
    expect(factors[0].feature).toBe('gridTop3');
    expect(getPredictionFactors([])).toEqual([]);
  });

  it('preserves small nonzero probabilities and avoids false zero or certainty', () => {
    expect(formatDetailedProbability(0)).toBe('0%');
    expect(formatDetailedProbability(0.00004)).toBe('<0.1%');
    expect(formatDetailedProbability(0.0045)).toBe('0.5%');
    expect(formatDetailedProbability(0.48)).toBe('48%');
    expect(formatDetailedProbability(0.9999)).toBe('>99.9%');
    expect(formatDetailedProbability(1)).toBe('100%');
  });

  it('sorts the entire published roster without mutating it or rescaling probabilities', () => {
    const candidates = Array.from({ length: 22 }, (_, i) => ({
      driverId: `driver_${i}`, constructorId: 'team', rank: 22 - i,
      probability: i / 1000, factors: [],
    }));
    const sorted = sortPredictionCandidates(candidates);
    expect(sorted).toHaveLength(22);
    expect(sorted[0].driverId).toBe('driver_21');
    expect(sorted[21].probability).toBe(0);
    expect(candidates[0].driverId).toBe('driver_0');
  });
});
