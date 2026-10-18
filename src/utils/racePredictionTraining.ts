import type { PredictionSeasonRaceData } from '@/types/predictionData';
import type { RacePredictionPhase } from '@/types/racePrediction';
import type { PredictionFeatureSet, PredictionWeighting } from '@/types/racePredictionFeatures';
import type { PhasePredictionModel, PredictionBacktestRace, PredictionEvaluationMetrics, RacePredictionModelArtifact } from '@/types/racePredictionModel';
import { buildCurrentRaceFeatureInputs, getPredictionPhase, hasCompletePredictionField } from './currentRacePrediction';
import { buildWinnerCandidates } from './winnerFeatureBuilder';
import { applyPredictionTemperature, fitPredictionTemperature, type PredictionCalibrationCase } from './racePredictionCalibration';
import { WINNER_PREDICTION_FEATURES, predictWinnerRace, trainWinnerPredictionModel, type WinnerPredictionCandidate } from './raceWinnerPrediction';

export const PREDICTION_FEATURE_SCHEMA_VERSION = 3;
export const PREDICTION_PHASES: RacePredictionPhase[] = ['pre_weekend', 'post_quali'];
const raceKey = (race: PredictionSeasonRaceData) => `${race.season}-${race.round}`;
const isEarlier = (a: { season: number; round: number }, b: { season: number; round: number }) => (
  a.season < b.season || (a.season === b.season && a.round < b.round)
);

export function eligiblePredictionHistory(races: PredictionSeasonRaceData[], asOf: string): PredictionSeasonRaceData[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error('Invalid training cutoff');
  return [...new Map(races.filter((race) => (
    hasCompletePredictionField(race.results.length) &&
    new Set(race.results.map((row) => row.driverId)).size === race.results.length &&
    race.results.filter((row) => row.position === 1).length === 1 &&
    (!race.raceStartAt ? race.season < new Date(cutoff).getUTCFullYear() : Date.parse(race.raceStartAt) < cutoff)
  )).map((race) => [raceKey(race), race])).values()]
    .sort((a, b) => a.season - b.season || a.round - b.round);
}

export function buildPhaseCandidates(target: PredictionSeasonRaceData, history: PredictionSeasonRaceData[], phase: RacePredictionPhase,
  featureSet: PredictionFeatureSet = 'windows_circuit', asOf?: string): WinnerPredictionCandidate[] {
  const winner = target.results.find((row) => row.position === 1)?.driverId;
  return buildWinnerCandidates(raceKey(target), buildCurrentRaceFeatureInputs(target, history, phase, {
    multiWindow: featureSet !== 'baseline', circuitHistory: featureSet === 'windows_circuit', asOf,
  }), winner);
}

export function summarizePredictionScores(rows: PredictionBacktestRace[]): PredictionEvaluationMetrics {
  const average = (read: (row: PredictionBacktestRace) => number) => rows.length ? rows.reduce((sum, row) => sum + read(row), 0) / rows.length : 0;
  return { raceCount: rows.length, winnerCoverage: average((r) => Number(r.winnerInField)),
    top1Accuracy: average((r) => Number(r.top1Hit)), top3Accuracy: average((r) => Number(r.top3Hit)),
    logLoss: average((r) => r.logLoss), brierScore: average((r) => r.brierScore) };
}

export function predictionRaceWeights(groups: WinnerPredictionCandidate[][], policy: PredictionWeighting): number[] {
  const lastSeason = Number(groups[groups.length - 1]?.[0]?.raceKey.split('-')[0]);
  return groups.map((group, index) => policy === 'equal' ? 1 : Math.max(1e-6, policy === 'recent'
    ? 2 ** (-(groups.length - 1 - index) / 24)
    : 2 ** (-(lastSeason - Number(group[0].raceKey.split('-')[0])))));
}

