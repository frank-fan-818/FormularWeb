import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const serverEntry = resolve(projectRoot, 'scripts', 'serve-dist.mjs');
const playwrightEntry = resolve(projectRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const baseUrl = 'http://127.0.0.1:4173';
const serverOutput = [];

const server = spawn(process.execPath, [serverEntry], {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
const serverClosed = once(server, 'close');

for (const stream of [server.stdout, server.stderr]) {
  stream?.on('data', (chunk) => {
    serverOutput.push(chunk.toString());
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Browser QA server exited early:\n${serverOutput.join('')}`);
    }

    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }

  throw new Error(`Browser QA server did not start within 30 seconds:\n${serverOutput.join('')}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;

  server.kill('SIGTERM');
  await Promise.race([
    serverClosed,
    new Promise((resolveWait) => setTimeout(resolveWait, 3_000)),
  ]);

  if (server.exitCode === null) {
    server.kill('SIGKILL');
    await serverClosed;
  }
}

let exitCode = 1;

try {
  await waitForServer();

  const testProcess = spawn(
    process.execPath,
    [playwrightEntry, 'test', ...process.argv.slice(2)],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );

  const [code, signal] = await once(testProcess, 'exit');
  if (signal) {
    throw new Error(`Playwright exited after receiving ${signal}.`);
  }

  exitCode = code ?? 1;
} finally {
  await stopServer();
}

process.exitCode = exitCode;
