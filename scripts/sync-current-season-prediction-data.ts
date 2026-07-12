import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPredictionSeasonSnapshot, type PredictionSeasonApiData } from '../src/utils/currentSeasonPredictionData.ts';

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

interface ParsedArgs { season: number; output: string; check: boolean; }
interface JolpicaResponse { MRData?: { RaceTable?: { Races?: unknown[] } } }

function parseArgs(args: string[]): ParsedArgs {
  let season = new Date().getUTCFullYear();
  let output = '';
  let check = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--check') { check = true; continue; }
    if (arg === '--season' || arg === '--output') {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value.`);
      if (arg === '--season') {
        season = Number(value);
        if (!Number.isInteger(season) || season < 1950) throw new Error('--season must be a valid F1 season.');
      } else {
        output = value;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { season, output: output || path.join('data', 'prediction', 'seasons', `${season}.json`), check };
}

function log(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ scope: 'prediction-data-sync', event, ...details }));
}

async function fetchRaceTable(endpoint: string, optional = false): Promise<unknown[]> {
  const url = `${JOLPICA_BASE_URL}${endpoint}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (optional && response.status === 404) return [];
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as JolpicaResponse;
      return payload.MRData?.RaceTable?.Races || [];
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        if (optional) {
          log('optional-source-unavailable', { endpoint, reason: error instanceof Error ? error.message : String(error) });
          return [];
        }
        throw new Error(`Jolpica request failed after ${MAX_ATTEMPTS} attempts: ${endpoint}`, { cause: error });
      }
      const delayMs = 500 * (2 ** (attempt - 1));
      log('retry', { endpoint, attempt, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return [];
}

async function loadSeasonApiData(season: number): Promise<PredictionSeasonApiData> {
  const [schedule, resultRaces, qualifyingRaces, sprintRaces, sprintQualifyingRaces] = await Promise.all([
    fetchRaceTable(`/${season}.json?limit=100`),
    fetchRaceTable(`/${season}/results.json?limit=2000`),
    fetchRaceTable(`/${season}/qualifying.json?limit=2000`),
    fetchRaceTable(`/${season}/sprint.json?limit=1000`, true),
    fetchRaceTable(`/${season}/sprint/qualifying.json?limit=1000`, true),
  ]);
  return { schedule, resultRaces, qualifyingRaces, sprintRaces, sprintQualifyingRaces } as PredictionSeasonApiData;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log('start', { season: args.season, output: args.output, check: args.check });
  const snapshot = buildPredictionSeasonSnapshot(args.season, await loadSeasonApiData(args.season));
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  const outputPath = path.resolve(args.output);
  const previous = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';

  if (previous === content) {
    log('unchanged', { season: args.season, completedRaces: snapshot.races.length });
    return;
  }
  if (args.check) {
    log('stale', { season: args.season, completedRaces: snapshot.races.length });
    process.exitCode = 2;
    return;
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, 'utf8');
  log('updated', { season: args.season, completedRaces: snapshot.races.length, rounds: snapshot.races.map((race) => race.round) });
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ scope: 'prediction-data-sync', event: 'failed', reason: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
