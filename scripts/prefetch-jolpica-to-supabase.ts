import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const API_INTERVAL_MS = 200;

// ---------------------------------------------------------------------------
// Table DDL (used by auto-creation and printed as a fallback)
// ---------------------------------------------------------------------------

const CREATE_DRIVER_STANDINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.season_driver_standings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season INT NOT NULL,
  position INT NOT NULL,
  driver_id TEXT NOT NULL,
  permanent_number TEXT,
  code TEXT,
  given_name TEXT NOT NULL,
  family_name TEXT NOT NULL,
  date_of_birth TEXT,
  nationality TEXT,
  constructor_id TEXT NOT NULL,
  constructor_name TEXT NOT NULL,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  CONSTRAINT season_driver_standings_unique UNIQUE (season, driver_id)
);

CREATE INDEX IF NOT EXISTS season_driver_standings_season_idx
  ON public.season_driver_standings (season);

CREATE INDEX IF NOT EXISTS season_driver_standings_driver_idx
  ON public.season_driver_standings (driver_id);

ALTER TABLE public.season_driver_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "season driver standings public read" ON public.season_driver_standings;
CREATE POLICY "season driver standings public read"
  ON public.season_driver_standings
  FOR SELECT
  USING (true);
`;

const CREATE_CONSTRUCTOR_STANDINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.season_constructor_standings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season INT NOT NULL,
  position INT NOT NULL,
  constructor_id TEXT NOT NULL,
  constructor_name TEXT NOT NULL,
  nationality TEXT,
  points DOUBLE PRECISION NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  CONSTRAINT season_constructor_standings_unique UNIQUE (season, constructor_id)
);

CREATE INDEX IF NOT EXISTS season_constructor_standings_season_idx
  ON public.season_constructor_standings (season);

CREATE INDEX IF NOT EXISTS season_constructor_standings_constructor_idx
  ON public.season_constructor_standings (constructor_id);

ALTER TABLE public.season_constructor_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "season constructor standings public read" ON public.season_constructor_standings;
CREATE POLICY "season constructor standings public read"
  ON public.season_constructor_standings
  FOR SELECT
  USING (true);
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedArgs {
  dryRun: boolean;
  help: boolean;
  season: number | undefined;
  seasonFrom: number | undefined;
  seasonTo: number | undefined;
  verbose: boolean;
}

/** Shape returned by the Jolpica seasons endpoint. */
interface JolpicaSeason {
  season: string;
  url: string;
}

/** Shape of a DriverStanding entry from Jolpica. */
interface JolpicaDriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: {
    driverId: string;
    permanentNumber?: string;
    code?: string;
    givenName: string;
    familyName: string;
    dateOfBirth?: string;
    nationality?: string;
  };
  Constructors: Array<{
    constructorId: string;
    name: string;
    nationality?: string;
  }>;
}

/** Shape of a ConstructorStanding entry from Jolpica. */
interface JolpicaConstructorStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: {
    constructorId: string;
    name: string;
    nationality?: string;
  };
}

/** Generic Jolpica API response wrapper. */
interface JolpicaResponse {
  MRData: {
    total: string;
    SeasonTable?: { Seasons: JolpicaSeason[] };
    StandingsTable?: {
      season: string;
      StandingsLists: Array<{
        season: string;
        round: string;
        DriverStandings?: JolpicaDriverStanding[];
        ConstructorStandings?: JolpicaConstructorStanding[];
      }>;
    };
  };
}

/** Row shape for the season_driver_standings table. */
interface DriverStandingRow {
  season: number;
  position: number;
  driver_id: string;
  permanent_number: string | null;
  code: string | null;
  given_name: string;
  family_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  constructor_id: string;
  constructor_name: string;
  points: number;
  wins: number;
}

/** Row shape for the season_constructor_standings table. */
interface ConstructorStandingRow {
  season: number;
  position: number;
  constructor_id: string;
  constructor_name: string;
  nationality: string | null;
  points: number;
  wins: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
Usage:
  npm run prefetch:standings
  npm run prefetch:standings -- --season 2024
  npm run prefetch:standings -- --from 2020 --to 2024
  npm run prefetch:standings -- --dry-run --season 2024
  npm run prefetch:standings -- --dry-run --verbose

Description:
  Pre-fetches season driver and constructor standings from the Jolpica Ergast
  API and stores them in Supabase tables (season_driver_standings and
  season_constructor_standings) so the frontend can read from Supabase instead
  of hitting the external API on every page load.

Flags:
  --dry-run        Print what would be inserted without writing to the database.
  --season <N>     Process only a single season.
  --from <N>       Process seasons starting from this year (inclusive).
  --to <N>         Process seasons up to this year (inclusive).
  --verbose        When used with --dry-run, prints full row details.
  -h, --help       Show this help message.

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (recommended — required for table creation)
  Fallback: SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY

Tables:
  Run scripts/sql/2026-06-04-standings-tables.sql in your Supabase SQL editor
  to set up the tables and RLS policies before the first run.
`);
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    dryRun: false,
    help: false,
    season: undefined,
    seasonFrom: undefined,
    seasonTo: undefined,
    verbose: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      parsed.verbose = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--season') {
      const value = args[index + 1];
      const num = Number(value);
      if (!value || !Number.isInteger(num) || num <= 0) {
        throw new Error('--season requires a positive integer.');
      }
      parsed.season = num;
      index += 1;
      continue;
    }

    if (arg === '--from') {
      const value = args[index + 1];
      const num = Number(value);
      if (!value || !Number.isInteger(num) || num <= 0) {
        throw new Error('--from requires a positive integer.');
      }
      parsed.seasonFrom = num;
      index += 1;
      continue;
    }

    if (arg === '--to') {
      const value = args[index + 1];
      const num = Number(value);
      if (!value || !Number.isInteger(num) || num <= 0) {
        throw new Error('--to requires a positive integer.');
      }
      parsed.seasonTo = num;
      index += 1;
      continue;
    }
  }

  if (parsed.season !== undefined && (parsed.seasonFrom !== undefined || parsed.seasonTo !== undefined)) {
    throw new Error('Use either --season or --from/--to, not both.');
  }

  if (parsed.seasonFrom !== undefined || parsed.seasonTo !== undefined) {
    parsed.seasonFrom = parsed.seasonFrom ?? parsed.seasonTo;
    parsed.seasonTo = parsed.seasonTo ?? parsed.seasonFrom;
    if (parsed.seasonFrom > parsed.seasonTo) {
      throw new Error('--from must be less than or equal to --to.');
    }
  }

  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function parseNumeric(value: string | number | undefined | null, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function emptyStringToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  return value.trim() || null;
}

