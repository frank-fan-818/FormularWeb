import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

type Row = Record<string, unknown>;

type FieldCheck = {
  label: string;
  columns: string[];
  severity: 'P0' | 'P1' | 'P2';
  displayImpact: string;
};

type TableCheck = {
  table: string;
  key: string;
  columns: string[];
  fields: FieldCheck[];
};

type FieldResult = FieldCheck & {
  missingCount: number | null;
  missingPct: number | null;
  sampleKeys: string[];
  error?: string;
};

type TableResult = {
  table: string;
  totalRows: number | null;
  fields: FieldResult[];
  error?: string;
};

const PAGE_SIZE = 1000;
const REPORT_PATH = path.resolve('docs/database-completeness-audit.md');

const TABLE_CHECKS: TableCheck[] = [
  {
    table: 'circuits',
    key: 'circuit_id',
    columns: [
      'circuit_id',
      'name',
      'locality',
      'country',
      'lat',
      'long',
      'length',
      'turns',
      'first_race',
      'total_races',
      'race_laps',
      'total_distance',
      'lap_record',
      'lap_record_driver',
      'lap_record_year',
      'direction',
    ],
    fields: [
      { label: 'name', columns: ['name'], severity: 'P0', displayImpact: 'Circuit names render blank in lists/detail pages.' },
      { label: 'location', columns: ['locality'], severity: 'P1', displayImpact: 'Circuit subtitle loses city/locality.' },
      { label: 'country', columns: ['country'], severity: 'P1', displayImpact: 'Circuit subtitle loses country.' },
      { label: 'coordinates', columns: ['lat', 'long'], severity: 'P2', displayImpact: 'Maps or location metadata cannot be added reliably.' },
      { label: 'length', columns: ['length'], severity: 'P1', displayImpact: 'Circuit detail length shows pending data.' },
      { label: 'turns', columns: ['turns'], severity: 'P1', displayImpact: 'Circuit detail turn count falls back or shows pending data.' },
      { label: 'direction', columns: ['direction'], severity: 'P1', displayImpact: 'Circuit detail direction can show pending data or rely on local fallback.' },
      { label: 'race_laps', columns: ['race_laps'], severity: 'P2', displayImpact: 'Length derivation from race distance is less reliable.' },
      { label: 'total_distance', columns: ['total_distance'], severity: 'P2', displayImpact: 'Circuit detail race distance shows pending data.' },
      { label: 'lap_record', columns: ['lap_record'], severity: 'P2', displayImpact: 'Lap record panel is hidden.' },
    ],
  },
  {
    table: 'drivers',
    key: 'driver_id',
    columns: [
      'driver_id',
      'first_name',
      'last_name',
      'nationality',
      'date_of_birth',
      'permanent_number',
      'code',
      'total_wins',
      'total_podiums',
      'total_pole_positions',
      'total_fastest_laps',
      'total_race_starts',
    ],
    fields: [
      { label: 'first_name', columns: ['first_name'], severity: 'P0', displayImpact: 'Driver names render incomplete.' },
      { label: 'last_name', columns: ['last_name'], severity: 'P0', displayImpact: 'Driver names render incomplete.' },
      { label: 'nationality', columns: ['nationality'], severity: 'P1', displayImpact: 'Driver profile nationality and search subtitles degrade.' },
      { label: 'date_of_birth', columns: ['date_of_birth'], severity: 'P2', displayImpact: 'Driver profile metadata is incomplete.' },
      { label: 'total_race_starts', columns: ['total_race_starts'], severity: 'P1', displayImpact: 'Driver stat cards may show zero or pending data.' },
      { label: 'total_podiums', columns: ['total_podiums'], severity: 'P1', displayImpact: 'Driver stat cards may show zero or pending data.' },
    ],
  },
  {
    table: 'constructors',
    key: 'constructor_id',
    columns: [
      'constructor_id',
      'name',
      'nationality',
      'total_wins',
      'total_podiums',
      'total_pole_positions',
      'total_fastest_laps',
      'total_race_entries',
    ],
    fields: [
      { label: 'name', columns: ['name'], severity: 'P0', displayImpact: 'Constructor names render blank.' },
      { label: 'nationality', columns: ['nationality'], severity: 'P1', displayImpact: 'Constructor profile nationality and search subtitles degrade.' },
      { label: 'total_race_entries', columns: ['total_race_entries'], severity: 'P1', displayImpact: 'Constructor stat cards may show zero or pending data.' },
      { label: 'total_podiums', columns: ['total_podiums'], severity: 'P1', displayImpact: 'Constructor stat cards may show zero or pending data.' },
    ],
  },
  {
    table: 'races',
    key: 'id',
    columns: [
      'id',
      'season',
      'round',
      'race_name',
      'circuit_id',
      'circuit_name',
      'locality',
      'country',
      'date',
      'time',
      'is_sprint_weekend',
    ],
    fields: [
      { label: 'season', columns: ['season'], severity: 'P0', displayImpact: 'Race schedule grouping fails.' },
      { label: 'round', columns: ['round'], severity: 'P0', displayImpact: 'Race routes and sorting can break.' },
      { label: 'race_name', columns: ['race_name'], severity: 'P0', displayImpact: 'Race cards render blank titles.' },
      { label: 'circuit_id', columns: ['circuit_id'], severity: 'P0', displayImpact: 'Race-to-circuit detail joins fail.' },
      { label: 'circuit_name', columns: ['circuit_name'], severity: 'P1', displayImpact: 'Race list/detail circuit labels may fall back.' },
      { label: 'date', columns: ['date'], severity: 'P0', displayImpact: 'Schedule and countdown displays fail.' },
      { label: 'time', columns: ['time'], severity: 'P2', displayImpact: 'Race time may show date-only fallback.' },
    ],
  },
  {
    table: 'race_results',
    key: 'id',
    columns: ['id', 'race_id', 'position', 'driver_id', 'constructor_id', 'points', 'grid', 'laps', 'status', 'time'],
    fields: [
      { label: 'race_id', columns: ['race_id'], severity: 'P0', displayImpact: 'Race result joins fail.' },
      { label: 'position', columns: ['position'], severity: 'P0', displayImpact: 'Result tables cannot sort/display positions.' },
      { label: 'driver_id', columns: ['driver_id'], severity: 'P0', displayImpact: 'Result rows cannot link to drivers.' },
      { label: 'constructor_id', columns: ['constructor_id'], severity: 'P1', displayImpact: 'Result rows cannot link to constructors.' },
      { label: 'points', columns: ['points'], severity: 'P1', displayImpact: 'Points columns and summaries are incomplete.' },
    ],
  },
  {
    table: 'qualifying_results',
    key: 'id',
    columns: ['id', 'race_id', 'position', 'driver_id', 'constructor_id', 'q1_time', 'q2_time', 'q3_time'],
    fields: [
      { label: 'race_id', columns: ['race_id'], severity: 'P0', displayImpact: 'Qualifying joins fail.' },
      { label: 'position', columns: ['position'], severity: 'P0', displayImpact: 'Qualifying tables cannot sort/display positions.' },
      { label: 'driver_id', columns: ['driver_id'], severity: 'P0', displayImpact: 'Qualifying rows cannot link to drivers.' },
      { label: 'lap_time', columns: ['q1_time', 'q2_time', 'q3_time'], severity: 'P2', displayImpact: 'Qualifying time columns are sparse.' },
    ],
  },
  {
    table: 'race_session_results',
    key: 'id',
    columns: ['id', 'season', 'round', 'session', 'source', 'race_name', 'circuit_id', 'payload'],
    fields: [
      { label: 'season', columns: ['season'], severity: 'P0', displayImpact: 'Session results cannot be selected by season.' },
      { label: 'round', columns: ['round'], severity: 'P0', displayImpact: 'Session results cannot be selected by round.' },
      { label: 'session', columns: ['session'], severity: 'P0', displayImpact: 'Practice/sprint/qualifying tabs cannot classify rows.' },
      { label: 'payload', columns: ['payload'], severity: 'P0', displayImpact: 'Session result panels render empty states.' },
    ],
  },
  {
    table: 'fastf1_session_analytics',
    key: 'id',
    columns: ['id', 'season', 'round', 'session', 'event_name', 'session_name', 'payload', 'generated_at', 'imported_at'],
    fields: [
      { label: 'season', columns: ['season'], severity: 'P0', displayImpact: 'FastF1 analytics cannot be selected by season.' },
      { label: 'round', columns: ['round'], severity: 'P0', displayImpact: 'FastF1 analytics cannot be selected by round.' },
      { label: 'session', columns: ['session'], severity: 'P0', displayImpact: 'FastF1 charts cannot classify sessions.' },
      { label: 'payload', columns: ['payload'], severity: 'P0', displayImpact: 'FastF1 chart panels render empty states.' },
    ],
  },
  {
    table: 'driver_history_summary',
    key: 'driver_id',
    columns: ['driver_id', 'given_name', 'family_name', 'nationality', 'career_summary', 'best_race_finish', 'seasons'],
    fields: [
      { label: 'given_name', columns: ['given_name'], severity: 'P0', displayImpact: 'History driver profile names render incomplete.' },
      { label: 'family_name', columns: ['family_name'], severity: 'P0', displayImpact: 'History driver profile names render incomplete.' },
      { label: 'career_summary', columns: ['career_summary'], severity: 'P1', displayImpact: 'History stat cards fall back to slower live aggregation.' },
      { label: 'seasons', columns: ['seasons'], severity: 'P1', displayImpact: 'History season table is incomplete.' },
    ],
  },
  {
    table: 'constructor_history_summary',
    key: 'constructor_id',
    columns: ['constructor_id', 'name', 'nationality', 'career_summary', 'best_race_finish', 'seasons'],
    fields: [
      { label: 'name', columns: ['name'], severity: 'P0', displayImpact: 'History constructor names render blank.' },
      { label: 'career_summary', columns: ['career_summary'], severity: 'P1', displayImpact: 'History stat cards fall back to slower live aggregation.' },
      { label: 'seasons', columns: ['seasons'], severity: 'P1', displayImpact: 'History season table is incomplete.' },
    ],
  },
];

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL/VITE_SUPABASE_URL and a Supabase key in .env.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

