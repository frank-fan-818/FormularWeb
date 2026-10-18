import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { latestScoredForecasts, type PublishedPredictionScore } from '../src/utils/racePredictionEvaluation.ts';
import { evaluateStoredRacePredictions } from '../src/api/predictionEvaluation.ts';
import { logger } from '../src/utils/logger.ts';
import { loadSeason } from './publish-race-winner-prediction.ts';

async function main() {
  const index = process.argv.indexOf('--season');
  const season = Number(index >= 0 ? process.argv[index + 1] : new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 1950) throw new Error('Invalid evaluation season');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to read original forecasts');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const races = await loadSeason(season);
  const { scores, checkedRuns: checked } = await evaluateStoredRacePredictions(supabase, season, races, process.argv.includes('--dry-run'));
  const latest = latestScoredForecasts(scores);
  const report = { generatedAt: new Date().toISOString(), season, checkedRuns: checked, scoredRuns: scores.length,
    selection: 'latest-valid-publication-per-race-and-phase', phases: Object.fromEntries(['pre_weekend', 'post_quali'].map((phase) => {
      const rows = latest.filter((row) => row.phase === phase);
      const mean = (read: (row: PublishedPredictionScore) => number) => rows.length ? rows.reduce((sum, row) => sum + read(row), 0) / rows.length : null;
      return [phase, { raceCount: rows.length, top1Accuracy: mean((row) => Number(row.top1Hit)), top3Accuracy: mean((row) => Number(row.top3Hit)),
        logLoss: mean((row) => row.logLoss), brierScore: mean((row) => row.brierScore), winnerCoverage: mean((row) => Number(row.winnerInField)), runs: rows }];
    })) };
  const output = path.resolve('artifacts/prediction-evaluation', `${season}.json`);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  logger.info({ event: 'exit', module: 'prediction-evaluation', function: 'main', status: 'success',
    step: JSON.stringify({ season, checkedRuns: checked, scoredRuns: scores.length, output }) });
}

main().catch((error: unknown) => {
  logger.info({ event: 'exit', module: 'prediction-evaluation', function: 'main', status: 'failed',
    error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