// ---------------------------------------------------------------------------
// Jolpica API
// ---------------------------------------------------------------------------

async function fetchJolpica<T>(path: string): Promise<T> {
  const url = `${JOLPICA_BASE_URL}${path}`;
  const response = await axios.get<{ MRData: T }>(url);
  return response.data.MRData;
}

async function fetchAllSeasons(): Promise<JolpicaSeason[]> {
  const mrData = await fetchJolpica<{
    total: string;
    SeasonTable?: { Seasons: JolpicaSeason[] };
  }>('/seasons.json?limit=200');

  return mrData.SeasonTable?.Seasons || [];
}

async function fetchDriverStandingsForSeason(
  season: number,
): Promise<JolpicaDriverStanding[]> {
  const mrData = await fetchJolpica<{
    total: string;
    StandingsTable?: {
      season: string;
      StandingsLists: Array<{
        season: string;
        round: string;
        DriverStandings?: JolpicaDriverStanding[];
      }>;
    };
  }>(`/${season}/driverStandings.json`);

  return mrData.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
}

async function fetchConstructorStandingsForSeason(
  season: number,
): Promise<JolpicaConstructorStanding[]> {
  const mrData = await fetchJolpica<{
    total: string;
    StandingsTable?: {
      season: string;
      StandingsLists: Array<{
        season: string;
        round: string;
        ConstructorStandings?: JolpicaConstructorStanding[];
      }>;
    };
  }>(`/${season}/constructorStandings.json`);

  return mrData.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
}

// ---------------------------------------------------------------------------
// Data transformation
// ---------------------------------------------------------------------------

function transformDriverStanding(
  season: number,
  standing: JolpicaDriverStanding,
): DriverStandingRow {
  const constructor = standing.Constructors?.[0];

  return {
    season,
    position: parseInt(standing.position, 10) || 0,
    driver_id: standing.Driver.driverId,
    permanent_number: emptyStringToNull(standing.Driver.permanentNumber),
    code: emptyStringToNull(standing.Driver.code),
    given_name: standing.Driver.givenName,
    family_name: standing.Driver.familyName,
    date_of_birth: emptyStringToNull(standing.Driver.dateOfBirth),
    nationality: emptyStringToNull(standing.Driver.nationality),
    constructor_id: constructor?.constructorId || '',
    constructor_name: constructor?.name || '',
    points: parseNumeric(standing.points, 0),
    wins: parseInt(standing.wins, 10) || 0,
  };
}

