import assert from 'node:assert/strict';
import test from 'node:test';
import { importIndependently } from './fastf1-session-import.ts';

const rows = ['FP1', 'FP2', 'Q'].map(session => ({ season: 2026, round: 1, session }));
const noWait = { sleep: async () => {} };

test('database retries only the interrupted row and reports recovery', async () => {
  const seen = [];
  const waits = [];
  let failures = 0;
  const result = await importIndependently(rows, async row => {
    seen.push(row.session);
    if (row.session === 'FP2' && failures++ < 2) throw { status: 503, code: '' };
  }, { sleep: async ms => waits.push(ms) });
  assert.equal(result.imported, 3);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(seen, ['FP1', 'FP2', 'FP2', 'FP2', 'Q']);
  assert.deepEqual(waits, [5000, 15000]);
  assert.deepEqual(result.recovered, [{ key: '2026/1/FP2', attempts: 3 }]);
});

test('database SDK status zero, timeouts and transient server failures recover', async () => {
  for (const error of [{ status: 0, code: '' }, { status: 408 }, { status: 429 },
    { status: 502 }, { status: 503 }, { status: 504 }, new TypeError('fetch failed'),
    { name: 'TimeoutError' }, { status: 500, code: '40001' }, { status: 409, code: '40P01' }]) {
    let calls = 0;
    const result = await importIndependently(rows.slice(0, 1), async () => {
      if (++calls === 1) throw error;
    }, noWait);
    assert.equal(result.imported, 1, JSON.stringify(error));
    assert.equal(calls, 2);
  }
});

test('permanent errors fail immediately; exhausted outages stay visible and other rows continue', async () => {
  for (const [error, attempts] of [
    [{ status: 401, code: 'PGRST301' }, 1], [{ status: 403, code: '42501' }, 1],
    [{ status: 400, code: '23514' }, 1], [{ status: 404, code: 'PGRST205' }, 1],
    [{ status: 503, code: '' }, 4], [{ status: 0, code: '' }, 4],
    [new Error('unexpected programming error'), 1],
  ]) {
    let calls = 0;
    const result = await importIndependently(rows, async row => {
      if (row.session === 'FP2') { calls++; throw error; }
    }, noWait);
    assert.equal(calls, attempts);
    assert.equal(result.imported, 2);
    assert.equal(result.failed[0].key, '2026/1/FP2');
    assert.equal(result.failed[0].attempts, attempts);
    assert.equal(result.failed[0].status, error.status ?? null);
    assert.deepEqual(result.recovered, []);
  }
});

test('database failure diagnostics never contain upstream messages or response bodies', async () => {
  const result = await importIndependently(rows.slice(0, 1), async () => {
    throw { code: 'unsafe\nsecret', status: 403, message: 'private-url', details: 'private-body' };
  }, noWait);
  assert.doesNotMatch(JSON.stringify(result), /secret|private-url|private-body/);
  assert.equal(result.failed[0].code, 'database_error');
});

test('database outage has a total time budget and leaves diagnostics for unattempted rows', async () => {
  let time = 0;
  const timeouts = [];
  const result = await importIndependently(rows, async (_, timeout) => {
    timeouts.push(timeout);
    time = time === 0 ? 599000 : 600000;
    throw { status: 503 };
  }, { now: () => time, sleep: async () => { assert.fail('No retry can fit within budget'); } });
  assert.deepEqual(timeouts, [60000, 1000]);
  assert.equal(result.failed.length, 3);
  assert.equal(result.failed[0].attempts, 1);
  assert.equal(result.failed[2].code, 'runtime_budget');
  assert.equal(result.failed[2].attempts, 0);
});
