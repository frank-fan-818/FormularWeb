import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 5_000;
const ATTEMPT_TIMEOUT_MS = 90_000;
const AUDIT_ARGS = [
  'audit',
  '--audit-level=high',
  '--fetch-retries=0',
  '--fetch-timeout=60000',
];

const TRANSIENT_AUDIT_PATTERNS = [
  /npm (?:warn|error) audit\s+(?:429|5\d{2})\b/i,
  /audit endpoint returned an error/i,
  /\b(?:Service Unavailable|Bad Gateway|Gateway Timeout|Too Many Requests)\b/i,
  /\b(?:EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENETUNREACH)\b/i,
];

export function isTransientAuditFailure(output) {
  return TRANSIENT_AUDIT_PATTERNS.some((pattern) => pattern.test(output));
}

function runAudit() {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = npmCli ? [npmCli, ...AUDIT_ARGS] : AUDIT_ARGS;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      process.stderr.write('[security:audit] npm audit attempt timed out.\n');
      child.kill('SIGTERM');
    }, ATTEMPT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, output, signal, timedOut });
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await runAudit();
    if (result.code === 0) return;

    const canRetry = attempt < MAX_ATTEMPTS
      && (result.timedOut || (!result.signal && isTransientAuditFailure(result.output)));
    if (!canRetry) {
      process.exitCode = result.code;
      return;
    }

    const delayMs = BASE_DELAY_MS * (2 ** (attempt - 1));
    process.stderr.write(
      `[security:audit] npm registry is temporarily unavailable; retrying in ${delayMs / 1000}s `
      + `(attempt ${attempt + 1}/${MAX_ATTEMPTS}).\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
