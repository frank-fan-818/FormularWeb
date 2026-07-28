import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

type SessionCode = 'FP1' | 'FP2' | 'FP3' | 'SQ' | 'SS' | 'S';

interface ParsedArgs {
  seasonFrom: number;
  seasonTo: number;
  round?: number;
  sessions: SessionCode[];
  source: 'jolpica' | 'fastf1' | 'all';
  inputRoot: string;
  dryRun: boolean;
  flushEachSeason: boolean;
  help: boolean;
}

interface JolpicaRace {
  season: string;
  round: string;
  raceName?: string;
  Circuit?: {
    circuitId?: string;
  };
  Results?: unknown[];
  QualifyingResults?: unknown[];
  SprintResults?: unknown[];
  [key: string]: unknown;
}

interface JolpicaResponse {
  MRData?: {
    RaceTable?: {
      Races?: JolpicaRace[];
    };
  };
}

interface SessionResultRow {
  season: number;
  round: number;
  session: SessionCode;
  source: 'jolpica' | 'fastf1';
  race_name: string | null;
  circuit_id: string | null;
  fetched_at: string;
  payload: JolpicaRace;
}

interface FastF1Payload {
  source?: string;
  generatedAt?: string;
  season?: string;
  round?: string;
  session?: string;
  eventName?: string;
  sessionName?: string;
  sessionResults?: FastF1SessionResult[];
}

interface FastF1SessionResult {
  driver?: string;
  driverNumber?: string;
  driverId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  team?: string;
  position?: number | null;
  classifiedPosition?: string;
  gridPosition?: number | null;
  time?: string;
  timeSeconds?: number | null;
  status?: string;
  points?: number | string | null;
  laps?: number | null;
}

const DEFAULT_SESSIONS: SessionCode[] = ['FP1', 'FP2', 'FP3', 'SQ', 'SS', 'S'];
const SESSION_PATHS: Record<SessionCode, string> = {
  FP1: 'practice/1',
  FP2: 'practice/2',
  FP3: 'practice/3',
  SQ: 'sprintQualifying',
  SS: 'sprintShootout',
  S: 'sprint',
};
const SESSION_RESULT_KEYS: Record<SessionCode, keyof JolpicaRace> = {
  FP1: 'Results',
  FP2: 'Results',
  FP3: 'Results',
  SQ: 'QualifyingResults',
  SS: 'QualifyingResults',
  S: 'SprintResults',
};
const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const BATCH_SIZE = 500;
const REQUEST_DELAY_MS = 450;
const RATE_LIMIT_RETRY_DELAYS_MS = [1200, 2500, 5000, 9000];

function printHelp() {
  console.log(`
Usage:
  npm run import:race-sessions -- --season 2025
  npm run import:race-sessions -- --from 2018 --to 2025
  npm run import:race-sessions -- --season 2025 --round 19
  npm run import:race-sessions -- --season 2025 --session FP1 --session SQ --session S
  npm run import:race-sessions -- --season 2025 --round 19 --source fastf1
  npm run import:race-sessions -- --from 2021 --to 2025 --source all --flush-each-season
  npm run import:race-sessions -- --from 2018 --to 2025 --dry-run

Description:
  Imports practice, sprint qualifying, and sprint race result payloads into
  public.race_session_results. Jolpica and local FastF1 exports are both supported.

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (required; never use a browser anon key)
`);
}

function parsePositiveInteger(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }
  return parsed;
}

function parseSession(value: string): SessionCode {
  const session = value.trim().toUpperCase() as SessionCode;
  if (!Object.prototype.hasOwnProperty.call(SESSION_PATHS, session)) {
    throw new Error(`Unsupported session "${value}". Use one of: ${Object.keys(SESSION_PATHS).join(', ')}`);
  }
  return session;
}

