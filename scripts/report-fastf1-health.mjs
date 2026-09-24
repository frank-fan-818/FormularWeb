import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nextHealth } from './fastf1-publication.mjs';
import { options, privateStore, storageError, listAll } from './private-fastf1-store.mjs';

const args = options();
if (!args.season) throw new Error('--season is required');
const directory = path.join(args.root, args.season);
async function readJson(name, fallback) {
  try { return JSON.parse(await readFile(path.join(directory, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
const manifest = await readJson('manifest.json', { rounds: [] });
const report = await readJson('export-report.json', { results: [] });
const publication = await readJson('publication-report.json', { published: [], failed: [] });
const database = await readJson('database-report.json', { imported: 0, failed: [], recovered: [] });
const steps = Object.fromEntries(['restore', 'export', 'database', 'storage', 'verify'].map(step => {
  const outcome = process.env[`FASTF1_${step.toUpperCase()}_OUTCOME`];
  return [step, ['success', 'failure', 'skipped', 'cancelled'].includes(outcome) ? outcome : 'unknown'];
}));
const store = args.dryRun ? null : privateStore();
const prefix = `health/${args.season}`;
const name = `${args.round || 'all'}.json`;
const key = `${prefix}/${name}`;
let previous = {};
if (store && (await listAll(store, prefix)).some((entry) => entry.name === name)) {
  const { data, error } = await store.download(key);
  if (error) throw storageError('Read health history', error);
  previous = JSON.parse(await data.text());
}
const now = new Date().toISOString();
const health = nextHealth(previous, manifest, report, now);
health.season = args.season;
health.scope = args.round || 'all';
health.runId = process.env.GITHUB_RUN_ID || null;
health.runAttempt = process.env.GITHUB_RUN_ATTEMPT || null;
health.steps = steps;
health.database = database;
health.pipelineFailed = process.env.FASTF1_PIPELINE_FAILED === 'true'
  || Object.values(steps).includes('failure') || !manifest.generatedAt || !report.generatedAt
  || !database.generatedAt || Boolean(database.fatal) || database.failed.length > 0
  || publication.failed.length > 0 || (publication.rejected || []).length > 0;
health.consecutiveRunFailures = health.pipelineFailed || Object.values(health.sessions).some((s) => s.consecutiveFailures > 0)
  ? (previous.consecutiveRunFailures || 0) + 1 : 0;
health.publication = publication;
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'health.json'), JSON.stringify(health, null, 2));
const failures = Object.entries(health.sessions).filter(([, session]) => session.consecutiveFailures > 0);
const lines = [
  `## FastF1 ${args.season} / ${health.scope}`,
  '',
  `Checked: ${now}. Consecutive failing runs: ${health.consecutiveRunFailures}.`,
  `Storage published: ${publication.published.length}; failed: ${publication.failed.length}. Pipeline failure: ${health.pipelineFailed}.`,
  `Database imported: ${database.imported}; failed: ${database.failed.length}; recovered after retry: ${database.recovered.length}.`,
  '',
  '| Pipeline step | Outcome |',
  '| --- | --- |',
  ...Object.entries(steps).map(([step, outcome]) => `| ${step} | ${outcome} |`),
  '',
  ...(!database.generatedAt ? ['Database report missing: inspect the database step log.', ''] : []),
  ...(database.fatal ? [`Database import aborted: ${database.fatal.code}; HTTP ${database.fatal.status ?? '-'}.`, ''] : []),
  '| Database session | Code | HTTP status (0 = transport failure) | Attempts |',
  '| --- | --- | --- | --- |',
  ...database.failed.map(s => `| ${s.key} | ${s.code} | ${s.status ?? '-'} | ${s.attempts} |`),
  '',
  ...database.recovered.map(s => `- Database recovered: ${s.key} after ${s.attempts} attempts.`),
  '',
  '| Session | Category | Consecutive failures | Missing since | Last complete snapshot |',
  '| --- | --- | --- | --- | --- |',
  ...failures.map(([key, s]) => `| ${key} | ${s.category} | ${s.consecutiveFailures} | ${s.missingSince || '-'} | ${s.lastSuccess || '-'} |`),
  '',
];
// Endpoint metadata only: never include request headers, response bodies or exception messages.
for (const result of report.results || []) {
  if (result.status !== 'failed') continue;
  lines.push(`### ${result.round}/${result.session}: ${result.diagnostic?.category || 'exporter_error'}`, '');
  lines.push(`Missing: ${(result.diagnostic?.missingFields || []).join(', ') || '-'}`, '');
  for (const request of result.diagnostic?.requests || []) {
    if (!request.inFlight && !request.exception && request.status < 400) continue;
    lines.push(`- ${request.url}: ${request.status || request.exception || 'in_flight'}, attempts=${request.attempts}`);
  }
  lines.push('');
}
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
process.stdout.write(lines.join('\n'));
if (store) {
  const { error } = await store.upload(key, JSON.stringify(health), { contentType: 'application/json', cacheControl: '0', upsert: true });
  if (error) throw storageError('Save health history', error);
}
if (failures.length || health.pipelineFailed || publication.failed.length) process.exitCode = 1;
