import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { fetchPaginatedRaceTable } from '../src/api/jolpicaRacePagination.ts';
import { publishFiaUpgradeSnapshot } from '../src/api/fiaUpgradePublisher.ts';
import { discoverFiaDocuments, findFiaEventPage, selectFiaUpgradeRaces, validateFiaPublication } from '../src/utils/fiaUpgradeAutomation.ts';
import type { FiaScheduledRace } from '../src/types/fiaUpgradeAutomation.ts';
import { withRetry } from '../src/utils/withRetry.ts';

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}
function log(event: string, details: Record<string, unknown> = {}) {
  const message = JSON.stringify({ scope: 'fia-upgrades', event, ...details });
  console.info(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${message}\n`);
}
async function request<T>(url: string, consume: (response: Response) => Promise<T>): Promise<T> {
  return withRetry(async signal => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} from ${new URL(url).hostname}`), { status: response.status });
    return consume(response);
  }, { timeoutMs: 30_000, maxRetries: 2, baseDelayMs: 1000 });
}

async function main() {
  for (let index = 2; index < process.argv.length; index += 1) {
    const flag = process.argv[index];
    if (flag === '--season' || flag === '--round') { argument(flag); index += 1; }
    else if (flag !== '--dry-run') throw new Error(`Unknown argument: ${flag}`);
  }
  const season = Number(argument('--season') || new Date().getUTCFullYear());
  const requestedRound = argument('--round');
  const dryRun = process.argv.includes('--dry-run');
  if (!Number.isInteger(season) || season < 1950 || season > 2100) throw new Error('Invalid season');
  if (requestedRound && (!/^\d+$/.test(requestedRound) || Number(requestedRound) < 1 || Number(requestedRound) > 40)) throw new Error('Invalid round');
  const races = await fetchPaginatedRaceTable(`/${season}.json?limit=100`, endpoint =>
    request(`https://api.jolpi.ca/ergast/f1${endpoint}`, response => response.json()));
  const calendar = races as unknown as FiaScheduledRace[];
  if (calendar.some(race => race.season !== String(season) || !race.raceName || !/^\d+$/.test(race.round))) throw new Error('Invalid calendar');
  const targets = requestedRound ? calendar.filter(race => Number(race.round) === Number(requestedRound))
    : selectFiaUpgradeRaces(calendar, Date.now());
  if (requestedRound && !targets.length) throw new Error('Requested round is not in the calendar');
  if (!targets.length) { log('outside_race_window'); return; }
  const root = 'https://www.fia.com/documents/official-regulations';
  const html = await request(root, response => response.text());
  const seasonPath = html.match(new RegExp(`value=["']([^"']*/season/season-${season}-\\d+)["']`))?.[1];
  if (!seasonPath) throw new Error('FIA season selector unavailable');
  const seasonHtml = await request(new URL(seasonPath, root).href, response => response.text());
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dryRun && (!url || !key)) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const client = !dryRun && url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const failures: number[] = [];
  for (const race of targets) {
    const round = Number(race.round);
    try {
      const eventUrl = findFiaEventPage(seasonHtml, seasonPath, race.raceName);
      if (!eventUrl) throw new Error(`FIA event not matched: ${race.raceName}`);
      const eventHtml = await request(eventUrl, response => response.text());
      const documentUrl = discoverFiaDocuments(eventHtml, season)[0];
      if (!documentUrl) { log('awaiting_publication', { season, round }); continue; }
      const bytes = await request(documentUrl, async response => new Uint8Array(await response.arrayBuffer()));
      const parser = new PDFParse({ data: bytes });
      try {
        const { text } = await parser.getText();
        const artifact = validateFiaPublication(text, { season, round, grandPrix: race.raceName, documentUrl });
        const documentHash = createHash('sha256').update(JSON.stringify({ ...artifact, generatedAt: undefined })).digest('hex');
        mkdirSync('artifacts/fia-refresh', { recursive: true });
        writeFileSync(`artifacts/fia-refresh/${season}-${round}.json`, JSON.stringify(artifact, null, 2));
        const result = client ? await publishFiaUpgradeSnapshot(client, artifact, documentHash) : 'dry_run';
        log(result, { season, round, records: artifact.records.length, teams: artifact.summaries.length, documentUrl });
      } finally { await parser.destroy(); }
    } catch (error) {
      failures.push(round);
      log('failed', { season, round, error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (failures.length) throw new Error(`FIA refresh failed for rounds ${failures.join(', ')}`);
}

main().catch(error => { log('run_failed', { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
