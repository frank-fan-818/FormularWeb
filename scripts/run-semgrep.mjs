import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SEMGREP_VERSION = '1.170.0';
const OFFICIAL_PYPI_INDEX = 'https://pypi.org/simple';
const environmentOverride = process.env.SEMGREP_BIN?.trim();
const requirementsFile = path.resolve(process.cwd(), 'scripts', 'semgrep-requirements.lock');
const environmentDirectory = path.resolve(
  process.cwd(),
  '.cache',
  `semgrep-${SEMGREP_VERSION}-lock1`,
);
const localPython = process.platform === 'win32'
  ? path.join(environmentDirectory, 'Scripts', 'python.exe')
  : path.join(environmentDirectory, 'bin', 'python');
const localSemgrep = process.platform === 'win32'
  ? path.join(environmentDirectory, 'Scripts', 'semgrep.exe')
  : path.join(environmentDirectory, 'bin', 'semgrep');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
}

function getVersion(command) {
  const result = run(command, ['--version']);
  if (result.status !== 0) return null;
  return `${result.stdout || ''}${result.stderr || ''}`.match(/\b\d+\.\d+\.\d+\b/)?.[0] || null;
}

function findPinnedSemgrep() {
  const candidates = [
    environmentOverride,
    existsSync(localSemgrep) ? localSemgrep : null,
    process.env.CI === 'true' ? 'semgrep' : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const version = getVersion(candidate);
    if (version === SEMGREP_VERSION) return candidate;
    if (environmentOverride && candidate === environmentOverride) {
      throw new Error(
        `SEMGREP_BIN points to Semgrep ${version || 'unavailable'}, expected ${SEMGREP_VERSION}.`,
      );
    }
  }
  return null;
}

function bootstrapPinnedSemgrep() {
  process.stdout.write(`Bootstrapping Semgrep ${SEMGREP_VERSION} in ${environmentDirectory}\n`);
  const pythonCommand = process.env.PYTHON?.trim() || 'python';
  const venv = run(pythonCommand, ['-m', 'venv', environmentDirectory], { stdio: 'inherit' });
  if (venv.status !== 0) {
    throw new Error('Unable to create the local Semgrep Python environment.');
  }

  const install = run(localPython, [
    '-m',
    'pip',
    'install',
    '--isolated',
    '--disable-pip-version-check',
    '--no-input',
    '--index-url',
    OFFICIAL_PYPI_INDEX,
    '--requirement',
    requirementsFile,
  ], { stdio: 'inherit' });
  if (install.status !== 0 || !existsSync(localSemgrep)) {
    throw new Error(`Unable to install pinned Semgrep ${SEMGREP_VERSION}.`);
  }
  return localSemgrep;
}

const semgrep = findPinnedSemgrep() || bootstrapPinnedSemgrep();
const result = run(semgrep, [
  'scan',
  '--config',
  '.semgrep.yml',
  '--error',
  '--metrics=off',
  '--no-git-ignore',
  '--exclude=node_modules',
  '--exclude=dist',
  '--exclude=coverage',
  '--exclude=artifacts',
  '--exclude=.cache',
  '--exclude=.git',
  '--exclude=.vercel',
  '--exclude=.trae',
  '--exclude=f1_cache',
  '--exclude=data/fia-upgrades/raw',
  '.',
], { stdio: 'inherit' });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
