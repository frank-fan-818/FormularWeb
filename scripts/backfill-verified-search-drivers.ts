import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { buildVerifiedDriverAdditions } from '../src/utils/verifiedDriverAdditions';

// Default is a read-only plan. --apply inserts missing rows only; it never
// updates/deletes existing drivers or writes race results/standings.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node --import tsx scripts/backfill-verified-search-drivers.ts [--apply]');
const apply = args.includes('--apply');
const payload = buildVerifiedDriverAdditions(JSON.parse(readFileSync(resolve('data/reference/verified-driver-additions.json'), 'utf8')));
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase URL and service role key are required');
if (process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL !== process.env.VITE_SUPABASE_URL) {
  throw new Error('Server and browser Supabase projects differ; refusing to select a write target');
}
if (key.startsWith('eyJ')) {
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  if (claims.role !== 'service_role' || claims.ref !== new URL(url).hostname.split('.')[0]) {
    throw new Error('Admin key does not match the configured project');
  }
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const existingDrivers: Array<{ driver_id: string; first_name: string; last_name: string }> = [];
for (let from = 0;; from += 500) {
  const { data, error } = await db.from('drivers').select('driver_id,first_name,last_name').order('driver_id')
    .range(from, from + 499).abortSignal(AbortSignal.timeout(20000));
  if (error) throw new Error(`Driver preflight failed: ${error.message}`);
  existingDrivers.push(...data);
  if (data.length < 500) break;
}
const normalizedName = (first: string, last: string) => `${first} ${last}`.normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
for (const driver of payload.drivers) {
  const name = normalizedName(driver.first_name, driver.last_name);
  const byId = existingDrivers.find(row => row.driver_id === driver.driver_id);
  const otherName = existingDrivers.find(row => row.driver_id !== driver.driver_id
    && normalizedName(row.first_name, row.last_name) === name);
  if (otherName || (byId && normalizedName(byId.first_name, byId.last_name) !== name)) {
    throw new Error(`Existing identity collision for ${driver.driver_id}; no changes made`);
  }
}
const ids = payload.drivers.map(driver => driver.driver_id);
const { data: existingSummaries, error: summaryError } = await db.from('driver_history_summary')
  .select('driver_id,given_name,family_name').in('driver_id', ids).abortSignal(AbortSignal.timeout(20000));
if (summaryError) throw new Error(`Summary preflight failed: ${summaryError.message}`);
for (const row of existingSummaries) {
  const driver = payload.drivers.find(driver => driver.driver_id === row.driver_id)!;
  if (normalizedName(row.given_name, row.family_name) !== normalizedName(driver.first_name, driver.last_name)) {
    throw new Error(`Existing summary identity collision for ${row.driver_id}; no changes made`);
  }
}
const drivers = payload.drivers.filter(driver => !existingDrivers.some(row => row.driver_id === driver.driver_id));
const summaries = payload.summaries.filter(driver => !existingSummaries.some(row => row.driver_id === driver.driver_id));
mkdirSync('artifacts/search-audit', { recursive: true });
writeFileSync('artifacts/search-audit/verified-driver-import-plan.json', JSON.stringify({ apply, drivers, summaries }, null, 2));
process.stdout.write(`${JSON.stringify({ event: 'verified_driver_import_plan', apply, drivers: drivers.length,
  summaries: summaries.length, ids: drivers.map(driver => driver.driver_id) })}\n`);
if (apply) {
  for (const [table, rows] of [['drivers', drivers], ['driver_history_summary', summaries]] as const) {
    if (!rows.length) continue;
    const { error } = await db.from(table).insert(rows).abortSignal(AbortSignal.timeout(20000));
    if (error) throw new Error(`${table} insert failed: ${error.message}; rerun the plan to inspect partial progress`);
    process.stdout.write(`${JSON.stringify({ event: 'verified_driver_insert', table, count: rows.length })}\n`);
  }
  const { data: saved, error } = await db.from('drivers').select('*').in('driver_id', ids);
  const { data: savedSummaries, error: savedSummaryError } = await db.from('driver_history_summary').select('*').in('driver_id', ids);
  if (error || savedSummaryError) throw new Error('Read-back verification failed');
  for (const expected of payload.drivers) {
    const actual = saved.find(row => row.driver_id === expected.driver_id);
    if (!actual || Object.entries(expected).some(([field, value]) => actual[field] !== value)) {
      throw new Error(`Read-back mismatch for ${expected.driver_id}; no existing fields were overwritten`);
    }
  }
  if (savedSummaries.length !== ids.length) throw new Error('Summary read-back count mismatch');
  for (const expected of payload.summaries) {
    const actual = savedSummaries.find(row => row.driver_id === expected.driver_id);
    if (!actual || Object.entries(expected).some(([field, value]) => !isDeepStrictEqual(actual[field], value))) {
      throw new Error(`Summary read-back mismatch for ${expected.driver_id}`);
    }
  }
  writeFileSync('artifacts/search-audit/verified-driver-import-receipt.json', JSON.stringify({
    verifiedAt: payload.manifest.verifiedAt, driversInserted: drivers.length, summariesInserted: summaries.length,
    savedDrivers: saved, savedSummaries,
  }, null, 2));
  process.stdout.write(`${JSON.stringify({ event: 'verified_driver_readback', drivers: saved.length, summaries: savedSummaries.length })}\n`);
}