function fit(groups: WinnerPredictionCandidate[][], phase: RacePredictionPhase, iterations: number, weighting: PredictionWeighting) {
  // A constant within a race cannot distinguish its drivers. Select using training data only.
  const featureNames = WINNER_PREDICTION_FEATURES.filter((feature) => (
    !(phase === 'pre_weekend' && /^(grid|qualifying|poleModel|teamMateQualifying|sprintFinish|sprintQualifying)/.test(feature)) &&
    groups.some((group) => group.some((candidate) => Math.abs(candidate.features[feature] - group[0].features[feature]) > 1e-8))
  ));
  return { featureNames, model: trainWinnerPredictionModel(groups, { featureNames, iterations, learningRate: 0.085, l2: 0.003,
    raceWeights: predictionRaceWeights(groups, weighting) }) };
}

export function predictPhaseRace(candidates: WinnerPredictionCandidate[], model: PhasePredictionModel) {
  const raw = predictWinnerRace(candidates, model.model, model.featureNames);
  const probabilities = applyPredictionTemperature(raw.map((row) => row.probability), model.calibration.temperature);
  return raw.map((row, index) => ({ ...row, probability: probabilities[index] }));
}

export function trainRacePredictionArtifact(races: PredictionSeasonRaceData[], options: {
  minimumTrainingRaces?: number; iterations?: number; generatedAt?: string;
  featureSet?: PredictionFeatureSet | Record<RacePredictionPhase, PredictionFeatureSet>;
  weighting?: PredictionWeighting | Record<RacePredictionPhase, PredictionWeighting>;
  calibration?: boolean | Record<RacePredictionPhase, boolean>;
  onProgress?: (phase: RacePredictionPhase, completed: number, total: number) => void;
} = {}): RacePredictionModelArtifact {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const history = eligiblePredictionHistory(races, generatedAt);
  const minimumTrainingRaces = options.minimumTrainingRaces ?? 24;
  const iterations = options.iterations ?? 24;
  if (history.length <= minimumTrainingRaces) throw new Error('Insufficient completed training races');
  const phases = {} as Record<RacePredictionPhase, PhasePredictionModel>;
  for (const phase of PREDICTION_PHASES) {
    const featureSet = typeof options.featureSet === 'object' ? options.featureSet[phase] : options.featureSet ?? 'windows_circuit';
    const weighting = typeof options.weighting === 'object' ? options.weighting[phase] : options.weighting ?? 'equal';
    const calibrationEnabled = typeof options.calibration === 'object' ? options.calibration[phase] : options.calibration ?? false;
    const trainingGroups: WinnerPredictionCandidate[][] = [];
    const trainingRaceKeys: string[] = [];
    const scores: PredictionBacktestRace[] = [];
    const calibrationCases: Array<PredictionCalibrationCase & { raceKey: string }> = [];
    for (const [index, race] of history.entries()) {
      if (index % 20 === 0) options.onProgress?.(phase, index, history.length);
      if (phase === 'post_quali' && !hasCompletePredictionField(race.qualifying.length)) continue;
      const candidates = buildPhaseCandidates(race, history.slice(0, index), phase, featureSet);
      if (!hasCompletePredictionField(candidates.length)) continue;
      if (trainingGroups.length >= minimumTrainingRaces) {
        const fitted = fit(trainingGroups, phase, iterations, weighting);
        const prediction = predictWinnerRace(candidates, fitted.model, fitted.featureNames);
        const winnerIndex = prediction.findIndex((row) => row.winner);
        const winner = prediction[winnerIndex];
        const temperature = calibrationEnabled ? fitPredictionTemperature(calibrationCases).temperature : 1;
        const rawProbabilities = prediction.map((row) => row.probability);
        const probabilities = applyPredictionTemperature(rawProbabilities, temperature);
        const brier = (values: number[]) => values.reduce((sum, value, index) => sum + (value - Number(index === winnerIndex)) ** 2, winner ? 0 : 1);
        scores.push({ raceKey: raceKey(race), season: race.season, round: race.round,
          trainingRaceKeys: [...trainingRaceKeys], winnerInField: Boolean(winner),
          calibrationRaceKeys: calibrationEnabled ? calibrationCases.map((row) => row.raceKey) : [], temperature,
          top1Hit: winner?.rank === 1, top3Hit: Boolean(winner && winner.rank <= 3),
          winnerRank: winner?.rank ?? null, winnerProbability: probabilities[winnerIndex] || 0,
          rawWinnerProbability: winner?.probability || 0,
          logLoss: -Math.log(Math.max(probabilities[winnerIndex] || 0, 1e-12)), brierScore: brier(probabilities),
          rawLogLoss: -Math.log(Math.max(winner?.probability || 0, 1e-12)), rawBrierScore: brier(rawProbabilities) });
        if (winner) calibrationCases.push({ raceKey: raceKey(race), probabilities: rawProbabilities, winnerIndex });
      }
      // An unavailable preliminary winner is a coverage failure, never an all-negative training label.
      if (candidates.some((row) => row.winner)) {
        trainingGroups.push(candidates);
        trainingRaceKeys.push(raceKey(race));
      }
    }
    if (trainingGroups.length < minimumTrainingRaces) throw new Error(`Insufficient training coverage for ${phase}`);
    const fitted = fit(trainingGroups, phase, iterations, weighting);
    const lastKey = trainingRaceKeys[trainingRaceKeys.length - 1].split('-').map(Number);
    const seasons = [...new Set(scores.map((row) => String(row.season)))];
    const calibrated = calibrationEnabled ? fitPredictionTemperature(calibrationCases) : { temperature: 1, sampleCount: 0 };
    phases[phase] = { phase, ...fitted, recipe: { featureSet, weighting },
      calibration: { method: 'temperature', enabled: calibrationEnabled, ...calibrated, raceKeys: calibrationEnabled ? calibrationCases.map((row) => row.raceKey) : [] },
      training: { raceKeys: trainingRaceKeys, raceCount: trainingRaceKeys.length,
        bySeason: Object.fromEntries([...new Set(history.map((r) => r.season))].map((season) => [String(season), trainingRaceKeys.filter((key) => key.startsWith(`${season}-`)).length])),
        trainedThrough: { season: lastKey[0], round: lastKey[1] } },
      backtest: { metrics: summarizePredictionScores(scores), races: scores,
        rawMetrics: summarizePredictionScores(scores.map((row) => ({ ...row, logLoss: row.rawLogLoss, brierScore: row.rawBrierScore }))),
        bySeason: Object.fromEntries(seasons.map((season) => [season, summarizePredictionScores(scores.filter((row) => String(row.season) === season))])) } };
  }
  return { featureSchemaVersion: PREDICTION_FEATURE_SCHEMA_VERSION, generatedAt,
    config: { modelKind: 'linear', historyStartSeason: history[0].season, minimumTrainingRaces, iterations }, phases };
}

