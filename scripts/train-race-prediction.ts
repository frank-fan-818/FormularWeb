import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPredictionHistory } from './prediction-history.ts';
import { trainRacePredictionArtifact } from '../src/utils/racePredictionTraining.ts';
import { logger } from '../src/utils/logger.ts';
import type { RacePredictionPhase } from '../src/types/racePrediction.ts';
import type { PredictionFeatureSet, PredictionWeighting } from '../src/types/racePredictionFeatures.ts';

const value = (name: string, fallback: string) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  const index = process.argv.indexOf(`--${name}`);
  return inline?.slice(name.length + 3) || (index >= 0 ? process.argv[index + 1] : fallback);
};
const fromSeason = Number(value('season-from', '2022'));
const toSeason = Number(value('season-to', String(new Date().getUTCFullYear())));
if (!Number.isInteger(fromSeason) || !Number.isInteger(toSeason) || fromSeason > toSeason || fromSeason < 1950) throw new Error('Invalid training season range');
if (value('model', 'linear') !== 'linear') throw new Error('Production training supports linear models; use prediction:experiment for research models');
const recipeFile = path.resolve('docs/model-artifacts/race-prediction-recipe.json');
const recipe = existsSync(recipeFile) ? JSON.parse(readFileSync(recipeFile, 'utf8')) as {
  schemaVersion: number; phases: Record<RacePredictionPhase, { featureSet: PredictionFeatureSet; weighting: PredictionWeighting; calibration: boolean }>;
} : null;
if (recipe && (recipe.schemaVersion !== 1 || Object.values(recipe.phases).some((phase) =>
  !['baseline', 'windows', 'windows_circuit'].includes(phase.featureSet) || !['equal', 'recent', 'season'].includes(phase.weighting) || typeof phase.calibration !== 'boolean'))) throw new Error('Invalid prediction training recipe');
const artifact = trainRacePredictionArtifact(loadPredictionHistory(fromSeason, toSeason), {
  featureSet: recipe ? { pre_weekend: recipe.phases.pre_weekend.featureSet, post_quali: recipe.phases.post_quali.featureSet } : undefined,
  weighting: recipe ? { pre_weekend: recipe.phases.pre_weekend.weighting, post_quali: recipe.phases.post_quali.weighting } : undefined,
  calibration: recipe ? { pre_weekend: recipe.phases.pre_weekend.calibration, post_quali: recipe.phases.post_quali.calibration } : false,
  onProgress: (phase, completed, total) => logger.info({ event: 'step', module: 'prediction-training', function: phase,
    step: `${completed}/${total} chronological races processed` }),
});
const output = path.resolve(value('output', 'docs/model-artifacts/race-prediction-models.json'));
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
for (const model of Object.values(artifact.phases)) {
  logger.info({ event: 'exit', module: 'prediction-training', function: model.phase, status: 'success',
    step: JSON.stringify({ output, training: model.training.bySeason, raceCount: model.training.raceCount,
      features: model.featureNames.length, metrics: model.backtest.metrics, bySeason: model.backtest.bySeason }) });
}
