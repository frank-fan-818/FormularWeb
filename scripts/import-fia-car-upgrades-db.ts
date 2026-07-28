import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import type { FiaCarUpgradeRecord } from '../src/utils/fiaCarUpgrades.ts';

interface ParsedArgs {
  input: string;
  dryRun: boolean;
  replace: boolean;
  batchSize: number;
  help: boolean;
}

interface FiaUpgradeArtifact {
  records?: FiaCarUpgradeRecord[];
}

interface FiaCarUpgradeRow {
  source_record_key: string;
  season: number;
  round: number | null;
  grand_prix: string | null;
  team: string;
  constructor_id: string | null;
  car_number: string | null;
  area: string | null;
  component: string | null;
  primary_reason: string;
  geometric_differences: string | null;
  description: string | null;
  component_importance: number;
  confidence: number;
  source_type: 'FIA' | 'FIA_TECH_UPDATE';
  document_title: string | null;
  document_url: string | null;
  source_path: string | null;
  raw_text: string;
  imported_at: string;
}

const DEFAULT_INPUT = 'docs/model-artifacts/fia-car-upgrades.json';
const DEFAULT_BATCH_SIZE = 250;

function printHelp() {
  console.log(`
Usage:
  npm run fia:import-upgrades-db
  npm run fia:import-upgrades-db -- --input docs/model-artifacts/fia-car-upgrades.json
  npm run fia:import-upgrades-db -- --input docs/model-artifacts/fia-car-upgrades-2022-2026.json --replace
  npm run fia:import-upgrades-db -- --dry-run

Description:
  Imports parsed FIA Car Presentation Submissions records into public.fia_car_upgrades.

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (required; never use a browser anon key)
`);
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    input: DEFAULT_INPUT,
    dryRun: false,
    replace: false,
    batchSize: DEFAULT_BATCH_SIZE,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--input') {
      const value = args[index + 1];
      if (!value) {
        throw new Error('--input requires a file path.');
      }
      parsed.input = value;
      index += 1;
      continue;
    }
    if (arg === '--batch-size') {
      parsed.batchSize = parsePositiveInteger(arg, args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (arg === '--replace') {
      parsed.replace = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
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

async function loadRows(input: string): Promise<FiaCarUpgradeRow[]> {
  const artifact = JSON.parse(await readFile(input, 'utf8')) as FiaUpgradeArtifact;
  return (artifact.records || []).map(toDatabaseRow);
}

function toDatabaseRow(record: FiaCarUpgradeRecord): FiaCarUpgradeRow {
  return {
    source_record_key: buildRecordKey(record),
    season: record.season,
    round: record.round ?? null,
    grand_prix: record.grandPrix || null,
    team: record.team,
    constructor_id: normalizeConstructorId(record.team),
    car_number: record.carNumber || null,
    area: record.area || null,
    component: record.component || null,
    primary_reason: record.primaryReason,
    geometric_differences: record.geometricDifferences || null,
    description: record.description || null,
    component_importance: record.componentImportance,
    confidence: record.confidence,
    source_type: record.sourceType,
    document_title: record.documentTitle || null,
    document_url: record.documentUrl || null,
    source_path: record.sourcePath || null,
    raw_text: record.rawText,
    imported_at: new Date().toISOString(),
  };
}

async function upsertRows(rows: FiaCarUpgradeRow[], batchSize: number, replace: boolean) {
  const supabase = createSupabaseAdminClient();
  let imported = 0;

  if (replace) {
    const { error } = await supabase
      .from('fia_car_upgrades')
      .delete()
      .or('season.gte.1900,round.is.null');

    if (error) {
      throw error;
    }

    console.log('Cleared existing FIA upgrade rows.');
  }

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase
      .from('fia_car_upgrades')
      .upsert(batch, { onConflict: 'source_record_key' });

    if (error) {
      throw error;
    }

    imported += batch.length;
    console.log(`Imported ${imported}/${rows.length} FIA upgrade row(s).`);
  }
}

function buildRecordKey(record: FiaCarUpgradeRecord): string {
  const input = [
    record.team,
    record.carNumber ?? '',
    record.component ?? '',
    record.primaryReason,
    record.description ?? '',
    record.documentUrl ?? record.sourcePath ?? '',
    record.rawText,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}

function normalizeConstructorId(team: string): string | null {
  const normalized = team.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized.includes('red_bull')) return 'red_bull';
  if (normalized.includes('racing_bulls') || normalized.includes('visa_cash_app_rb')) return 'rb';
  if (normalized.includes('aston_martin')) return 'aston_martin';
  if (normalized.includes('kick_sauber') || normalized.includes('stake') || normalized.includes('sauber')) return 'sauber';
  if (normalized.includes('alfa_romeo')) return 'alfa_romeo';
  if (normalized.includes('mercedes')) return 'mercedes';
  if (normalized.includes('mclaren')) return 'mclaren';
  if (normalized.includes('ferrari')) return 'ferrari';
  if (normalized.includes('alpine') || normalized.includes('renault')) return 'alpine';
  if (normalized.includes('williams')) return 'williams';
  if (normalized.includes('haas')) return 'haas';
  return normalized || null;
}

function parsePositiveInteger(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const rows = await loadRows(args.input);
  if (args.dryRun) {
    console.log(`Dry run: ${rows.length} FIA upgrade row(s) ready from ${args.input}.`);
    console.log(`Teams: ${[...new Set(rows.map((row) => row.team))].join(', ') || 'none'}`);
    return;
  }

  if (!rows.length) {
    console.log(`No FIA upgrade rows found in ${args.input}.`);
    return;
  }

  await upsertRows(rows, args.batchSize, args.replace);
  console.log(`Done. Upserted ${rows.length} FIA upgrade row(s) into public.fia_car_upgrades.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
