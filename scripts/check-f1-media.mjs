import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { auditLocalMedia, loadMediaManifest } from './f1-media-lib.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = await loadMediaManifest(projectRoot);
const errors = await auditLocalMedia(manifest, path.join(projectRoot, 'public'));

if (errors.length > 0) {
  console.error('F1 media audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `F1 media audit passed: ${Object.keys(manifest.drivers).length} drivers, `
    + `${Object.keys(manifest.constructors).length} constructors.`,
  );
}