function parseArgs(args: string[]): ParsedArgs {
  const currentYear = new Date().getUTCFullYear();
  const parsed: ParsedArgs = {
    seasonFrom: currentYear,
    seasonTo: currentYear,
    sessions: [],
    source: 'all',
    inputRoot: 'public/fastf1',
    dryRun: false,
    flushEachSeason: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--season') {
      const season = parsePositiveInteger(arg, args[index + 1]);
      parsed.seasonFrom = season;
      parsed.seasonTo = season;
      index += 1;
      continue;
    }

    if (arg === '--from') {
      parsed.seasonFrom = parsePositiveInteger(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--to') {
      parsed.seasonTo = parsePositiveInteger(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--round') {
      parsed.round = parsePositiveInteger(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--session') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--session requires a value.');
      }
      parsed.sessions.push(parseSession(value));
      index += 1;
      continue;
    }

    if (arg === '--source') {
      const value = args[index + 1];
      if (value !== 'jolpica' && value !== 'fastf1' && value !== 'all') {
        throw new Error('--source must be one of: jolpica, fastf1, all.');
      }
      parsed.source = value;
      index += 1;
      continue;
    }

    if (arg === '--input') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--input requires a directory.');
      }
      parsed.inputRoot = value;
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--flush-each-season') {
      parsed.flushEachSeason = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  if (parsed.seasonFrom > parsed.seasonTo) {
    throw new Error('--from must be less than or equal to --to.');
  }

  parsed.sessions = parsed.sessions.length ? [...new Set(parsed.sessions)] : DEFAULT_SESSIONS;
  return parsed;
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url: string): Promise<JolpicaResponse | null> {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await fetch(url);
    if (response.status === 400 || response.status === 404) {
      return null;
    }
    if (response.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      const delay = RATE_LIMIT_RETRY_DELAYS_MS[attempt];
      console.warn(`Jolpica rate limited; retrying in ${delay}ms: ${url}`);
      await sleep(delay);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Jolpica request failed ${response.status}: ${url}`);
    }
    return response.json() as Promise<JolpicaResponse>;
  }

  throw new Error(`Jolpica request failed after retries: ${url}`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function hasSessionResults(session: SessionCode, race: JolpicaRace): boolean {
  const key = SESSION_RESULT_KEYS[session];
  const results = race[key];
  return Array.isArray(results) && results.length > 0;
}

async function loadSeasonRounds(season: number, round?: number): Promise<number[]> {
  if (round) {
    return [round];
  }

  const payload = await fetchJson(`${JOLPICA_BASE_URL}/${season}.json?limit=100`);
  const races = payload?.MRData?.RaceTable?.Races || [];
  return races
    .map((race) => Number(race.round))
    .filter((value) => Number.isInteger(value) && value > 0);
}

async function loadSessionRace(season: number, round: number, session: SessionCode): Promise<JolpicaRace | null> {
  const path = SESSION_PATHS[session];
  const payload = await fetchJson(`${JOLPICA_BASE_URL}/${season}/${round}/${path}.json?limit=200`);
  const race = payload?.MRData?.RaceTable?.Races?.[0] || null;
  if (!race || !hasSessionResults(session, race)) {
    return null;
  }
  return race;
}

async function collectJolpicaRows(args: ParsedArgs, onSeasonRows?: (rows: SessionResultRow[]) => Promise<void>): Promise<SessionResultRow[]> {
  const rows: SessionResultRow[] = [];
  for (let season = args.seasonFrom; season <= args.seasonTo; season += 1) {
    const seasonRows: SessionResultRow[] = [];
    const rounds = await loadSeasonRounds(season, args.round);
    console.log(`Season ${season}: ${rounds.length} round(s)`);

    for (const round of rounds) {
      for (const session of args.sessions) {
        try {
          const race = await loadSessionRace(season, round, session);
          await sleep(REQUEST_DELAY_MS);

          if (!race) {
            continue;
          }

          const row = {
            season,
            round,
            session,
            source: 'jolpica',
            race_name: typeof race.raceName === 'string' ? race.raceName : null,
            circuit_id: typeof race.Circuit?.circuitId === 'string' ? race.Circuit.circuitId : null,
            fetched_at: new Date().toISOString(),
            payload: {
              ...race,
              season: String(season),
              round: String(round),
            },
          } satisfies SessionResultRow;

          rows.push(row);
          seasonRows.push(row);
          console.log(`- ${season} round ${round} ${session}: ${race.raceName || 'Unknown race'}`);
        } catch (error) {
          console.warn(`Skipped ${season} round ${round} ${session}:`, error instanceof Error ? error.message : error);
        }
      }
    }

    if (onSeasonRows && seasonRows.length > 0) {
      await onSeasonRows(seasonRows);
    }
  }

  return rows;
}

async function collectRows(args: ParsedArgs, onSeasonRows?: (rows: SessionResultRow[]) => Promise<void>): Promise<SessionResultRow[]> {
  if (args.source === 'fastf1') {
    return collectFastF1Rows(args);
  }

  const rows = await collectJolpicaRows(args, onSeasonRows);

  if (args.source === 'all') {
    rows.push(...await collectFastF1Rows(args));
  }

  return rows;
}

function normalizeId(value: string | undefined, fallback: string): string {
  const raw = value || fallback;
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatFastF1Time(time: string | undefined, seconds: number | null | undefined): string {
  if (time) {
    return time;
  }
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '';
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return `${minutes}:${remaining.toFixed(3).padStart(6, '0')}`;
}

function mapFastF1Driver(result: FastF1SessionResult) {
  const fullName = result.fullName || [result.firstName, result.lastName].filter(Boolean).join(' ') || result.driver || '';
  const nameParts = fullName.split(' ').filter(Boolean);
  const firstName = result.firstName || nameParts.slice(0, -1).join(' ');
  const lastName = result.lastName || nameParts[nameParts.length - 1] || result.driver || '';

  return {
    driverId: normalizeId(result.driverId, fullName || result.driver || result.driverNumber || 'unknown_driver'),
    permanentNumber: String(result.driverNumber || ''),
    code: String(result.driver || '').toUpperCase(),
    url: '#',
    givenName: firstName,
    familyName: lastName,
    dateOfBirth: '',
    nationality: '',
  };
}

function mapFastF1Constructor(result: FastF1SessionResult) {
  const team = result.team || 'Unknown';
  return {
    constructorId: normalizeId(undefined, team),
    url: '#',
    name: team,
    nationality: '',
  };
}

function mapFastF1RaceResult(result: FastF1SessionResult) {
  const position = result.position ? String(result.position) : String(result.classifiedPosition || '');
  const time = formatFastF1Time(result.time, result.timeSeconds);

  return {
    number: String(result.driverNumber || ''),
    position,
    positionText: String(result.classifiedPosition || position || '-'),
    points: String(result.points ?? '0'),
    Driver: mapFastF1Driver(result),
    Constructor: mapFastF1Constructor(result),
    grid: result.gridPosition == null ? '-' : String(result.gridPosition),
    laps: result.laps == null ? '' : String(result.laps),
    status: String(result.status || ''),
    Time: time ? { millis: '', time } : undefined,
  };
}

function mapFastF1QualifyingResult(result: FastF1SessionResult) {
  const time = formatFastF1Time(result.time, result.timeSeconds);
  return {
    number: String(result.driverNumber || ''),
    position: result.position ? String(result.position) : '',
    Driver: mapFastF1Driver(result),
    Constructor: mapFastF1Constructor(result),
    Q1: '',
    Q2: '',
    Q3: time,
  };
}

function normalizeFastF1Payload(payload: FastF1Payload, filePath: string): SessionResultRow | null {
  const session = String(payload.session || path.basename(filePath, '.json')).toUpperCase() as SessionCode;
  if (!Object.prototype.hasOwnProperty.call(SESSION_PATHS, session)) {
    return null;
  }

  const season = Number(payload.season);
  const round = Number(payload.round);
  const sessionResults = payload.sessionResults || [];
  if (!Number.isInteger(season) || !Number.isInteger(round) || sessionResults.length === 0) {
    return null;
  }

  const baseRace: JolpicaRace = {
    season: String(season),
    round: String(round),
    url: '#',
    raceName: payload.eventName || payload.sessionName || `Round ${round}`,
    Circuit: {},
    date: '',
  };

  if (session === 'SQ' || session === 'SS') {
    baseRace.QualifyingResults = sessionResults.map(mapFastF1QualifyingResult);
  } else {
    const results = sessionResults.map(mapFastF1RaceResult);
    baseRace.Results = results;
    if (session === 'S') {
      baseRace.SprintResults = results;
    }
  }

  return {
    season,
    round,
    session,
    source: 'fastf1',
    race_name: typeof baseRace.raceName === 'string' ? baseRace.raceName : null,
    circuit_id: null,
    fetched_at: new Date().toISOString(),
    payload: baseRace,
  };
}

async function findFastF1Files(args: ParsedArgs): Promise<string[]> {
  const root = path.resolve(args.inputRoot);
  const files: string[] = [];

  async function addIfExists(filePath: string) {
    if (await pathExists(filePath)) {
      files.push(filePath);
    }
  }

  if (args.seasonFrom === args.seasonTo && args.round) {
    for (const session of args.sessions) {
      await addIfExists(path.join(root, String(args.seasonFrom), String(args.round), `${session}.json`));
    }
    return files;
  }

  async function walk(directory: string) {
    if (!await pathExists(directory)) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const session = path.basename(entry.name, '.json').toUpperCase() as SessionCode;
      if (entry.isFile() && args.sessions.includes(session)) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files.sort();
}

async function collectFastF1Rows(args: ParsedArgs): Promise<SessionResultRow[]> {
  const files = await findFastF1Files(args);
  const rows: SessionResultRow[] = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const row = normalizeFastF1Payload(JSON.parse(raw) as FastF1Payload, filePath);
    if (!row || row.season < args.seasonFrom || row.season > args.seasonTo) {
      continue;
    }
    rows.push(row);
    console.log(`- ${row.season} round ${row.round} ${row.session} fastf1: ${row.race_name || 'Unknown race'}`);
  }

  return rows;
}

async function upsertRows(rows: SessionResultRow[]) {
  const supabase = createSupabaseAdminClient();
  let imported = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase
      .from('race_session_results')
      .upsert(batch, { onConflict: 'season,round,session,source' });

    if (error) {
      throw error;
    }

    imported += batch.length;
  }

  return imported;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const rows = await collectRows(args, async (seasonRows) => {
    if (args.dryRun || !args.flushEachSeason) {
      return;
    }

    const imported = await upsertRows(seasonRows);
    console.log(`Flushed ${imported} Jolpica row(s) for season ${seasonRows[0]?.season}.`);
  });
  console.log(`Prepared ${rows.length} race session result row(s).`);

  if (args.dryRun) {
    console.log('Dry run complete; no database rows were written.');
    return;
  }

  const rowsToImport = args.flushEachSeason
    ? rows.filter((row) => row.source !== 'jolpica')
    : rows;
  const imported = rowsToImport.length ? await upsertRows(rowsToImport) : 0;
  console.log(`Imported ${imported} race session result row(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
