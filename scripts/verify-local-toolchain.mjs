import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = resolve(projectRoot, 'package.json');
const packageLockPath = resolve(projectRoot, 'package-lock.json');

const [packageJson, packageLock] = await Promise.all(
  [packageJsonPath, packageLockPath].map(async (path) =>
    JSON.parse(await readFile(path, 'utf8')),
  ),
);

const requiredTools = [
  {
    packageName: 'ts-node',
    packageBinName: 'ts-node-esm',
    binaryName: process.platform === 'win32' ? 'ts-node-esm.cmd' : 'ts-node-esm',
  },
  {
    packageName: 'tsx',
    packageBinName: 'tsx',
    binaryName: process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
  },
];

const failures = [];
const predictionScripts = ['prediction:sync', 'prediction:backtest'];

for (const scriptName of predictionScripts) {
  const script = packageJson.scripts?.[scriptName];

  if (typeof script !== 'string' || !/^tsx(?:\s|$)/.test(script)) {
    failures.push(`${scriptName} must run through the declared tsx toolchain`);
  }
}

for (const { packageName, packageBinName, binaryName } of requiredTools) {
  const declaredVersion = packageJson.devDependencies?.[packageName];
  const lockedVersion = packageLock.packages?.['']?.devDependencies?.[packageName];

  if (!declaredVersion) {
    failures.push(`${packageName} is not a direct devDependency`);
  }

  if (lockedVersion !== declaredVersion) {
    failures.push(
      `${packageName} is not synchronized between package.json and package-lock.json`,
    );
  }

  const binaryPath = resolve(projectRoot, 'node_modules', '.bin', binaryName);

  try {
    await access(
      binaryPath,
      process.platform === 'win32' ? constants.F_OK : constants.X_OK,
    );
  } catch {
    failures.push(`${packageName} has no local executable at ${binaryPath}`);
    continue;
  }

  const installedPackageJsonPath = resolve(
    projectRoot,
    'node_modules',
    packageName,
    'package.json',
  );
  const installedPackage = JSON.parse(
    await readFile(installedPackageJsonPath, 'utf8'),
  );
  const packageBins = typeof installedPackage.bin === 'string'
    ? { [packageName]: installedPackage.bin }
    : installedPackage.bin;
  const packageBinEntry = packageBins?.[packageBinName];

  if (!packageBinEntry) {
    failures.push(`${packageName} does not declare the ${packageBinName} binary`);
    continue;
  }

  const packageBinPath = resolve(
    dirname(installedPackageJsonPath),
    packageBinEntry,
  );
  const smokeResult = spawnSync(process.execPath, [packageBinPath, '--version'], {
    encoding: 'utf8',
  });

  if (smokeResult.status !== 0) {
    failures.push(
      `${packageName} executable failed its smoke test: ${smokeResult.stderr.trim() || `exit ${smokeResult.status}`}`,
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Local toolchain verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write('Local toolchain verification passed.\n');
