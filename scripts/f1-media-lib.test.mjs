import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  auditLocalMedia,
  buildMediaIndex,
  detectImageFormat,
  findRosterGaps,
  validateManifest,
} from './f1-media-lib.mjs';

const manifest = {
  version: 1,
  season: 2026,
  drivers: {
    antonelli: { file: 'kimi_antonelli.png', aliases: ['kimi_antonelli'] },
    lindblad: { file: 'lindblad.png', aliases: ['arvid_lindblad'] },
  },
  constructors: {
    audi: { file: 'audi.webp', aliases: [] },
  },
};

test('validateManifest rejects duplicate aliases and unsafe filenames', () => {
  const invalid = structuredClone(manifest);
  invalid.drivers.lindblad.aliases.push('kimi_antonelli');
  invalid.constructors.audi.file = '../audi.webp';

  const errors = validateManifest(invalid);
  assert.ok(errors.some((error) => error.includes('Duplicate driver ID or alias')));
  assert.ok(errors.some((error) => error.includes('Unsafe media filename')));
});

test('buildMediaIndex resolves aliases', () => {
  const index = buildMediaIndex(manifest.drivers);
  assert.equal(index.get('kimi_antonelli'), 'antonelli');
  assert.equal(index.get('arvid_lindblad'), 'lindblad');
});

test('detectImageFormat identifies supported binary signatures', () => {
  assert.equal(detectImageFormat(Buffer.from('89504e470d0a1a0a', 'hex')), 'png');
  assert.equal(detectImageFormat(Buffer.from('524946460000000057454250', 'hex')), 'webp');
  assert.equal(detectImageFormat(Buffer.from('000000206674797061766966', 'hex')), 'avif');
  assert.equal(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg');
});

test('auditLocalMedia reports missing and duplicate driver assets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'f1-media-test-'));
  await mkdir(path.join(root, 'images', 'drivers'), { recursive: true });
  await mkdir(path.join(root, 'images', 'constructors'), { recursive: true });
  const duplicate = Buffer.alloc(1024, 7);
  Buffer.from('89504e470d0a1a0a', 'hex').copy(duplicate);
  await writeFile(path.join(root, 'images', 'drivers', 'kimi_antonelli.png'), duplicate);
  await writeFile(path.join(root, 'images', 'drivers', 'lindblad.png'), duplicate);
  await writeFile(path.join(root, 'images', 'constructors', 'audi.webp'), duplicate);

  const errors = await auditLocalMedia(manifest, root);
  assert.ok(errors.some((error) => error.includes('format does not match')));
  assert.ok(errors.some((error) => error.includes('Duplicate driver assets')));
});

test('findRosterGaps exposes unknown future IDs', () => {
  const gaps = findRosterGaps(manifest, {
    driverIds: ['antonelli', 'future_driver'],
    constructorIds: ['audi', 'future_team'],
  });

  assert.deepEqual(gaps, {
    drivers: ['future_driver'],
    constructors: ['future_team'],
  });
});
