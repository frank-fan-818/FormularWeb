import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type {
  HistorySummarySourceData,
  SummaryConstructorRow,
  SummaryDriverRow,
  SummaryQualifyingResultRow,
  SummaryRaceResultRow,
  SummaryRaceRow,
} from '../src/utils/historySummaryAggregation.ts';
import { buildHistorySummaryPayloads } from '../src/utils/historySummaryAggregation.ts';
import { loadF1DbOfficialStandings } from './f1db-official-standings.ts';

const PAGE_SIZE = 1000;

function printHelp(): void {
  console.log(`
Usage:
  npm run backfill:history-summaries
  npm run backfill:history-summaries -- --driver max_verstappen
  npm run backfill:history-summaries -- --constructor ferrari
  npm run backfill:history-summaries -- --driver max_verstappen --constructor ferrari --dry-run

Flags:
  --driver <id>         Refresh only the given driver_id, repeatable
  --constructor <id>    Refresh only the given constructor_id, repeatable
  --dry-run             Build payloads without writing to Supabase
  --help                Show this help message

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  Fallback: SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY
`);
}

function parseArgs(args: string[]): {
  driverIds: string[];
  constructorIds: string[];
  dryRun: boolean;
  help: boolean;
} {
  const driverIds: string[] = [];
  const constructorIds: string[] = [];
  let dryRun = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--driver') {
      const value = args[index + 1];
      if (value) {
        driverIds.push(value);
        index += 1;
      }
      continue;
    }

    if (arg === '--constructor') {
      const value = args[index + 1];
      if (value) {
        constructorIds.push(value);
        index += 1;
      }
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }

  return {
    driverIds: [...new Set(driverIds)],
    constructorIds: [...new Set(constructorIds)],
    dryRun,
    help,
  };
}

function createSupabaseAdminClient() {
  const envSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const envSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || '';

  if (!envSupabaseUrl || !envSupabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  }

  return createClient(envSupabaseUrl, envSupabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchAllRows<T>(params: {
  client: ReturnType<typeof createSupabaseAdminClient>;
  table: string;
  columns: string;
  orderBy: string;
}): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await params.client
      .from(params.table)
      .select(params.columns)
      .order(params.orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data || []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

async function loadSourceData(client: ReturnType<typeof createSupabaseAdminClient>): Promise<HistorySummarySourceData> {
  const officialStandings = loadF1DbOfficialStandings();
  const [drivers, constructors, races, raceResults, qualifyingResults] = await Promise.all([
    fetchAllRows<SummaryDriverRow>({
      client,
      table: 'drivers',
      columns: 'driver_id,first_name,last_name,code,permanent_number,date_of_birth,nationality',
      orderBy: 'driver_id',
    }),
    fetchAllRows<SummaryConstructorRow>({
      client,
      table: 'constructors',
      columns: 'constructor_id,name,nationality',
      orderBy: 'constructor_id',
    }),
    fetchAllRows<SummaryRaceRow>({
      client,
      table: 'races',
      columns: 'id,season,round,date,time',
      orderBy: 'id',
    }),
    fetchAllRows<SummaryRaceResultRow>({
      client,
      table: 'race_results',
      columns: 'race_id,driver_id,constructor_id,position,points,status',
      orderBy: 'id',
    }),
    fetchAllRows<SummaryQualifyingResultRow>({
      client,
      table: 'qualifying_results',
      columns: 'race_id,driver_id,constructor_id,position',
      orderBy: 'id',
    }),
  ]);

  return {
    drivers,
    constructors,
    races,
    raceResults,
    qualifyingResults,
    ...officialStandings,
  };
}

function filterDriverSummaries<T extends { driver_id: string }>(rows: T[], driverIds: string[]): T[] {
  if (driverIds.length === 0) {
    return rows;
  }

  const idSet = new Set(driverIds);
  return rows.filter((row) => idSet.has(row.driver_id));
}

function filterConstructorSummaries<T extends { constructor_id: string }>(rows: T[], constructorIds: string[]): T[] {
  if (constructorIds.length === 0) {
    return rows;
  }

  const idSet = new Set(constructorIds);
  return rows.filter((row) => idSet.has(row.constructor_id));
}

async function upsertInBatches<T extends Record<string, unknown>>(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  for (let start = 0; start < rows.length; start += PAGE_SIZE) {
    const batch = rows.slice(start, start + PAGE_SIZE);
    const { error } = await client
      .from(table)
      .upsert(batch, {
        onConflict,
      });

    if (error) {
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. The script will fall back to anon credentials and may hit write-permission limits.');
  }

  const client = createSupabaseAdminClient();

  console.log('Loading source data from Supabase...');
  const sourceData = await loadSourceData(client);
  console.log(`Loaded drivers=${sourceData.drivers.length} constructors=${sourceData.constructors.length} races=${sourceData.races.length} race_results=${sourceData.raceResults.length} qualifying_results=${sourceData.qualifyingResults.length}`);
  console.log(`Loaded official standings drivers=${sourceData.officialDriverStandings?.length || 0} constructors=${sourceData.officialConstructorStandings?.length || 0}`);

  const payloads = buildHistorySummaryPayloads(sourceData);
  const driverSummaries = filterDriverSummaries(payloads.driverSummaries, options.driverIds);
  const constructorSummaries = filterConstructorSummaries(payloads.constructorSummaries, options.constructorIds);

  console.log(`Built driver summaries=${driverSummaries.length} constructor summaries=${constructorSummaries.length}`);

  if (options.dryRun) {
    console.log('Dry run mode, no writes will be sent.');
    console.log('driver sample:', driverSummaries.slice(0, 2).map((item) => item.driver_id));
    console.log('constructor sample:', constructorSummaries.slice(0, 2).map((item) => item.constructor_id));
    return;
  }

  console.log('Writing driver_history_summary...');
  await upsertInBatches(client, 'driver_history_summary', driverSummaries, 'driver_id');

  console.log('Writing constructor_history_summary...');
  await upsertInBatches(client, 'constructor_history_summary', constructorSummaries, 'constructor_id');

  console.log('History summary refresh completed.');
}

main().catch((error) => {
  console.error('History summary refresh failed:');
  console.error(error);
  process.exitCode = 1;
});
