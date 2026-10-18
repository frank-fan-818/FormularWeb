import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fetchPaginatedRaceTable } from '../src/api/jolpicaRacePagination.ts';
import { buildPredictionSeasonSnapshot, type PredictionSeasonApiData } from '../src/utils/currentSeasonPredictionData.ts';

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
let nextRequestAt = 0;

interface ParsedArgs { season: number; fromSeason: number; output: string; check: boolean; }

function parseArgs(args: string[]): ParsedArgs {
  let season = new Date().getUTCFullYear();
  let output = '';
  let check = false;
  let fromSeason: number | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--check') { check = true; continue; }
    if (arg === '--season' || arg === '--season-from' || arg === '--output') {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value.`);
      if (arg === '--season-from') {
        fromSeason = Number(value);
      } else if (arg === '--season') {
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
  if (!Number.isInteger(fromSeason ?? season) || (fromSeason ?? season) < 1950 || (fromSeason ?? season) > season) throw new Error('Invalid --season-from.');
  if (output && fromSeason !== undefined && fromSeason !== season) throw new Error('--output only supports a single season.');
  return { season, fromSeason: fromSeason ?? season, output, check };
}

function log(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ scope: 'prediction-data-sync', event, ...details }));
}

async function fetchRaceTable(endpoint: string, optional = false): Promise<unknown[]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchPaginatedRaceTable(endpoint, async (pageEndpoint) => {
        // Reserve slots across concurrent session loaders and pagination requests.
        const requestAt = Math.max(Date.now(), nextRequestAt);
        nextRequestAt = requestAt + 1_100;
        await new Promise((resolve) => setTimeout(resolve, requestAt - Date.now()));
        const response = await fetch(`${JOLPICA_BASE_URL}${pageEndpoint}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const retryMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter || '') - Date.now();
          throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status,
            retryAfterMs: Number.isFinite(retryMs) && retryMs > 0 ? retryMs : response.status === 429 ? 30_000 : 0 });
        }
        return response.json();
      });
    } catch (error) {
      if (optional && error instanceof Error && 'status' in error && error.status === 404) return [];
      if (attempt === MAX_ATTEMPTS) {
        if (optional) {
          log('optional-source-unavailable', { endpoint, reason: error instanceof Error ? error.message : String(error) });
          return [];
        }
        throw new Error(`Jolpica request failed after ${MAX_ATTEMPTS} attempts: ${endpoint}`, { cause: error });
      }
      const retryAfterMs = error instanceof Error && 'retryAfterMs' in error ? Number(error.retryAfterMs) : 0;
      const delayMs = Math.max(500 * (2 ** (attempt - 1)), Math.min(retryAfterMs || 0, 120_000));
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
  for (let season = args.fromSeason; season <= args.season; season += 1) {
    await syncSeason({ ...args, season, output: args.output || path.join('data', 'prediction', 'seasons', `${season}.json`) });
  }
}

async function syncSeason(args: ParsedArgs) {
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