function transformConstructorStanding(
  season: number,
  standing: JolpicaConstructorStanding,
): ConstructorStandingRow {
  return {
    season,
    position: parseInt(standing.position, 10) || 0,
    constructor_id: standing.Constructor.constructorId,
    constructor_name: standing.Constructor.name,
    nationality: emptyStringToNull(standing.Constructor.nationality),
    points: parseNumeric(standing.points, 0),
    wins: parseInt(standing.wins, 10) || 0,
  };
}

// ---------------------------------------------------------------------------
// Table existence / auto-creation
// ---------------------------------------------------------------------------

const EXEC_SQL_FUNCTION_DDL = `
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`;

async function ensureTableExists(
  supabase: SupabaseClient,
  tableName: string,
  createSql: string,
): Promise<void> {
  // Check whether the table already exists via a lightweight HEAD request.
  const { error: checkError } = await supabase
    .from(tableName)
    .select('*', { head: true, count: 'exact' });

  if (!checkError) {
    console.log(`  Table "${tableName}" found.`);
    return;
  }

  // PGRST205 = relation does not exist; anything else is unexpected.
  if (checkError.code !== 'PGRST205') {
    console.warn(`  Unexpected error checking table "${tableName}":`, checkError.message);
    throw checkError;
  }

  console.log(`  Table "${tableName}" does not exist. Attempting auto-creation via exec_sql RPC...`);

  // Try auto-creating via the exec_sql Postgres function.
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createSql });

  if (rpcError) {
    console.error('');
    console.error(`  Could not auto-create table "${tableName}". The exec_sql RPC may not exist.`);
    console.error(`  Either run the SQL below in your Supabase dashboard, or create the`);
    console.error(`  exec_sql function first:\n`);
    console.error(`  ${EXEC_SQL_FUNCTION_DDL.replace(/\n/g, '\n  ')}`);
    console.error(`  Then run the full migration:\n`);
    console.error(`  scripts/sql/2026-06-04-standings-tables.sql\n`);
    throw new Error(`Table "${tableName}" is missing and could not be created automatically.`);
  }

  console.log(`  Table "${tableName}" created successfully.`);
}

// ---------------------------------------------------------------------------
// Dry-run output helpers
// ---------------------------------------------------------------------------

function describeDriverRow(row: DriverStandingRow): string {
  return `P${String(row.position).padStart(2)}: ${row.given_name} ${row.family_name} (${row.constructor_name}) - ${row.points} pts, ${row.wins} wins`;
}

