import { describe, expect, it } from 'vitest';
import { assessPredictionPromotion, selectPredictionRecipe } from './racePredictionSelection';
import type { PhasePredictionModel, PredictionBacktestRace } from '@/types/racePredictionModel';

const row = (season: number, loss: number) => ({ season, top1Hit: true, top3Hit: true, winnerInField: true,
  logLoss: loss, rawLogLoss: loss, brierScore: loss, rawBrierScore: loss } as PredictionBacktestRace);
const model = (rows: PredictionBacktestRace[], weighting = 'equal') => ({
  recipe: { featureSet: 'windows_circuit', weighting }, backtest: { races: rows },
} as PhasePredictionModel);
describe('earlier-season recipe selection', () => {
  it('selects only on the earlier validation years, regardless of 2026 scores', () => {
    const choices = [{ name: 'baseline', model: model([row(2025, 1), row(2026, 0.01)]) },
      { name: 'recent', model: model([row(2025, 0.8), row(2026, 20)], 'recent') }];
    expect(selectPredictionRecipe(choices, 2025).name).toBe('recent');
    choices[1].model.backtest.races[1] = row(2026, 0.01);
    expect(selectPredictionRecipe(choices, 2025).name).toBe('recent');
  });
  it('does not trade away top-1 accuracy for a lower log loss', () => {
    const bad = { ...row(2025, 0.1), top1Hit: false };
    expect(selectPredictionRecipe([{ name: 'baseline', model: model([row(2025, 1)]) }, { name: 'recent', model: model([bad], 'recent') }], 2025).name).toBe('baseline');
  });

  it('blocks a candidate that loses a known 2026 winner despite a better probability score', () => {
    const champion = model([row(2025, 1), row(2026, 1)]);
    const candidate = model([row(2025, 0.8), { ...row(2026, 0.8), top1Hit: false }]);
    expect(assessPredictionPromotion(champion, candidate).approved).toBe(false);
  });
});
