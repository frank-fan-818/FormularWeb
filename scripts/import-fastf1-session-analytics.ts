import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

type FastF1SessionCode = 'R' | 'Q' | 'SQ' | 'SS' | 'S' | 'FP1' | 'FP2' | 'FP3';

interface ParsedArgs {
  season?: number;
  seasonFrom?: number;
  seasonTo?: number;
  round?: number;
  sessions: FastF1SessionCode[];
  inputRoot: string;
  dryRun: boolean;
  help: boolean;
}

interface FastF1Payload {
  season?: string;
  round?: string;
  session?: string;
  eventName?: string;
  sessionName?: string;
  generatedAt?: string;
  [key: string]: unknown;
}

interface FastF1SessionRow {
  season: number;
  round: number;
  session: FastF1SessionCode;
  event_name: string | null;
  session_name: string | null;
  generated_at: string | null;
  imported_at: string;
  payload: FastF1Payload;
}

const DEFAULT_SESSIONS: FastF1SessionCode[] = ['R', 'Q', 'SQ', 'SS', 'S', 'FP1', 'FP2', 'FP3'];
const VALID_SESSIONS = new Set<FastF1SessionCode>(['R', 'Q', 'SQ', 'SS', 'S', 'FP1', 'FP2', 'FP3']);
const SESSION_ORDER: Record<FastF1SessionCode, number> = {
  FP1: 0,
  FP2: 1,
  FP3: 2,
  R: 3,
  Q: 4,
  SQ: 5,
  SS: 6,
  S: 7,
};

function consoleText(value: string | null | undefined) {
  return (value || '').replace(/[^\x20-\x7E]/g, (character) => {
    const hex = character.codePointAt(0)?.toString(16).padStart(4, '0') || '0000';
    return `\\u${hex}`;
  });
}

function printHelp() {
  console.log(`
Usage:
  npm run fastf1:import-sessions
  npm run fastf1:import-sessions -- --season 2025 --round 19
  npm run fastf1:import-sessions -- --from 2021 --to 2025 --session S
  npm run fastf1:import-sessions -- --season 2025 --round 19 --session Q --session SQ
  npm run fastf1:import-sessions -- --input public/fastf1 --dry-run

Description:
  Imports FastF1 exported JSON payloads into public.fastf1_session_analytics.
  By default it imports all supported exported sessions: R, Q, SQ, SS, S, FP1, FP2, FP3.

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (required; never use a browser anon key)
`);
}

function parseSession(value: string): FastF1SessionCode {
  const session = value.trim().toUpperCase() as FastF1SessionCode;
  if (!VALID_SESSIONS.has(session)) {
    throw new Error(`Unsupported FastF1 session "${value}". Use one of: ${[...VALID_SESSIONS].join(', ')}`);
  }

  return session;
}

function parseNumberFlag(flag: string, value: string | undefined) {
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }

  return parsed;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    sessions: [],
    inputRoot: 'public/fastf1',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--season') {
      parsed.season = parseNumberFlag(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--from') {
      parsed.seasonFrom = parseNumberFlag(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--to') {
      parsed.seasonTo = parseNumberFlag(arg, args[index + 1]);
      index += 1;
      continue;
    }

    if (arg === '--round') {
      parsed.round = parseNumberFlag(arg, args[index + 1]);
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

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  parsed.sessions = parsed.sessions.length ? [...new Set(parsed.sessions)] : DEFAULT_SESSIONS;
  if (parsed.season && (parsed.seasonFrom || parsed.seasonTo)) {
    throw new Error('Use either --season or --from/--to, not both.');
  }

  if (parsed.seasonFrom || parsed.seasonTo) {
    parsed.seasonFrom = parsed.seasonFrom ?? parsed.seasonTo;
    parsed.seasonTo = parsed.seasonTo ?? parsed.seasonFrom;
    if (!parsed.seasonFrom || !parsed.seasonTo || parsed.seasonFrom > parsed.seasonTo) {
      throw new Error('--from must be less than or equal to --to.');
    }
  }

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

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPayloadFiles(args: ParsedArgs) {
  const root = path.resolve(args.inputRoot);

  if (args.season && args.round) {
    const sessionFiles = args.sessions.map((session) => ({
      session,
      filePath: path.join(root, String(args.season), String(args.round), `${session}.json`),
    }));

    const existingFiles = [];
    for (const item of sessionFiles) {
      if (await pathExists(item.filePath)) {
        existingFiles.push(item.filePath);
      }
    }
    return existingFiles;
  }

  const files: string[] = [];
  const seasonFrom = args.season ?? args.seasonFrom;
  const seasonTo = args.season ?? args.seasonTo;

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

      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const relativePath = path.relative(root, fullPath).split(path.sep);
      const season = Number(relativePath[0]);
      if (
        seasonFrom
        && seasonTo
        && (!Number.isInteger(season) || season < seasonFrom || season > seasonTo)
      ) {
        continue;
      }

      const session = path.basename(entry.name, '.json').toUpperCase();
      if (args.sessions.includes(session as FastF1SessionCode)) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files.sort();
}

function readNumber(value: unknown, fallback: number, fieldName: string) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${fieldName}: ${String(value)}`);
  }

  return parsed;
}

function normalizePayload(
  payload: FastF1Payload,
  filePath: string,
  args: ParsedArgs,
): FastF1SessionRow {
  const session = parseSession(String(payload.session || path.basename(filePath, '.json')));
  const season = readNumber(payload.season, args.season ?? 0, 'season');
  const round = readNumber(payload.round, args.round ?? 0, 'round');
  const generatedAt = typeof payload.generatedAt === 'string' && payload.generatedAt
    ? payload.generatedAt
    : null;

  return {
    season,
    round,
    session,
    event_name: typeof payload.eventName === 'string' ? payload.eventName : null,
    session_name: typeof payload.sessionName === 'string' ? payload.sessionName : null,
    generated_at: generatedAt,
    imported_at: new Date().toISOString(),
    payload: {
      ...payload,
      season: String(season),
      round: String(round),
      session,
    },
  };
}

async function loadRows(files: string[], args: ParsedArgs) {
  const rows: FastF1SessionRow[] = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const payload = JSON.parse(raw) as FastF1Payload;
    rows.push(normalizePayload(payload, filePath, args));
  }

  return rows.sort((a, b) =>
    a.season - b.season
    || a.round - b.round
    || SESSION_ORDER[a.session] - SESSION_ORDER[b.session]
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const files = await findPayloadFiles(args);
  if (!files.length) {
    console.log('No FastF1 session JSON files found to import.');
    return;
  }

  const rows = await loadRows(files, args);
  console.log(`Prepared ${rows.length} FastF1 session analytics row(s):`);
  rows.forEach((row) => {
    console.log(`- ${row.season} round ${row.round} ${row.session}: ${consoleText(row.event_name) || 'Unknown event'}`);
  });

  if (args.dryRun) {
    console.log('Dry run complete; no database rows were written.');
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('fastf1_session_analytics')
    .upsert(rows, { onConflict: 'season,round,session' });

  if (error) {
    throw error;
  }

  console.log(`Imported ${rows.length} FastF1 session analytics row(s).`);
}

main().catch((error: unknown) => {
  if (
    typeof error === 'object'
    && error
    && 'code' in error
    && error.code === 'PGRST205'
  ) {
    console.error(
      'Missing table public.fastf1_session_analytics. Run scripts/sql/2026-04-26-fastf1-session-analytics.sql, then scripts/sql/2026-04-26-fastf1-session-analytics-temporary-import-policy.sql, and retry the import.',
    );
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
