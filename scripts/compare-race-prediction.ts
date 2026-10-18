import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPredictionHistory } from './prediction-history.ts';
import { trainRacePredictionArtifact, PREDICTION_PHASES, summarizePredictionScores } from '../src/utils/racePredictionTraining.ts';
import { assessPredictionPromotion, rawPredictionScores, selectPredictionRecipe, withoutPredictionCalibration } from '../src/utils/racePredictionSelection.ts';
import type { PredictionFeatureSet, PredictionWeighting } from '../src/types/racePredictionFeatures.ts';
import type { RacePredictionModelArtifact } from '../src/types/racePredictionModel.ts';
import { logger } from '../src/utils/logger.ts';

const history = loadPredictionHistory(2022, new Date().getUTCFullYear());
const generatedAt = new Date().toISOString();
const candidates: Array<{ name: string; featureSet: PredictionFeatureSet; weighting: PredictionWeighting }> = [
  { name: 'baseline', featureSet: 'baseline', weighting: 'equal' },
  { name: 'windows', featureSet: 'windows', weighting: 'equal' },
  { name: 'windows_circuit', featureSet: 'windows_circuit', weighting: 'equal' },
  { name: 'recent', featureSet: 'windows_circuit', weighting: 'recent' },
  { name: 'season', featureSet: 'windows_circuit', weighting: 'season' },
];
const artifacts: Array<{ name: string; artifact: RacePredictionModelArtifact }> = [];
for (const candidate of candidates) {
  logger.info({ event: 'entry', module: 'prediction-comparison', function: candidate.name });
  const artifact = trainRacePredictionArtifact(history, { ...candidate, calibration: true, generatedAt });
  artifacts.push({ name: candidate.name, artifact });
  logger.info({ event: 'exit', module: 'prediction-comparison', function: candidate.name, status: 'success',
    step: JSON.stringify(Object.fromEntries(PREDICTION_PHASES.map((phase) => [phase, { raw: artifact.phases[phase].backtest.rawMetrics,
      calibrated: artifact.phases[phase].backtest.metrics, season2026: artifact.phases[phase].backtest.bySeason['2026'] }]))) });
}
const validationThroughSeason = 2025;
const selected = Object.fromEntries(PREDICTION_PHASES.map((phase) => [phase, selectPredictionRecipe(artifacts.map((row) => ({ name: row.name, model: row.artifact.phases[phase] })), validationThroughSeason)]));
const baseline = artifacts.find((row) => row.name === 'baseline')!.artifact;
const active = structuredClone(baseline);
const challenger = structuredClone(baseline);
const promotion: Record<string, ReturnType<typeof assessPredictionPromotion>> = {};
for (const phase of PREDICTION_PHASES) {
  const candidate = artifacts.find((row) => row.name === selected[phase].name)!.artifact.phases[phase];
  challenger.phases[phase] = selected[phase].calibration ? candidate : withoutPredictionCalibration(candidate);
  const champion = withoutPredictionCalibration(baseline.phases[phase]);
  promotion[phase] = assessPredictionPromotion(champion, challenger.phases[phase]);
  active.phases[phase] = promotion[phase].approved ? challenger.phases[phase] : champion;
}
const output = path.resolve('docs/model-artifacts/prediction-comparison.json');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ generatedAt, validationThroughSeason, selectionRule: 'Earlier validation log loss improves without reducing baseline top-1; calibration must also improve Brier',
  evaluationNote: '2026 has already been inspected. Its scores are retrospective, not an untouched test set. Known 2026 regressions can block promotion; they are not used to tune an alternative.', selected, promotion,
  variants: artifacts.map(({ name, artifact }) => ({ name, phases: Object.fromEntries(PREDICTION_PHASES.map((phase) => {
    const model = artifact.phases[phase];
    return [phase, { recipe: model.recipe, training: model.training.bySeason, features: model.featureNames.length,
      raw: model.backtest.rawMetrics, calibrated: model.backtest.metrics,
      raw2026: summarizePredictionScores(rawPredictionScores(model.backtest.races.filter((row) => row.season === 2026))),
      calibrated2026: model.backtest.bySeason['2026'] }];
  })) })) }, null, 2) + '\n');
writeFileSync(path.resolve('docs/model-artifacts/race-prediction-recipe.json'), JSON.stringify({ schemaVersion: 1, validationThroughSeason, generatedAt,
  phases: Object.fromEntries(PREDICTION_PHASES.map((phase) => [phase, { ...active.phases[phase].recipe, calibration: active.phases[phase].calibration.enabled }])),
  challengerPhases: selected, promotion }, null, 2) + '\n');
writeFileSync(path.resolve('docs/model-artifacts/race-prediction-models.json'), JSON.stringify(active, null, 2) + '\n');
writeFileSync(path.resolve('docs/model-artifacts/race-prediction-challenger.json'), JSON.stringify(challenger, null, 2) + '\n');
logger.info({ event: 'exit', module: 'prediction-comparison', function: 'selection', status: 'success', step: JSON.stringify(selected) });