export function selectPhaseModel(artifact: RacePredictionModelArtifact, target: PredictionSeasonRaceData, history: PredictionSeasonRaceData[]): PhasePredictionModel {
  if (artifact.featureSchemaVersion !== PREDICTION_FEATURE_SCHEMA_VERSION) throw new Error('Incompatible prediction feature schema');
  const phase = getPredictionPhase(target);
  const selected = artifact.phases[phase];
  if (!selected || selected.phase !== phase) throw new Error(`Missing model for ${phase}`);
  if (!isEarlier(selected.training.trainedThrough, target)) throw new Error('Model training cutoff includes target or future results');
  const trainingKeys = new Set(selected.training.raceKeys);
  const eligible = eligiblePredictionHistory(history, new Date().toISOString()).filter((race) => race.season >= artifact.config.historyStartSeason && isEarlier(race, target));
  for (const race of eligible) {
    // Training can omit an unseen preliminary entrant, but post-quali must cover every complete field.
    if (phase === 'post_quali' && !hasCompletePredictionField(race.qualifying.length)) continue;
    const candidates = buildPhaseCandidates(race, eligible, phase, selected.recipe.featureSet);
    if (hasCompletePredictionField(candidates.length) && candidates.some((row) => row.winner) && !trainingKeys.has(raceKey(race))) {
      throw new Error(`Stale model: missing completed race ${raceKey(race)}`);
    }
  }
  return selected;
}
