import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const importer = fileURLToPath(new URL('./import-fastf1-session-analytics.ts', import.meta.url));
const reporter = fileURLToPath(new URL('./report-fastf1-health.mjs', import.meta.url));
const fixture = new URL('./fixtures/fastf1-database-fetch.mjs', import.meta.url).href;

for (const scenario of ['network', '503', '403', 'empty', 'invalid']) {
  test(`real database CLI and health summary: ${scenario}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'fastf1-database-'));
    try {
      const directory = path.join(root, '2026');
      await mkdir(path.join(directory, '1'), { recursive: true });
      for (const session of scenario === 'empty' ? [] : ['FP1', 'FP2', 'FP3']) {
        await writeFile(path.join(directory, '1', `${session}.json`), scenario === 'invalid' ? '{' : JSON.stringify({
          season: '2026', round: '1', session, generatedAt: '2026-09-20T00:00:00Z',
          classificationVersion: 1, sessionResults: [{ position: 1, time: '1:20.000' }], lapTimeSeries: [{}], tyreStrategies: [{}],
        }));
      }
      const env = { ...process.env, FASTF1_TEST_SCENARIO: scenario, SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-only-key', FASTF1_PIPELINE_FAILED: 'false',
        FASTF1_DATABASE_OUTCOME: scenario === '403' || scenario === 'invalid' ? 'failure' : 'success',
        GITHUB_STEP_SUMMARY: path.join(root, 'summary.md') };
      const run = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import', fixture,
        importer, '--season', '2026', '--input', root, '--complete-only'], {
        cwd: root, env, encoding: 'utf8', timeout: 20000,
      });
      const failed = scenario === '403' || scenario === 'invalid';
      assert.equal(run.status, failed ? 1 : 0, run.stdout + run.stderr);
      const database = JSON.parse(await readFile(path.join(directory, 'database-report.json'), 'utf8'));
      assert.equal(database.imported, scenario === 'empty' || scenario === 'invalid' ? 0 : failed ? 2 : 3);
      if (scenario === '403') {
        assert.deepEqual(database.failed, [{ key: '2026/1/FP2', code: '42501', status: 403, transient: false, attempts: 1 }]);
      } else if (scenario === 'invalid') assert.equal(database.fatal.code, 'database_error');
      else if (scenario !== 'empty') assert.deepEqual(database.recovered, [{ key: '2026/1/FP2', attempts: 2 }]);
      assert.doesNotMatch(JSON.stringify(database) + run.stdout + run.stderr, /private-.*detail|private-upstream-body/);
      await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rounds: [] }));
      await writeFile(path.join(directory, 'export-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results: [] }));
      await writeFile(path.join(directory, 'publication-report.json'), JSON.stringify({ published: [], failed: [] }));
      const healthRun = spawnSync(process.execPath, [reporter, '--season', '2026', '--input', root, '--dry-run'], {
        cwd: root, env, encoding: 'utf8', timeout: 10000,
      });
      assert.equal(healthRun.status, failed ? 1 : 0, healthRun.stdout + healthRun.stderr);
      const summary = await readFile(env.GITHUB_STEP_SUMMARY, 'utf8');
      assert.match(summary, /Database imported:/);
      if (scenario === '403') assert.match(summary, /2026\/1\/FP2.*42501.*403.*1/);
      if (scenario === 'invalid') assert.match(summary, /Database import aborted/);
      const health = JSON.parse(await readFile(path.join(directory, 'health.json'), 'utf8'));
      assert.equal(health.consecutiveRunFailures, failed ? 1 : 0);
      assert.equal(health.database.imported, database.imported);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('health flags missing import reports and includes verification stage failures', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fastf1-health-'));
  try {
    await mkdir(path.join(root, '2026'));
    for (const name of ['manifest', 'export-report']) {
      await writeFile(path.join(root, '2026', `${name}.json`), JSON.stringify({ generatedAt: new Date().toISOString() }));
    }
    const result = spawnSync(process.execPath, [reporter, '--season', '2026', '--input', root, '--dry-run'], {
      encoding: 'utf8', timeout: 10000,
      env: { ...process.env, FASTF1_PIPELINE_FAILED: 'false', FASTF1_VERIFY_OUTCOME: 'failure', GITHUB_STEP_SUMMARY: '' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Database report missing/);
    assert.match(result.stdout, /verify.*failure/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
