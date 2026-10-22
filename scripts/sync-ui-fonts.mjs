import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { collectUiGlyphs, fontSyncPlan } from './ui-font-glyphs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'public/fonts/manifest.json'), 'utf8'));
const glyphs = await collectUiGlyphs(root);
const plan = fontSyncPlan(glyphs, manifest);
if (!plan.needed) {
  process.stdout.write(`UI fonts already cover current copy (${manifest.uiCodepoints.length} glyphs); no Python or downloads needed.\n`);
} else {
  const sourceDirectory = path.join(root, 'scripts/font-sources');
  const sourceManifest = JSON.parse(readFileSync(path.join(sourceDirectory, 'manifest.json'), 'utf8'));
  if (path.basename(sourceManifest.file) !== sourceManifest.file) throw new Error('Invalid font source path');
  const source = readFileSync(path.join(sourceDirectory, sourceManifest.file));
  if (source.length !== sourceManifest.bytes || createHash('sha256').update(source).digest('hex') !== sourceManifest.sha256) throw new Error('Build-only font source integrity failed');
  const candidates = process.env.PYTHON ? [process.env.PYTHON] : process.platform === 'win32'
    ? (spawnSync('where.exe', ['python.exe'], { encoding: 'utf8', windowsHide: true }).stdout || '').trim().split(/\r?\n/).filter(file => file && !/[/\\]WindowsApps[/\\]/i.test(file))
    : ['python3', 'python'];
  const python = candidates.find(file => spawnSync(file, ['-c', 'import sys; assert sys.version_info >= (3, 10)'], { windowsHide: true }).status === 0);
  if (!python) throw new Error('New UI glyphs need Python 3.10+. Install Python or set PYTHON to its executable, then run npm run fonts:sync.');
  const dependencyDirectory = path.join(root, '.cache/ui-font-tools');
  const env = { ...process.env, PYTHONPATH: [dependencyDirectory, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) };
  const probe = spawnSync(python, ['-c', "import fontTools, brotli; assert fontTools.__version__ == '4.51.0' and brotli.__version__ == '1.2.0'"], { env, windowsHide: true });
  if (probe.status !== 0) {
    process.stdout.write('Installing hash-locked font subset tools into .cache/ui-font-tools.\n');
    const installation = spawnSync(python, ['-m', 'pip', 'install', '--isolated', '--disable-pip-version-check', '--no-input', '--only-binary=:all:', '--require-hashes', '--no-deps', '--upgrade', '--index-url', 'https://pypi.org/simple', '--target', dependencyDirectory, '--requirement', path.join(root, 'scripts/ui-fonts-requirements.lock')], { env, stdio: 'inherit', windowsHide: true });
    if (installation.status !== 0) throw new Error('Font subset tool installation failed; current fonts were not modified.');
  }
  if (!existsSync(path.join(root, 'scripts/sync-ui-fonts.py'))) throw new Error('Font generator is missing');
  const result = spawnSync(python, [path.join(root, 'scripts/sync-ui-fonts.py')], { input: JSON.stringify(plan), encoding: 'utf8', env, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`UI font generation failed: ${result.stderr || result.error?.message || result.status}`);
  process.stdout.write(result.stdout);
}