function isMissing(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  const text = String(value).trim();
  return !text || text === '-' || text.toLowerCase() === 'unknown' || text.toLowerCase() === 'n/a';
}

function fieldIsMissing(row: Row, field: FieldCheck): boolean {
  return field.columns.every((column) => isMissing(row[column]));
}

async function fetchTableRows(tableCheck: TableCheck): Promise<{ rows: Row[]; totalRows: number | null }> {
  const supabase = getSupabaseClient();
  const rows: Row[] = [];
  let totalRows: number | null = null;

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error, count } = await supabase
      .from(tableCheck.table)
      .select('*', { count: start === 0 ? 'exact' : undefined })
      .range(start, start + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (start === 0) {
      totalRows = count ?? null;
    }

    rows.push(...((data || []) as Row[]));

    if (!data || data.length < PAGE_SIZE) {
      break;
    }
  }

  return { rows, totalRows };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeSupabaseError = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [
      maybeSupabaseError.message,
      maybeSupabaseError.details,
      maybeSupabaseError.hint,
      maybeSupabaseError.code,
    ].filter(Boolean).join(' | ') || JSON.stringify(error);
  }

  return String(error);
}

function analyzeTable(tableCheck: TableCheck, rows: Row[], totalRows: number | null): TableResult {
  return {
    table: tableCheck.table,
    totalRows,
    fields: tableCheck.fields.map((field) => {
      const missingRows = rows.filter((row) => fieldIsMissing(row, field));
      return {
        ...field,
        missingCount: missingRows.length,
        missingPct: rows.length > 0 ? missingRows.length / rows.length : null,
        sampleKeys: missingRows
          .slice(0, 8)
          .map((row) => String(row[tableCheck.key] ?? '(missing key)')),
      };
    }),
  };
}

