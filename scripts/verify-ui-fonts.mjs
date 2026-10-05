import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, 'public', 'fonts');
const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
const failures = [];
if (!manifest.assets.length || !manifest.uiCodepoints.length) throw new Error('Font manifest must include assets and UI glyphs');
const declared = new Set(manifest.assets.map(asset => asset.file));
for (const file of await readdir(directory)) {
  if (file.endsWith('.woff2') && !declared.has(file)) failures.push(`Undeclared font asset: ${file}`);
}
for (const asset of manifest.assets) {
  if (path.basename(asset.file) !== asset.file) throw new Error('Font manifest contains an invalid path');
  const bytes = await readFile(path.join(directory, asset.file));
  if (bytes.toString('ascii', 0, 4) !== 'wOF2' || bytes.length !== asset.bytes
      || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) failures.push(`Invalid font: ${asset.file}`);
}
for (const family of ['sans', 'sans-condensed', 'sans-sc', 'mono']) {
  const license = await readFile(path.join(directory, `LICENSE-plex-${family}.txt`), 'utf8');
  if (!license.includes('SIL OPEN FONT LICENSE')) failures.push(`Missing OFL license: ${family}`);
}
const points = new Set(manifest.uiCodepoints);
async function verifySource(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await verifySource(filename);
    else if (/\.(?:ts|tsx|json)$/.test(entry.name) && !entry.name.includes('.test.')) {
      const source = await readFile(filename, 'utf8');
      const decoded = source + [...source.matchAll(/\\u([0-9a-f]{4})/gi)].map(match => String.fromCodePoint(parseInt(match[1], 16))).join('');
      for (const char of decoded) {
        const point = char.codePointAt(0);
        if ((point >= 0x2e80 && point <= 0x9fff || point >= 0xff00 && point <= 0xffef) && !points.has(point)) {
          failures.push(`UI font missing U+${point.toString(16).toUpperCase()} in ${path.relative(root, filename)}`);
        }
      }
    }
  }
}
await verifySource(path.join(root, 'src'));
const titlePoints = new Set(manifest.accountTitleCodepoints);
const titleCopy = [];
for (const filename of ['Register.tsx', 'ForgotPassword.tsx', 'ResetPassword.tsx']) {
  const source = await readFile(path.join(root, 'src', 'pages', filename), 'utf8');
  titleCopy.push(...[...source.matchAll(/title="([^"]+)"/g)].map(match => match[1]));
}
const login = await readFile(path.join(root, 'src', 'pages', 'Login.tsx'), 'utf8');
for (const match of login.matchAll(/title=\{session \? '([^']+)' : '([^']+)'\}/g)) titleCopy.push(match[1], match[2]);
for (const char of titleCopy.join('')) {
  const point = char.codePointAt(0);
  if (point >= 0x2e80 && point <= 0x9fff && !titlePoints.has(point)) failures.push('Account title glyphs changed; regenerate fonts');
}
const css = await readFile(path.join(root, 'src', 'styles', 'fonts.css'), 'utf8');
if (/https?:/i.test(css) || [...css.matchAll(/font-display:\s*([^;}]+)/gi)].some(match => match[1].trim() !== 'optional')) failures.push('UI fonts must be self-hosted and use optional loading');
if ([...css.matchAll(/@font-face\s*\{/g)].length !== manifest.assets.length
    || manifest.assets.some(asset => !css.includes(`/fonts/${asset.file}`))) failures.push('Font CSS must match every declared font asset');
if (failures.length) throw new Error([...new Set(failures)].join('\n'));
process.stdout.write(`Font verification passed: ${manifest.assets.length} WOFF2 assets, ${points.size} UI codepoints, OFL licenses and SHA-256 hashes.\n`);
