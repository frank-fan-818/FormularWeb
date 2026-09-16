import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadCompleteSessions, publishSessions, nextHealth } from './fastf1-publication.mjs';
import { importIndependently } from './fastf1-session-import.ts';
import { parse } from 'yaml';

const qualifying = { season: '2026', round: '13', session: 'Q', generatedAt: '2026-09-06T12:00:00Z',
  sessionResults: [{}], lapTimeSeries: [{}], tyreStrategies: [{}], qualifyingAnalysis: { bestLaps: [{}] } };

test('a rejected database row does not stop other session imports', async () => {
  const seen = [];
  const result = await importIndependently([{ season: 2026, round: 13, session: 'R' }, { season: 2026, round: 13, session: 'Q' }], async (row) => {
    seen.push(row.session);
    if (row.session === 'R') throw { code: '23514' };
  });
  assert.deepEqual(seen, ['R', 'Q']);
  assert.equal(result.imported, 1);
  assert.deepEqual(result.failed, [{ key: '2026/13/R', code: '23514' }]);
});

test('publication selects complete sessions in scope and rejects an incomplete race pair', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'fastf1-publish-'));
  try {
    await mkdir(path.join(root, '2026/13'), { recursive: true });
    await mkdir(path.join(root, '2026/14'), { recursive: true });
    await writeFile(path.join(root, '2026/13/Q.json'), JSON.stringify(qualifying));
    await writeFile(path.join(root, '2026/13/R.json'), JSON.stringify({ ...qualifying, session: 'R', weather: { points: [{}] } }));
    await writeFile(path.join(root, '2026/13/R-telemetry.json'), JSON.stringify({ season: '2026', round: '99', session: 'R', telemetry: { drivers: [{}] } }));
    await writeFile(path.join(root, '2026/14/Q.json'), JSON.stringify({ ...qualifying, round: '14' }));
    const selected = await loadCompleteSessions(root, '2026', '13');
    assert.equal(selected.sessions.length, 1);
    assert.equal(selected.sessions[0].files[0].key, '2026/13/Q.json');
    assert.equal(selected.rejected.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('one failed upload does not prevent other complete sessions from publishing', async () => {
  const calls = [];
  const result = await publishSessions([
    { key: '2026/13/Q', files: [{ key: 'bad' }] },
    { key: '2026/14/Q', files: [{ key: 'good' }] },
  ], async (file) => { calls.push(file.key); if (file.key === 'bad') throw new Error('HTTP 503'); });
  assert.deepEqual(calls, ['bad', 'good']);
  assert.equal(result.failed.length, 1);
  assert.deepEqual(result.published, ['2026/14/Q']);
});

test('health preserves last success, counts consecutive failures and resets on recovery', () => {
  const manifest = { rounds: [{ round: 13, sessions: [{ session: 'Q', eligible: true, complete: false,
    scheduledStart: '2026-09-05T14:00:00Z' }] }] };
  const report = { results: [{ round: 13, session: 'Q', status: 'failed', diagnostic: { category: 'fetch_error' } }] };
  const first = nextHealth({}, manifest, report, '2026-09-13T12:00:00Z');
  const second = nextHealth(first, manifest, report, '2026-09-13T15:00:00Z');
  assert.equal(second.sessions['13/Q'].consecutiveFailures, 2);
  assert.equal(second.sessions['13/Q'].missingSince, '2026-09-05T14:00:00Z');
  manifest.rounds[0].sessions[0].complete = true;
  manifest.rounds[0].sessions[0].generatedAt = '2026-09-13T16:00:00Z';
  const recovered = nextHealth(second, manifest, { results: [] }, '2026-09-13T18:00:00Z');
  assert.equal(recovered.sessions['13/Q'].consecutiveFailures, 0);
  assert.equal(recovered.sessions['13/Q'].lastSuccess, '2026-09-13T16:00:00Z');
  const again = nextHealth(recovered, { rounds: [{ round: 13, sessions: [{ session: 'Q', eligible: true, complete: false }] }] }, report, '2026-09-13T21:00:00Z');
  assert.equal(again.sessions['13/Q'].lastSuccess, '2026-09-13T16:00:00Z');
});

test('workflow publishes healthy sessions before strict verification and never masks failed steps', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/refresh-fastf1-analytics.yml', import.meta.url), 'utf8'));
  const steps = workflow.jobs.refresh.steps;
  const index = (id) => steps.findIndex((s) => s.id === id);
  assert.ok(index('restore') < index('export'));
  assert.ok(index('database') < index('verify'));
  assert.ok(index('storage') < index('verify'));
  const final = steps.at(-1);
  for (const id of ['restore', 'export', 'database', 'storage', 'health', 'verify']) {
    assert.ok(final.if.includes(`steps.${id}.outcome == 'failure'`));
  }
  for (const id of ['restore', 'export', 'database', 'storage', 'health', 'verify']) {
    assert.ok(steps[index(id)].run.includes('"$ROUND"'));
    assert.ok(steps[index(id)].run.includes('"$FASTF1_ROOT"'));
  }
});
