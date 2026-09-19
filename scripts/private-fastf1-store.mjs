import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'node:path';
import { retryTransient } from './automation-retry.mjs';

export function options(args = process.argv.slice(2)) {
  function value(flag) {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${flag} value`);
    return args[index + 1];
  }
  const season = value('--season');
  const round = value('--round');
  if (season !== undefined && !/^\d{4}$/.test(season)) throw new Error('Invalid season');
  if (round !== undefined && !/^[1-9]\d*$/.test(round)) throw new Error('Invalid round');
  return { season, round, root: path.resolve(value('--input') || 'data/private-fastf1'), dryRun: args.includes('--dry-run') };
}

export function privateStore() {
  config({ path: '.env.local', quiet: true });
  config({ path: '.env', quiet: true });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase credentials are required');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }) },
  });
  return resilientStore(client.storage.from('fastf1-private'));
}

export function resilientStore(store, retryOptions) {
  const wrap = operation => retryTransient(async () => {
    const result = await operation();
    if (result.error) throw result.error;
    return result;
  }, retryOptions).catch(error => ({ data: null, error }));
  return {
    list: (...args) => wrap(() => store.list(...args)),
    download: (...args) => wrap(() => store.download(...args)),
    upload: (...args) => args[2]?.upsert === true
      ? wrap(() => store.upload(...args)) : store.upload(...args),
  };
}

export function storageError(operation, error) {
  return new Error(`${operation}: Storage ${error?.statusCode || error?.status || error?.name || 'error'}`);
}

export async function listAll(store, prefix) {
  const entries = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await store.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw storageError('List private objects', error);
    entries.push(...data);
    if (data.length < 100) return entries;
  }
}