function describeConstructorRow(row: ConstructorStandingRow): string {
  return `P${String(row.position).padStart(2)}: ${row.constructor_name} - ${row.points} pts, ${row.wins} wins`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  // --------------------------------------------------
  // 1. Supabase client
  // --------------------------------------------------

  console.log('Initializing Supabase admin client...');
  const supabase = createSupabaseAdminClient();
  console.log('  Connected.');

  // --------------------------------------------------
  // 2. Ensure tables exist (skip in dry-run mode)
  // --------------------------------------------------

  if (!args.dryRun) {
    console.log('Checking required tables...');
    await ensureTableExists(supabase, 'season_driver_standings', CREATE_DRIVER_STANDINGS_TABLE_SQL);
    await ensureTableExists(supabase, 'season_constructor_standings', CREATE_CONSTRUCTOR_STANDINGS_TABLE_SQL);
  } else {
    console.log('Dry-run mode: skipping table checks.\n');
  }

  // --------------------------------------------------
  // 3. Fetch seasons list
  // --------------------------------------------------

  console.log('\nFetching seasons from Jolpica API...');
  const allSeasons = await fetchAllSeasons();

  if (allSeasons.length === 0) {
    console.log('No seasons returned by Jolpica API. Nothing to do.');
    return;
  }

  // Filter by the requested range.
  const seasons = allSeasons
    .map((s) => parseInt(s.season, 10))
    .filter((year) => {
      if (args.season !== undefined) return year === args.season;
      if (args.seasonFrom !== undefined && year < args.seasonFrom) return false;
      if (args.seasonTo !== undefined && year > args.seasonTo) return false;
      return true;
    })
    .sort((a, b) => b - a); // newest first

  console.log(`  ${allSeasons.length} total seasons available, processing ${seasons.length} season(s).`);

  // --------------------------------------------------
  // 4. Process each season
  // --------------------------------------------------

  let totalDriverRows = 0;
  let totalConstructorRows = 0;

  for (const [index, season] of seasons.entries()) {
    console.log(`\n[${index + 1}/${seasons.length}] Season ${season}:`);

    // Fetch both standings in parallel.
    const [rawDriverStandings, rawConstructorStandings] = await Promise.all([
      fetchDriverStandingsForSeason(season),
      fetchConstructorStandingsForSeason(season),
    ]);

    const driverRows = rawDriverStandings.map((s) => transformDriverStanding(season, s));
    const constructorRows = rawConstructorStandings.map((s) =>
      transformConstructorStanding(season, s),
    );

    console.log(`  Driver standings: ${driverRows.length} driver(s)`);
    console.log(`  Constructor standings: ${constructorRows.length} constructor(s)`);

    // Dry-run output.
    if (args.dryRun) {
      if (args.verbose) {
        console.log('  [DRY RUN] Drivers:');
        driverRows.slice(0, 5).forEach((row) => {
          console.log(`    ${describeDriverRow(row)}`);
        });
        if (driverRows.length > 5) {
          console.log(`    ... and ${driverRows.length - 5} more`);
        }

        console.log('  [DRY RUN] Constructors:');
        constructorRows.slice(0, 5).forEach((row) => {
          console.log(`    ${describeConstructorRow(row)}`);
        });
        if (constructorRows.length > 5) {
          console.log(`    ... and ${constructorRows.length - 5} more`);
        }
      } else {
        console.log('  [DRY RUN] Would upsert these rows to Supabase.');
      }

      totalDriverRows += driverRows.length;
      totalConstructorRows += constructorRows.length;

      // Still wait between API calls even in dry-run mode to be polite.
      if (index < seasons.length - 1) {
        await sleep(API_INTERVAL_MS);
      }
      continue;
    }

    // --------------------------------------------------
    // 5a. Upsert driver standings
    // --------------------------------------------------

    if (driverRows.length > 0) {
      // Batch in chunks of 100 to stay within Supabase request size limits.
      const batchSize = 100;
      for (let start = 0; start < driverRows.length; start += batchSize) {
        const batch = driverRows.slice(start, start + batchSize);
        const { error: upsertError } = await supabase
          .from('season_driver_standings')
          .upsert(batch, { onConflict: 'season,driver_id' });

        if (upsertError) {
          throw new Error(
            `Failed to upsert driver standings for season ${season} (batch ${start / batchSize + 1}): ${upsertError.message}`,
          );
        }
      }

      console.log(`  Upserted ${driverRows.length} driver standing row(s).`);
    }

    // --------------------------------------------------
    // 5b. Upsert constructor standings
    // --------------------------------------------------

    if (constructorRows.length > 0) {
      const batchSize = 100;
      for (let start = 0; start < constructorRows.length; start += batchSize) {
        const batch = constructorRows.slice(start, start + batchSize);
        const { error: upsertError } = await supabase
          .from('season_constructor_standings')
          .upsert(batch, { onConflict: 'season,constructor_id' });

        if (upsertError) {
          throw new Error(
            `Failed to upsert constructor standings for season ${season} (batch ${start / batchSize + 1}): ${upsertError.message}`,
          );
        }
      }

      console.log(`  Upserted ${constructorRows.length} constructor standing row(s).`);
    }

    totalDriverRows += driverRows.length;
    totalConstructorRows += constructorRows.length;

    // Rate-limit between seasons.
    if (index < seasons.length - 1) {
      await sleep(API_INTERVAL_MS);
    }
  }

  // --------------------------------------------------
  // 6. Summary
  // --------------------------------------------------

  console.log('\n--- Summary ---');

  if (args.dryRun) {
    console.log(`Dry-run: would process ${totalDriverRows} driver and ${totalConstructorRows} constructor standing rows across ${seasons.length} season(s).`);
    console.log('No database rows were written.');
  } else {
    console.log(`Imported ${totalDriverRows} driver and ${totalConstructorRows} constructor standing rows across ${seasons.length} season(s).`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch((error: unknown) => {
  if (typeof error === 'object' && error && 'code' in error && error.code === 'PGRST205') {
    console.error(
      '\nOne or more Supabase tables are missing. Run scripts/sql/2026-06-04-standings-tables.sql in your Supabase SQL editor, then retry.',
    );
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(`\nError: ${error.message}`);
  } else {
    console.error(`\nUnexpected error:`, error);
  }

  process.exitCode = 1;
});
