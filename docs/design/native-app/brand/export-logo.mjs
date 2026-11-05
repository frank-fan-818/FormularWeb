// Raster exports and review previews of the authored SVGs, without changing the vector sources.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const folder = import.meta.dirname;
const previews = resolve(folder, '../../../../artifacts/native-android/design');
await mkdir(previews, { recursive: true });
const logo = await readFile(resolve(folder, 'frankpitwall-logo-light.svg'));
const mark = await readFile(resolve(folder, 'frankpitwall-mark-light.svg'));
await sharp(logo, { density: 288 }).resize({ width: 956 }).png().toFile(resolve(folder, 'frankpitwall-logo.png'));
await sharp(mark, { density: 288 }).resize({ width: 256 }).png().toFile(resolve(folder, 'frankpitwall-mark.png'));
await sharp(logo, { density: 288 }).resize({ width: 716 }).flatten({ background: '#ffffff' })
  .extend({ top: 28, bottom: 28, left: 26, right: 26, background: '#ffffff' }).png()
  .toFile(resolve(previews, 'frankpitwall-logo-linked-preview.png'));
await sharp(mark, { density: 288 }).resize({ width: 192 }).flatten({ background: '#ffffff' })
  .extend({ top: 28, bottom: 28, left: 28, right: 28, background: '#ffffff' }).png()
  .toFile(resolve(previews, 'frankpitwall-mark-linked-preview.png'));
process.stdout.write('Exported linked FP logo and symbol PNGs.\n');
