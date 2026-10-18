import type { RacePredictionPhase } from './racePrediction';
import type { WinnerPredictionFeatureName, WinnerPredictionWeights } from '@/utils/raceWinnerPrediction';
import type { PredictionFeatureSet, PredictionWeighting } from './racePredictionFeatures';

export interface PredictionBacktestRace {
  raceKey: string;
  season: number;
  round: number;
  trainingRaceKeys: string[];
  winnerInField: boolean;
  top1Hit: boolean;
  top3Hit: boolean;
  winnerRank: number | null;
  winnerProbability: number;
  rawWinnerProbability: number;
  logLoss: number;
  brierScore: number;
  rawLogLoss: number;
  rawBrierScore: number;
  temperature: number;
  calibrationRaceKeys: string[];
}

export interface PredictionEvaluationMetrics {
  raceCount: number;
  winnerCoverage: number;
  top1Accuracy: number;
  top3Accuracy: number;
  logLoss: number;
  brierScore: number;
}

export interface PhasePredictionModel {
  phase: RacePredictionPhase;
  featureNames: WinnerPredictionFeatureName[];
  model: WinnerPredictionWeights;
  recipe: { featureSet: PredictionFeatureSet; weighting: PredictionWeighting };
  calibration: { method: 'temperature'; enabled: boolean; temperature: number; sampleCount: number; raceKeys: string[] };
  training: {
    raceKeys: string[];
    raceCount: number;
    bySeason: Record<string, number>;
    trainedThrough: { season: number; round: number };
  };
  backtest: {
    metrics: PredictionEvaluationMetrics;
    rawMetrics: PredictionEvaluationMetrics;
    bySeason: Record<string, PredictionEvaluationMetrics>;
    races: PredictionBacktestRace[];
  };
}

export interface RacePredictionModelArtifact {
  featureSchemaVersion: number;
  generatedAt: string;
  config: { modelKind: 'linear'; historyStartSeason: number; minimumTrainingRaces: number; iterations: number };
  phases: Record<RacePredictionPhase, PhasePredictionModel>;
}
