import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isTransient, retryTransient } from './automation-retry.mjs';

export function validateCalendar(payload, season) {
  const table = payload?.MRData?.RaceTable;
  if (table?.season !== season || !Array.isArray(table.Races)) throw new Error('Invalid calendar schema or season');
  if (payload.MRData.total !== undefined && Number(payload.MRData.total) !== table.Races.length) {
    throw new Error('Incomplete calendar response');
  }
  for (const race of table.Races) {
    const date = `${race.date}T${race.time || '23:59:59Z'}`;
    if (race.season !== season || !/^[1-9]\d*$/.test(race.round)
      || !/^\d{4}-\d{2}-\d{2}$/.test(race.date) || !Number.isFinite(Date.parse(date))) {
      throw new Error('Invalid calendar race');
    }
  }
  return table.Races;
}

async function requestCalendar(season) {
  return retryTransient(async () => {
    const response = await fetch(`https://api.jolpi.ca/ergast/f1/${season}.json?limit=100`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error(`Calendar HTTP ${response.status}`), { status: response.status });
    }
    return response.json();
  });
}

export async function resolveCalendar({ season, now = Date.now(), cache, request = requestCalendar }) {
  let payload;
  try { payload = await request(season); }
  catch (error) {
    if (!isTransient(error)) throw error;
    if (cache?.season !== season || !Number.isFinite(cache.fetchedAt)
      || now < cache.fetchedAt || now - cache.fetchedAt > 86400000) {
      throw new Error('Calendar unavailable and no valid cache younger than 24 hours');
    }
    return { races: validateCalendar(cache.payload, season), snapshot: cache, source: 'cache' };
  }
  return { races: validateCalendar(payload, season), snapshot: { season, fetchedAt: now, payload }, source: 'live' };
}

export function isEligible(races, mode, now) {
  if (!['prediction', 'fia'].includes(mode)) throw new Error('Invalid race window mode');
  return races.some(race => {
    const delta = Date.parse(`${race.date}T${race.time || (mode === 'fia' ? '23:59:59Z' : '00:00:00Z')}`) - now;
    return mode === 'fia' ? delta >= -172800000 && delta <= 432000000 : delta >= 0 && delta <= 259200000;
  });
}

async function main() {
  const mode = process.argv[2];
  if (!['prediction', 'fia'].includes(mode)) throw new Error('Invalid race window mode');
  const season = process.env.REQUESTED_SEASON || String(new Date().getUTCFullYear());
  const round = process.env.REQUESTED_ROUND || '';
  if (!/^\d{4}$/.test(season) || Number(season) < 1950 || Number(season) > 2100) throw new Error('Invalid season');
  if (round && (!/^[1-9]\d*$/.test(round) || Number(round) > 40)) throw new Error('Invalid round');
  const output = async value => { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, value); };
  await output(`season=${season}\n`);
  if (process.env.EVENT_NAME === 'workflow_dispatch' && (mode === 'prediction' || round)) {
    await output('eligible=true\nsource=manual\n');
    return;
  }
  const file = path.join(process.env.CALENDAR_CACHE_DIR || '.cache/race-calendar', `${season}.json`);
  let cache;
  try { cache = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
  const now = Date.now();
  const result = await resolveCalendar({ season, now, cache });
  if (result.source === 'live') {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(result.snapshot));
  } else {
    process.stdout.write('::warning::Live calendar unavailable after retries; using validated calendar less than 24 hours old.\n');
  }
  const eligible = isEligible(result.races, mode, now);
  await output(`eligible=${eligible}\nsource=${result.source}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### Race window (${mode})\nCalendar source: ${result.source}; fetched: ${new Date(result.snapshot.fetchedAt).toISOString()}; eligible: ${eligible}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    process.stderr.write('::error::Race-window check failed: invalid input/calendar or upstream outage without a fresh cache.\n');
    process.exitCode = 1;
  });
}
