import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const distDirectory = path.resolve(process.cwd(), 'dist');
const serviceWorkerPath = path.join(distDirectory, 'sw.js');
const source = await readFile(serviceWorkerPath, 'utf8');
const failures = [];

function requirePattern(pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidPattern(pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

requirePattern(
  /const SHELL_CACHE = 'f1-shell-[0-9a-f]{12}';/,
  'the shell cache must use a content-derived version',
);
requirePattern(
  /self\.addEventListener\('install',[\s\S]*?event\.waitUntil\(caches\.open\(SHELL_CACHE\)/,
  'installation must atomically populate the current shell cache',
);
requirePattern(
  /self\.addEventListener\('message',[\s\S]*?event\.waitUntil\(self\.skipWaiting\(\)\)/,
  'SKIP_WAITING activation must remain attached to the message event lifetime',
);
requirePattern(
  /GET_BUILD_ID[\s\S]*?postMessage\(\{ buildId: SHELL_CACHE \}\)/,
  'the worker must expose its content-derived build ID for multi-tab coordination',
);
requirePattern(
  /GET_CLIENT_BUILD_ID[\s\S]*?clientBuildIds[\s\S]*?buildId !== SHELL_CACHE[\s\S]*?cacheName\.startsWith\('f1-shell-'\)[\s\S]*?cacheName !== SHELL_CACHE/,
  'old shell caches may only be pruned after every window reports the current in-memory build',
);
requirePattern(
  /PRUNE_UNUSED_SHELL_CACHES[\s\S]*?event\.waitUntil\(pruneUnusedShellCaches\(\)\)/,
  'safe shell-cache pruning must remain attached to the message event lifetime',
);
requirePattern(
  /caches\.open\(SHELL_CACHE\)\.then\(\(cache\) => cache\.match\('\/index\.html'\)\)/,
  'offline navigation must only read the current shell cache',
);
requirePattern(
  /caches\.open\(SHELL_CACHE\)\.then\(\(cache\) => cache\.match\(request\)/,
  'shell assets must only read the current shell cache',
);

forbidPattern(
  /\bcaches\.match\(/,
  'global caches.match() can return assets from an older deployment',
);
forbidPattern(
  /\bself\.clients\.claim\(/,
  'clients.claim() can mix a newly activated worker with an old in-memory app',
);
const installHandler = source.match(
  /self\.addEventListener\('install',([\s\S]*?)self\.addEventListener\('message'/,
)?.[1] || '';
if (/\bskipWaiting\(/.test(installHandler)) {
  failures.push('install must not force activation before the client coordinates a reload');
}

const appShellMatch = source.match(/const APP_SHELL = (\[[^\n]+\]);/);
if (!appShellMatch) {
  failures.push('APP_SHELL must be emitted as a static asset list');
} else {
  const appShell = JSON.parse(appShellMatch[1]);
  if (!appShell.includes('/index.html')) {
    failures.push('APP_SHELL must include /index.html');
  }

  await Promise.all(appShell.map(async (assetPath) => {
    if (typeof assetPath !== 'string' || !assetPath.startsWith('/')) {
      failures.push(`invalid APP_SHELL entry: ${String(assetPath)}`);
      return;
    }

    try {
      await access(path.join(distDirectory, assetPath.slice(1)));
    } catch {
      failures.push(`APP_SHELL references a missing build artifact: ${assetPath}`);
    }
  }));
}

if (failures.length > 0) {
  throw new Error(`Built service worker verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write('Built service worker verification passed.\n');
