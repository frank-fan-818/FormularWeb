import { describe, expect, it } from 'vitest';
import { applyPredictionTemperature, fitPredictionTemperature } from './racePredictionCalibration';

describe('chronological probability calibration', () => {
  it('preserves ranking and total probability while softening confidence', () => {
    const probabilities = applyPredictionTemperature([0.8, 0.15, 0.05], 2);
    expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(probabilities[0]).toBeLessThan(0.8);
    expect(probabilities[0]).toBeGreaterThan(probabilities[1]);
    expect(applyPredictionTemperature([0.8, 0.2], 1)).toEqual([0.8, 0.2]);
    expect(() => applyPredictionTemperature([0.8, 0.2], 0)).toThrow();
  });
  it('fits earlier held-out forecasts and defaults to identity with too few samples', () => {
    const cases = Array.from({ length: 24 }, (_, index) => ({ probabilities: [0.95, 0.05], winnerIndex: index % 2 }));
    expect(fitPredictionTemperature(cases.slice(0, 3)).temperature).toBe(1);
    expect(fitPredictionTemperature(cases).temperature).toBeGreaterThan(1);
    expect(fitPredictionTemperature(cases).sampleCount).toBe(24);
  });
});
