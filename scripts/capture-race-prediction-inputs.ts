import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadSeason } from './publish-race-winner-prediction.ts';
import { loadPreRaceObservations } from './prediction-history.ts';
import { selectPredictionTarget } from '../src/utils/currentRacePrediction.ts';
import { fetchPreRacePredictionObservation } from '../src/api/preRacePredictionInputs.ts';
import { appendPreRaceObservation } from '../src/utils/preRaceObservationArchive.ts';
import { logger } from '../src/utils/logger.ts';

async function main() {
  const index = process.argv.indexOf('--season');
  const season = Number(index >= 0 ? process.argv[index + 1] : new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 1950) throw new Error('Invalid observation season');
  const races = await loadSeason(season);
  const target = selectPredictionTarget(races);
  if (!target) return;
  const latest = races.filter((race) => race.results.length >= 15 && race.results.some((row) => row.position === 1)).sort((a, b) => b.round - a.round)[0];
  const result = await fetchPreRacePredictionObservation({ ...target, expectedFieldSize: target.qualifying.length >= 15 ? target.qualifying.length : latest?.results.length });
  let changed = false;
  if (result.observation) {
    const previous = loadPreRaceObservations(season, target.round);
    const observations = appendPreRaceObservation(previous, result.observation);
    changed = observations.length !== previous.length;
    if (changed) {
      const file = path.resolve('data/prediction/pre-race', String(season), `${target.round}.json`);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify({ schemaVersion: 1, season, round: target.round, observations }, null, 2) + '\n');
    }
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  logger.info({ event: 'exit', module: 'prediction-observations', function: 'main', status: 'success',
    step: JSON.stringify({ season, round: target.round, reason: result.reason, changed, entryCount: result.observation?.entries.length || 0,
      gridCount: result.observation?.entries.filter((row) => row.gridPosition !== undefined).length || 0 }) });
}
main().catch((error: unknown) => {
  logger.info({ event: 'exit', module: 'prediction-observations', function: 'main', status: 'failed', error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