async function runAudit(): Promise<TableResult[]> {
  const results: TableResult[] = [];

  for (const tableCheck of TABLE_CHECKS) {
    try {
      const { rows, totalRows } = await fetchTableRows(tableCheck);
      results.push(analyzeTable(tableCheck, rows, totalRows));
    } catch (error) {
      results.push({
        table: tableCheck.table,
        totalRows: null,
        fields: tableCheck.fields.map((field) => ({
          ...field,
          missingCount: null,
          missingPct: null,
          sampleKeys: [],
          error: formatError(error),
        })),
        error: formatError(error),
      });
    }
  }

  return results;
}

function formatPct(value: number | null): string {
  return value === null ? '-' : `${(value * 100).toFixed(1)}%`;
}

function renderReport(results: TableResult[]): string {
  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    '# Database Completeness Audit',
    '',
    `Generated: ${generatedAt}`,
    '',
    'This report checks display-critical Supabase tables for missing values. It does not print credentials or raw sensitive data.',
    '',
    '## Summary',
    '',
    '| Table | Rows | Blocking/P0 Missing Fields | P1 Missing Fields | Notes |',
    '|---|---:|---:|---:|---|',
  ];

  results.forEach((result) => {
    const p0 = result.fields.filter((field) => field.severity === 'P0' && (field.missingCount || 0) > 0).length;
    const p1 = result.fields.filter((field) => field.severity === 'P1' && (field.missingCount || 0) > 0).length;
    lines.push(`| ${result.table} | ${result.totalRows ?? '-'} | ${p0} | ${p1} | ${result.error ? `Error: ${result.error}` : 'OK'} |`);
  });

  lines.push('', '## Field Details', '');

  results.forEach((result) => {
    lines.push(`### ${result.table}`, '');

    if (result.error) {
      lines.push(`Could not audit this table: ${result.error}`, '');
      return;
    }

    lines.push('| Severity | Field | Missing | Missing % | Display Impact | Samples |');
    lines.push('|---|---|---:|---:|---|---|');
    result.fields
      .filter((field) => (field.missingCount || 0) > 0)
      .sort((left, right) => left.severity.localeCompare(right.severity) || (right.missingCount || 0) - (left.missingCount || 0))
      .forEach((field) => {
        lines.push(`| ${field.severity} | ${field.label} | ${field.missingCount ?? '-'} | ${formatPct(field.missingPct)} | ${field.displayImpact} | ${field.sampleKeys.join(', ') || '-'} |`);
      });

    if (result.fields.every((field) => !field.missingCount)) {
      lines.push('| - | - | 0 | 0.0% | No missing display-critical fields found. | - |');
    }

    lines.push('');
  });

  return `${lines.join('\n')}\n`;
}

async function main() {
  const results = await runAudit();
  const report = renderReport(results);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log(report);
  console.log(`Report written to ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
