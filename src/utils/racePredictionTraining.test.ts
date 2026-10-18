import { describe, expect, it } from 'vitest';
import type { PredictionSeasonRaceData } from '@/types/predictionData';
import { buildPhaseCandidates, trainRacePredictionArtifact, selectPhaseModel, predictionRaceWeights } from './racePredictionTraining';
import { buildCurrentRaceFeatureInputs } from './currentRacePrediction';
import { buildWinnerCandidates } from './winnerFeatureBuilder';

function race(season: number, round: number): PredictionSeasonRaceData {
  return {
    season, round, raceName: `Race ${round}`, circuitId: 'test', isSprintWeekend: false,
    raceStartAt: `${season}-03-${String(round + 1).padStart(2, '0')}T12:00:00Z`,
    results: Array.from({ length: 16 }, (_, index) => ({
      position: index + 1, driverId: `d${index}`, constructorId: `c${Math.floor(index / 2)}`,
      points: index === 0 ? 25 : 0, gridPosition: index + 1, laps: 50, status: 'Finished',
    })),
    qualifying: Array.from({ length: 16 }, (_, index) => ({
      position: index + 1, driverId: `d${index}`, constructorId: `c${Math.floor(index / 2)}`,
      q1: null, q2: null, q3: `1:${20 + index / 10}`,
    })), sprintResults: [], sprintQualifying: [],
  };
}
const races = [race(2025, 1), race(2025, 2), race(2026, 1), race(2026, 2)];

describe('production prediction training', () => {
  it('uses exactly the publication features without target outcomes', () => {
    const target = races[3];
    const training = buildPhaseCandidates(target, races, 'post_quali');
    const published = buildWinnerCandidates('2026-2', buildCurrentRaceFeatureInputs(target, races, 'post_quali'));
    expect(training.map((row) => row.features)).toEqual(published.map((row) => row.features));
    const changed = { ...target, results: [{ ...target.results[1], position: 1 }] };
    expect(buildPhaseCandidates(changed, races, 'post_quali').map((row) => row.features)).toEqual(training.map((row) => row.features));
  });

  it('fits separate phases on every completed 2026 round and only prior data in folds', () => {
    const artifact = trainRacePredictionArtifact([...races].reverse(), { minimumTrainingRaces: 1, iterations: 2, generatedAt: '2026-10-18T00:00:00Z' });
    for (const phase of ['pre_weekend', 'post_quali'] as const) {
      const model = artifact.phases[phase];
      expect(model.training.raceKeys).toContain('2026-1');
      expect(model.training.raceKeys).toContain('2026-2');
      expect(model.training.trainedThrough).toEqual({ season: 2026, round: 2 });
      for (const fold of model.backtest.races) expect(fold.trainingRaceKeys).not.toContain(fold.raceKey);
      expect(model.backtest.bySeason['2026'].raceCount).toBe(2);
    }
    expect(artifact.phases.pre_weekend.featureNames).not.toContain('gridPole');
    expect(artifact.phases.post_quali.featureNames).toContain('gridPole');
  });

  it('ignores unfinished, future-dated and duplicate races and fits the final available race', () => {
    const artifact = trainRacePredictionArtifact([...races, races[2], { ...race(2026, 3), results: [] }, race(2027, 1)], { minimumTrainingRaces: 1, iterations: 1, generatedAt: '2026-10-18T00:00:00Z' });
    expect(artifact.phases.post_quali.training.raceKeys).toEqual(['2025-1', '2025-2', '2026-1', '2026-2']);
  });

  it('refuses incompatible, stale or future-trained models at publication', () => {
    const artifact = trainRacePredictionArtifact(races, { minimumTrainingRaces: 1, iterations: 1, generatedAt: '2026-10-18T00:00:00Z' });
    const target = { ...race(2026, 3), results: [], raceStartAt: '2026-10-20T00:00:00Z' };
    expect(selectPhaseModel(artifact, target, races).phase).toBe('post_quali');
    expect(() => selectPhaseModel({ ...artifact, featureSchemaVersion: 1 }, target, races)).toThrow(/schema/i);
    expect(() => selectPhaseModel(artifact, races[2], races)).toThrow(/future|cutoff/i);
    expect(() => selectPhaseModel(artifact, { ...target, round: 4 }, [...races, race(2026, 3)])).toThrow(/stale|missing/i);
  });

  it('counts a winner missing from the preliminary roster as a coverage miss', () => {
    const changed = { ...races[2], results: races[2].results.map((row, index) => index === 0 ? { ...row, driverId: 'new-winner' } : row) };
    const artifact = trainRacePredictionArtifact([races[0], races[1], changed], { minimumTrainingRaces: 1, iterations: 1, generatedAt: '2026-10-18T00:00:00Z' });
    const fold = artifact.phases.pre_weekend.backtest.races.find((row) => row.raceKey === '2026-1');
    expect(fold?.winnerInField).toBe(false);
    expect(fold?.top1Hit).toBe(false);
    expect(artifact.phases.pre_weekend.backtest.metrics.raceCount).toBe(1);
  });

  it('calibrates folds using only earlier held-out races and retains all positive-weight history', () => {
    const artifact = trainRacePredictionArtifact(races, { minimumTrainingRaces: 1, iterations: 1, weighting: 'recent', calibration: true, generatedAt: '2026-10-18T00:00:00Z' });
    for (const model of Object.values(artifact.phases)) {
      for (const fold of model.backtest.races) {
        expect(fold.calibrationRaceKeys).not.toContain(fold.raceKey);
        expect(fold.calibrationRaceKeys.every((key) => model.backtest.races.findIndex((row) => row.raceKey === key) < model.backtest.races.indexOf(fold))).toBe(true);
      }
      expect(model.training.bySeason['2026']).toBe(2);
    }
    const groups = races.map((race) => buildPhaseCandidates(race, races, 'post_quali'));
    const recent = predictionRaceWeights(groups, 'recent');
    const season = predictionRaceWeights(groups, 'season');
    expect(recent.every((weight) => weight > 0)).toBe(true);
    expect(recent[0]).toBeLessThan(recent[recent.length - 1]);
    expect(season[0]).toBeLessThan(season[season.length - 1]);
  });
});
