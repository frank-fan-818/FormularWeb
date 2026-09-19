import assert from 'node:assert/strict';
import test from 'node:test';
import { retryTransient } from './automation-retry.mjs';
import { resolveCalendar, isEligible, validateCalendar } from './race-window.mjs';
import { resilientStore, listAll } from './private-fastf1-store.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const now = Date.parse('2026-09-19T00:00:00Z');
const races = [{ season: '2026', round: '1', date: '2026-09-20', time: '12:00:00Z' }];
const payload = { MRData: { RaceTable: { season: '2026', Races: races } } };
const cache = { season: '2026', fetchedAt: now - 1000, payload };
const offline = async () => { throw new TypeError('fetch failed'); };

test('transient failures back off and recover', async () => {
  let attempts = 0;
  const waits = [];
  const result = await retryTransient(async () => {
    if (++attempts < 3) throw Object.assign(new Error('unavailable'), { status: 503 });
    return 'ok';
  }, { sleep: async ms => waits.push(ms) });
  assert.equal(result, 'ok');
  assert.deepEqual(waits, [5000, 15000]);
});

test('permission errors fail immediately and permanent outages exhaust retries', async () => {
  let attempts = 0;
  await assert.rejects(retryTransient(async () => {
    attempts++;
    throw Object.assign(new Error('forbidden'), { status: 403 });
  }), /forbidden/);
  assert.equal(attempts, 1);
  attempts = 0;
  await assert.rejects(retryTransient(async () => { attempts++; return offline(); }, { sleep: async () => {} }));
  assert.equal(attempts, 4);
});

test('calendar outage uses a recent validated same-season cache', async () => {
  const result = await resolveCalendar({ season: '2026', now, cache, request: offline });
  assert.equal(result.source, 'cache');
  assert.deepEqual(result.races, races);
  assert.equal(result.snapshot.fetchedAt, cache.fetchedAt);
});

test('stale, future, wrong-season and malformed caches never hide an outage', async () => {
  for (const bad of [null, { ...cache, fetchedAt: now - 86400001 }, { ...cache, fetchedAt: now + 1 },
    { ...cache, season: '2025' }, { ...cache, payload: {} }]) {
    await assert.rejects(resolveCalendar({ season: '2026', now, cache: bad, request: offline }));
  }
});

test('invalid live data and authentication errors cannot fall back to cache', async () => {
  await assert.rejects(resolveCalendar({ season: '2026', now, cache, request: async () => ({}) }));
  await assert.rejects(resolveCalendar({ season: '2026', now, cache, request: async () => {
    throw Object.assign(new Error('forbidden'), { status: 403 });
  } }));
});

test('fresh data replaces cache; dates and season must be valid', async () => {
  const result = await resolveCalendar({ season: '2026', now, cache, request: async () => payload });
  assert.equal(result.source, 'live');
  assert.equal(result.snapshot.fetchedAt, now);
  assert.throws(() => validateCalendar(payload, '2025'));
  assert.throws(() => validateCalendar({ MRData: { ...payload.MRData, total: '24' } }, '2026'), /Incomplete/);
  assert.throws(() => validateCalendar({ MRData: { RaceTable: { season: '2026', Races: [{ ...races[0], date: 'garbage' }] } } }, '2026'));
});

test('CLI validates input before manual bypass and writes compatible workflow outputs', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'race-window-'));
  try {
    const output = path.join(directory, 'output');
    const env = { ...process.env, REQUESTED_SEASON: '2026', REQUESTED_ROUND: '', EVENT_NAME: 'workflow_dispatch', GITHUB_OUTPUT: output };
    const run = spawnSync(process.execPath, ['scripts/race-window.mjs', 'prediction'], { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(await readFile(output, 'utf8'), /season=2026\neligible=true\nsource=manual/);
    for (const invalid of [{ REQUESTED_SEASON: '2026; echo unsafe' }, { REQUESTED_ROUND: '41' }]) {
      const failed = spawnSync(process.execPath, ['scripts/race-window.mjs', 'fia'], { env: { ...env, ...invalid }, encoding: 'utf8' });
      assert.equal(failed.status, 1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('race windows preserve boundaries and exclude completed races for predictions', () => {
  const start = Date.parse('2026-09-20T12:00:00Z');
  assert.equal(isEligible(races, 'prediction', start - 259200000), true);
  assert.equal(isEligible(races, 'prediction', start - 259200001), false);
  assert.equal(isEligible(races, 'prediction', start + 1), false);
  assert.equal(isEligible(races, 'fia', start + 172800000), true);
  assert.equal(isEligible(races, 'fia', start + 172800001), false);
  assert.equal(isEligible([], 'fia', now), false);
});

test('storage retries SDK error results without duplicating paginated entries', async () => {
  const offsets = [];
  let fail = true;
  const store = resilientStore({ list: async (_, { offset }) => {
    offsets.push(offset);
    if (offset === 100 && fail) { fail = false; return { error: { name: 'StorageUnknownError' } }; }
    return { data: offset === 0 ? Array.from({ length: 100 }, (_, i) => ({ name: String(i) })) : [{ name: 'last' }] };
  } }, { sleep: async () => {} });
  assert.equal((await listAll(store, '2026')).length, 101);
  assert.deepEqual(offsets, [0, 100, 100]);
});

test('storage recovers reads and idempotent uploads but preserves permission errors', async () => {
  let calls = 0;
  const store = resilientStore({
    download: async () => ++calls === 1 ? { error: { statusCode: '503' } } : { data: 'snapshot' },
    upload: async () => ({ error: { statusCode: '403' } }),
  }, { sleep: async () => {} });
  assert.equal((await store.download('key')).data, 'snapshot');
  assert.equal((await store.upload('key', 'bytes', { upsert: true })).error.statusCode, '403');
  let uploads = 0;
  const writable = resilientStore({ upload: async () => ++uploads < 2 ? { error: { statusCode: 503 } } : { data: 'ok' } }, { sleep: async () => {} });
  assert.equal((await writable.upload('key', 'bytes', { upsert: true })).data, 'ok');
  uploads = 0;
  assert.equal((await writable.upload('key', 'bytes', { upsert: false })).error.statusCode, 503);
  assert.equal(uploads, 1);
});
