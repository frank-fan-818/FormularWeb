import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(import.meta.dirname, '..');
const lighthouseTempDir = resolve(projectRoot, '.lighthouseci', 'tmp');
const lhciPackageRoot = resolve(projectRoot, 'node_modules', '@lhci', 'cli');
const lhciPackage = JSON.parse(
  readFileSync(resolve(lhciPackageRoot, 'package.json'), 'utf8'),
);
const lhciBin = typeof lhciPackage.bin === 'string'
  ? lhciPackage.bin
  : lhciPackage.bin?.lhci;

if (!lhciBin) {
  throw new Error('@lhci/cli does not declare its lhci executable.');
}

mkdirSync(lighthouseTempDir, { recursive: true });

const localWindowsOverrides = process.platform === 'win32' && !process.env.CI
  ? ['--collect.numberOfRuns=1']
  : [];

if (localWindowsOverrides.length > 0) {
  process.stdout.write(
    'Windows local smoke: collecting one run; CI environments keep the configured five-run gate.\n',
  );
}

const result = spawnSync(
  process.execPath,
  [
    resolve(lhciPackageRoot, lhciBin),
    'autorun',
    '--config=.lighthouserc.cjs',
    ...localWindowsOverrides,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      TEMP: lighthouseTempDir,
      TMP: lighthouseTempDir,
      TMPDIR: lighthouseTempDir,
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
