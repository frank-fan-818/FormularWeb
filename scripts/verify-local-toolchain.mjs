import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    binaryName: process.platform === 'win32' ? 'ts-node-esm.cmd' : 'ts-node-esm',
  },
];

const failures = [];

for (const { packageName, binaryName } of requiredTools) {
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
  }
}

if (failures.length > 0) {
  throw new Error(`Local toolchain verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write('Local toolchain verification passed.\n');
