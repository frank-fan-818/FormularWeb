import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

for (const [scenario, expected, status, extra] of [
  ['missing-event', 'awaiting_event', 0, []],
  ['no-pdf', 'awaiting_publication', 0, []],
  ['403', 'source_deferred', 0, []],
  ['maintenance', 'source_deferred', 0, []],
  ['overdue', 'run_failed', 1, []],
  ['broken', 'run_failed', 1, []],
  ['missing-event', 'run_failed', 1, ['--round', '15']],
]) {
  test(`FIA CLI ${scenario} ${extra.join(' ')} reports ${expected}`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'fia-refresh-'));
    try {
      const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import',
        new URL('./fixtures/fia-refresh-fetch.mjs', import.meta.url).href,
        fileURLToPath(new URL('./refresh-fia-upgrades.ts', import.meta.url)), '--season', '2026', ...extra], {
        cwd: directory, encoding: 'utf8', timeout: 30000,
        env: { ...process.env, FIA_TEST_SCENARIO: scenario, GITHUB_STEP_SUMMARY: '', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key' },
      });
      assert.equal(result.status, status, result.stdout + result.stderr);
      const report = JSON.parse(await readFile(path.join(directory, 'artifacts/fia-refresh/run-report.json'), 'utf8'));
      assert.ok(report.outcomes.some(row => row.event === expected), JSON.stringify(report));
      assert.equal(report.outcomes.some(row => row.event === 'published'), false);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
