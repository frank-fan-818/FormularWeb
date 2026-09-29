import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const supervisor = fileURLToPath(new URL('./start-fastf1-runner.ps1', import.meta.url));
test('Windows supervisor restarts a crashed listener, rotates logs and respects the stop marker',
  { skip: process.platform !== 'win32' }, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fastf1-supervisor-'));
    try {
      await writeFile(path.join(root, '.runner'), JSON.stringify({ agentId: 'test', gitHubUrl: 'https://github.com/frank-fan-818/FormularWeb' }));
      await writeFile(path.join(root, 'supervisor.log'), 'x'.repeat(1024 * 1024 + 1));
      await writeFile(path.join(root, 'run.cmd'), '@echo off\r\necho start>> starts.txt\r\nif exist first.txt (echo stop> supervisor.stop) else (echo first> first.txt)\r\nexit /b 1\r\n');
      const run = () => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', supervisor, '-RunnerRoot', root, '-RestartDelaySeconds', '1'], { encoding: 'utf8', timeout: 15000 });
      const first = run();
      assert.equal(first.status, 0, first.stderr || String(first.error));
      assert.equal((await readFile(path.join(root, 'starts.txt'), 'utf8')).trim().split(/\r?\n/).length, 2);
      assert.equal((await readFile(path.join(root, 'supervisor.log.previous'), 'utf8')).length, 1024 * 1024 + 1);
      assert.equal(run().status, 0);
      assert.equal((await readFile(path.join(root, 'starts.txt'), 'utf8')).trim().split(/\r?\n/).length, 2);
      await writeFile(path.join(root, '.runner'), JSON.stringify({ agentId: 'test', gitHubUrl: 'https://example.com/other' }));
      assert.equal(run().status, 1, 'An unrelated runner must never start');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
