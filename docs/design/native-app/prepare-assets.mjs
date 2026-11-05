// Reuse the site's licensed typography and portraits in a file-openable review prototype.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const destination = resolve(import.meta.dirname, 'site-assets.css');
const faces = await readFile(resolve(root, 'src/styles/fonts.css'), 'utf8');
const sources = [...faces.matchAll(/url\('\/fonts\/([^']+)'\)/g)];
let output = faces.replaceAll('font-display: optional', 'font-display: swap');
for (const [, filename] of sources) {
  const bytes = await readFile(resolve(root, 'public/fonts', filename));
  output = output.replace(`url('/fonts/${filename}')`, `url('data:font/woff2;base64,${bytes.toString('base64')}')`);
}
for (const [id, filename] of Object.entries({ leclerc: 'leclerc', norris: 'norris', verstappen: 'max_verstappen', piastri: 'piastri', hamilton: 'hamilton', russell: 'russell' })) {
  const bytes = await readFile(resolve(root, `public/images/drivers/${filename}.png`));
  output += `\n.portrait[data-driver="${id}"]{background-image:url('data:image/png;base64,${bytes.toString('base64')}')}\n`;
}
await writeFile(destination, `/* Generated from existing website assets by prepare-assets.mjs.\n * Original font licenses: public/fonts/LICENSE-*.txt. Do not hand-edit. */\n${output}`);
process.stdout.write(`${JSON.stringify({ output: destination, fonts: sources.length, portraits: 6 })}\n`);
