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

interface ParsedArgs {
  apply: boolean;
  help: boolean;
}

interface DriverBaseRow {
  driver_id: string;
  total_points?: number | null;
  best_race_finish_position?: number | null;
}

interface ConstructorBaseRow {
  constructor_id: string;
  total_points?: number | null;
  best_race_finish_position?: number | null;
}

interface CircuitBaseRow {
  circuit_id: string;
  name: string | null;
  locality: string | null;
  country: string | null;
}

interface RaceBaseRow {
  id: number;
  circuit_id: string | null;
  circuit_name?: string | null;
  locality?: string | null;
  country?: string | null;
}

interface DriverComputedAggregate {
  driver_id: string;
  total_points: number;
  best_race_finish_position: number | null;
}

interface ConstructorComputedAggregate {
  constructor_id: string;
  total_points: number;
  best_race_finish_position: number | null;
}

interface RaceEnrichmentRow {
  id: number;
  circuit_name: string | null;
  locality: string | null;
  country: string | null;
}

function parseArgs(args: string[]): ParsedArgs {
  return {
    apply: args.includes('--apply'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function printHelp(): void {
  console.log(`
Usage:
  npx ts-node-esm ./scripts/audit-and-backfill-derived-data.ts
  npx ts-node-esm ./scripts/audit-and-backfill-derived-data.ts --apply

Description:
  Audits page-facing derived data gaps and optionally writes backfills.
  - drivers.total_points
  - drivers.best_race_finish_position
  - constructors.total_points
  - constructors.best_race_finish_position
  - races.circuit_name/locality/country
  - driver_history_summary
  - constructor_history_summary

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (required; never use a browser anon key)
`);
}

function isSupabaseError(error: unknown): error is { code?: string; message?: string } {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
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

function isMissingValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  return false;
}

function toNumericValue(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toPositionValue(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
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

async function upsertInBatches<T extends Record<string, unknown>>(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  let processed = 0;
  for (let from = 0; from < rows.length; from += PAGE_SIZE) {
    const batch = rows.slice(from, from + PAGE_SIZE);
    const { error } = await client
      .from(table)
      .upsert(batch, { onConflict });

    if (error) {
      throw error;
    }

    processed += batch.length;
  }

  return processed;
}

async function updateRowsByKey<T extends Record<string, unknown>>(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  rows: T[],
  keyColumn: keyof T & string,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  let processed = 0;
  for (let from = 0; from < rows.length; from += 50) {
    const batch = rows.slice(from, from + 50);
    await Promise.all(batch.map(async (row) => {
      const keyValue = row[keyColumn];
      const values = { ...row };
      delete values[keyColumn];

      const { error } = await client
        .from(table)
        .update(values)
        .eq(keyColumn, keyValue);

      if (error) {
        throw error;
      }
    }));

    processed += batch.length;
  }

  return processed;
}

async function hasTable(client: ReturnType<typeof createSupabaseAdminClient>, table: string): Promise<boolean> {
  const { error } = await client.from(table).select('*').limit(1);
  return !error;
}

async function hasColumns(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  columns: string,
): Promise<boolean> {
  const { error } = await client.from(table).select(columns).limit(1);
  return !error;
}

function buildDriverAggregates(raceResults: SummaryRaceResultRow[]): DriverComputedAggregate[] {
  const aggregates = new Map<string, DriverComputedAggregate>();

  raceResults.forEach((row) => {
    if (!row.driver_id) {
      return;
    }

    const existing = aggregates.get(row.driver_id) || {
      driver_id: row.driver_id,
      total_points: 0,
      best_race_finish_position: null,
    };

    existing.total_points += toNumericValue(row.points);

    const position = toPositionValue(row.position);
    if (position !== null) {
      if (existing.best_race_finish_position === null || position < existing.best_race_finish_position) {
        existing.best_race_finish_position = position;
      }
    }

    aggregates.set(row.driver_id, existing);
  });

  return [...aggregates.values()];
}

function buildConstructorAggregates(raceResults: SummaryRaceResultRow[]): ConstructorComputedAggregate[] {
  const aggregates = new Map<string, ConstructorComputedAggregate>();

  raceResults.forEach((row) => {
    if (!row.constructor_id) {
      return;
    }

    const existing = aggregates.get(row.constructor_id) || {
      constructor_id: row.constructor_id,
      total_points: 0,
      best_race_finish_position: null,
    };

    existing.total_points += toNumericValue(row.points);

    const position = toPositionValue(row.position);
    if (position !== null) {
      if (existing.best_race_finish_position === null || position < existing.best_race_finish_position) {
        existing.best_race_finish_position = position;
      }
    }

    aggregates.set(row.constructor_id, existing);
  });

  return [...aggregates.values()];
}

function buildRaceEnrichmentRows(races: RaceBaseRow[], circuits: CircuitBaseRow[]): RaceEnrichmentRow[] {
  const circuitById = new Map<string, CircuitBaseRow>();
  circuits.forEach((circuit) => {
    circuitById.set(circuit.circuit_id, circuit);
  });

  const rows: RaceEnrichmentRow[] = [];
  races.forEach((race) => {
    if (!race.circuit_id) {
      return;
    }

    const circuit = circuitById.get(race.circuit_id);
    if (!circuit) {
      return;
    }

    const needsBackfill = isMissingValue(race.circuit_name)
      || isMissingValue(race.locality)
      || isMissingValue(race.country);

    if (!needsBackfill) {
      return;
    }

    rows.push({
      id: race.id,
      circuit_name: circuit.name || null,
      locality: circuit.locality || null,
      country: circuit.country || null,
    });
  });

  return rows;
}

function collectMissingIds<TId extends string>(baseIds: TId[], existingIds: TId[]): TId[] {
  const existingSet = new Set(existingIds);
  return baseIds.filter((id) => !existingSet.has(id));
}

async function loadSummarySourceData(
  client: ReturnType<typeof createSupabaseAdminClient>,
): Promise<HistorySummarySourceData> {
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

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const client = createSupabaseAdminClient();

  const hasDriverDerivedColumns = await hasColumns(client, 'drivers', 'driver_id,total_points,best_race_finish_position');
  const hasConstructorDerivedColumns = await hasColumns(client, 'constructors', 'constructor_id,total_points,best_race_finish_position');
  const hasRaceDerivedColumns = await hasColumns(client, 'races', 'id,circuit_id,circuit_name,locality,country');

  console.log('Loading base rows...');
  const [driversRaw, constructorsRaw, circuits, racesRaw, raceResults] = await Promise.all([
    fetchAllRows<Record<string, unknown>>({
      client,
      table: 'drivers',
      columns: hasDriverDerivedColumns
        ? 'driver_id,total_points,best_race_finish_position'
        : 'driver_id',
      orderBy: 'driver_id',
    }),
    fetchAllRows<Record<string, unknown>>({
      client,
      table: 'constructors',
      columns: hasConstructorDerivedColumns
        ? 'constructor_id,total_points,best_race_finish_position'
        : 'constructor_id',
      orderBy: 'constructor_id',
    }),
    fetchAllRows<CircuitBaseRow>({
      client,
      table: 'circuits',
      columns: 'circuit_id,name,locality,country',
      orderBy: 'circuit_id',
    }),
    fetchAllRows<Record<string, unknown>>({
      client,
      table: 'races',
      columns: hasRaceDerivedColumns
        ? 'id,circuit_id,circuit_name,locality,country'
        : 'id,circuit_id',
      orderBy: 'id',
    }),
    fetchAllRows<SummaryRaceResultRow>({
      client,
      table: 'race_results',
      columns: 'race_id,driver_id,constructor_id,position,points',
      orderBy: 'id',
    }),
  ]);

  const drivers = driversRaw as DriverBaseRow[];
  const constructors = constructorsRaw as ConstructorBaseRow[];
  const races = racesRaw as RaceBaseRow[];

  const driverAggregates = buildDriverAggregates(raceResults);
  const constructorAggregates = buildConstructorAggregates(raceResults);
  const raceEnrichmentRows = buildRaceEnrichmentRows(races, circuits);

  const driverAggregateById = new Map(driverAggregates.map((row) => [row.driver_id, row]));
  const constructorAggregateById = new Map(constructorAggregates.map((row) => [row.constructor_id, row]));

  const missingDriverTotalPoints = hasDriverDerivedColumns
    ? drivers.filter((row) => isMissingValue(row.total_points) && driverAggregateById.has(row.driver_id))
    : drivers.filter((row) => driverAggregateById.has(row.driver_id));
  const missingDriverBestFinish = hasDriverDerivedColumns
    ? drivers.filter((row) => {
      const aggregate = driverAggregateById.get(row.driver_id);
      return isMissingValue(row.best_race_finish_position)
        && aggregate !== undefined
        && aggregate.best_race_finish_position !== null;
    })
    : drivers.filter((row) => {
      const aggregate = driverAggregateById.get(row.driver_id);
      return aggregate !== undefined && aggregate.best_race_finish_position !== null;
    });
  const missingConstructorTotalPoints = hasConstructorDerivedColumns
    ? constructors.filter((row) => isMissingValue(row.total_points) && constructorAggregateById.has(row.constructor_id))
    : constructors.filter((row) => constructorAggregateById.has(row.constructor_id));
  const missingConstructorBestFinish = hasConstructorDerivedColumns
    ? constructors.filter((row) => {
      const aggregate = constructorAggregateById.get(row.constructor_id);
      return isMissingValue(row.best_race_finish_position)
        && aggregate !== undefined
        && aggregate.best_race_finish_position !== null;
    })
    : constructors.filter((row) => {
      const aggregate = constructorAggregateById.get(row.constructor_id);
      return aggregate !== undefined && aggregate.best_race_finish_position !== null;
    });

  let missingDriverSummaries: string[] = [];
  let missingConstructorSummaries: string[] = [];
  let sourceData: HistorySummarySourceData | null = null;
  let payloads: ReturnType<typeof buildHistorySummaryPayloads> | null = null;

  const hasDriverHistorySummaryTable = await hasTable(client, 'driver_history_summary');
  const hasConstructorHistorySummaryTable = await hasTable(client, 'constructor_history_summary');

  if (hasDriverHistorySummaryTable && hasConstructorHistorySummaryTable) {
    console.log('Loading summary source data...');
    sourceData = await loadSummarySourceData(client);
    console.log(`Loaded official standings drivers=${sourceData.officialDriverStandings?.length || 0} constructors=${sourceData.officialConstructorStandings?.length || 0}`);
    payloads = buildHistorySummaryPayloads(sourceData);

    const [existingDriverSummaryRows, existingConstructorSummaryRows] = await Promise.all([
      fetchAllRows<{ driver_id: string }>({
        client,
        table: 'driver_history_summary',
        columns: 'driver_id',
        orderBy: 'driver_id',
      }),
      fetchAllRows<{ constructor_id: string }>({
        client,
        table: 'constructor_history_summary',
        columns: 'constructor_id',
        orderBy: 'constructor_id',
      }),
    ]);

    missingDriverSummaries = collectMissingIds(
      sourceData.drivers.map((row) => row.driver_id),
      existingDriverSummaryRows.map((row) => row.driver_id),
    );
    missingConstructorSummaries = collectMissingIds(
      sourceData.constructors.map((row) => row.constructor_id),
      existingConstructorSummaryRows.map((row) => row.constructor_id),
    );
  }

  console.log('\n=== Derived Data Audit ===');
  console.log(`drivers.total_points missing: ${missingDriverTotalPoints.length}`);
  console.log(`drivers.best_race_finish_position missing: ${missingDriverBestFinish.length}`);
  console.log(`constructors.total_points missing: ${missingConstructorTotalPoints.length}`);
  console.log(`constructors.best_race_finish_position missing: ${missingConstructorBestFinish.length}`);
  console.log(`races enrichment missing (circuit_name/locality/country): ${raceEnrichmentRows.length}`);
  if (hasDriverHistorySummaryTable) {
    console.log(`driver_history_summary missing rows: ${missingDriverSummaries.length}`);
  } else {
    console.log('driver_history_summary table missing');
  }
  if (hasConstructorHistorySummaryTable) {
    console.log(`constructor_history_summary missing rows: ${missingConstructorSummaries.length}`);
  } else {
    console.log('constructor_history_summary table missing');
  }
  if (!hasDriverDerivedColumns) {
    console.log('drivers derived columns missing: total_points,best_race_finish_position');
  }
  if (!hasConstructorDerivedColumns) {
    console.log('constructors derived columns missing: total_points,best_race_finish_position');
  }
  if (!hasRaceDerivedColumns) {
    console.log('races derived columns missing: circuit_name,locality,country');
  }
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY
    && hasDriverHistorySummaryTable
    && hasConstructorHistorySummaryTable
    && (missingDriverSummaries.length > 0 || missingConstructorSummaries.length > 0)
  ) {
    console.log('History summary rows may be hidden by RLS when using anon credentials.');
    console.log('Run scripts/sql/2026-04-23-history-summary-public-read-policy.sql if these rows were already backfilled.');
  }

  if (!options.apply) {
    console.log('\nDry run complete. Re-run with --apply to write backfills.');
    if (missingDriverSummaries.length > 0) {
      console.log(`driver_history_summary missing sample: ${missingDriverSummaries.slice(0, 10).join(', ')}`);
    }
    if (missingConstructorSummaries.length > 0) {
      console.log(`constructor_history_summary missing sample: ${missingConstructorSummaries.slice(0, 10).join(', ')}`);
    }
    return;
  }

  console.log('\nApplying backfills...');

  const driverUpdates = driverAggregates.map((item) => ({
    driver_id: item.driver_id,
    total_points: item.total_points,
    best_race_finish_position: item.best_race_finish_position,
  }));

  const constructorUpdates = constructorAggregates.map((item) => ({
    constructor_id: item.constructor_id,
    total_points: item.total_points,
    best_race_finish_position: item.best_race_finish_position,
  }));

  const appliedDriverRows = hasDriverDerivedColumns
    ? await updateRowsByKey(client, 'drivers', driverUpdates, 'driver_id')
    : 0;
  const appliedConstructorRows = hasConstructorDerivedColumns
    ? await updateRowsByKey(client, 'constructors', constructorUpdates, 'constructor_id')
    : 0;
  const appliedRaceRows = hasRaceDerivedColumns
    ? await updateRowsByKey(client, 'races', raceEnrichmentRows, 'id')
    : 0;

  let appliedDriverSummaryRows = 0;
  let appliedConstructorSummaryRows = 0;

  if (payloads && hasDriverHistorySummaryTable && hasConstructorHistorySummaryTable) {
    appliedDriverSummaryRows = await upsertInBatches(client, 'driver_history_summary', payloads.driverSummaries, 'driver_id');
    appliedConstructorSummaryRows = await upsertInBatches(client, 'constructor_history_summary', payloads.constructorSummaries, 'constructor_id');
  }

  console.log('\n=== Backfill Result ===');
  console.log(`drivers updated: ${appliedDriverRows}`);
  console.log(`constructors updated: ${appliedConstructorRows}`);
  console.log(`races updated: ${appliedRaceRows}`);
  console.log(`driver_history_summary upserted: ${appliedDriverSummaryRows}`);
  console.log(`constructor_history_summary upserted: ${appliedConstructorSummaryRows}`);
  if (!hasDriverHistorySummaryTable || !hasConstructorHistorySummaryTable) {
    console.log('History summary upsert skipped because summary tables are missing.');
  }
  if (!hasDriverDerivedColumns || !hasConstructorDerivedColumns || !hasRaceDerivedColumns) {
    console.log('Some backfills were skipped due to missing columns.');
    console.log('Run scripts/sql/2026-04-23-derived-data-bootstrap.sql and re-run this command.');
  }
}

main().catch((error) => {
  console.error('Audit/backfill failed:');
  console.error(error);
  if (isSupabaseError(error) && error.code === '42501') {
    console.error('');
    console.error('RLS denied the write. Use SUPABASE_SERVICE_ROLE_KEY; anonymous write policies are intentionally unsupported.');
  }
  process.exitCode = 1;
});
