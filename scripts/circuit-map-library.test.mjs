import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateMapRecord, importMaps } from './circuit-map-library.mjs';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const map = { circuitId: 'buddh', publisher: 'FIA', year: 2013,
  asset: '/images/circuits/detailed/buddh.webp', sourcePage: 'https://api.fia.com/events/example',
  sourceUrl: 'https://api.fia.com/sites/default/files/map.pdf', sourceType: 'pdf-page',
  sourceSha256: 'b'.repeat(64), sourceBytes: 1000, renderPage: 1, renderLongestEdge: 1800,
  layout: '2013 Indian Grand Prix', width: 1273, height: 1800, bytes: 5000, sha256: 'a'.repeat(64) };
test('accepts an audited PDF page with provenance and render parameters', () => {
  assert.doesNotThrow(() => validateMapRecord(map, new Set(['buddh'])));
});
test('rejects paths, unrelated identities and unsupported provenance before importing', () => {
  for (const change of [
    { asset: '/images/circuits/detailed/../../secret.webp' }, { circuitId: 'unknown' },
    { sourceUrl: 'http://api.fia.com/map.pdf' }, { sourceUrl: 'https://api.fia.com.evil.example/map.pdf' },
    { sourcePage: 'https://unverified.example/map' }, { sourceType: 'svg' }, { sha256: 'wrong' },
    { renderPage: 0 }, { width: 0 }, { year: 9999 }, { layout: '' },
  ]) assert.throws(() => validateMapRecord({ ...map, ...change }, new Set(['buddh'])));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'f1-circuit-map-'));
  await mkdir(join(root, 'src/data'), { recursive: true });
  await mkdir(join(root, 'scripts/data'), { recursive: true });
  await writeFile(join(root, 'src/data/circuit-detailed-maps.json'), JSON.stringify({ maps: [] }));
  await writeFile(join(root, 'scripts/data/circuit-map-coverage.json'), JSON.stringify({ circuits: [
    { id: 'buddh', status: 'unavailable', reason: 'Test fixture', sources: [] },
  ] }));
  const bytes = await sharp({ create: { width: 800, height: 800, channels: 3, background: 'white' } }).png().toBuffer();
  await writeFile(join(root, 'reviewed.png'), bytes);
  const record = { circuitId: 'buddh', publisher: 'Formula 1', year: null, layout: 'Reviewed test layout',
    asset: '/images/circuits/detailed/buddh.png', sourcePage: 'https://www.formula1.com/example',
    sourceUrl: 'https://media.formula1.com/example.png', sourceType: 'image', width: 800, height: 800,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), file: 'reviewed.png' };
  return { root, record, manifest: join(root, 'src/data/circuit-detailed-maps.json') };
}

test('import is idempotent and preserves pinned provenance', async () => {
  const { root, record, manifest } = await fixture();
  await writeFile(join(root, 'input.json'), JSON.stringify({ maps: [record] }));
  assert.deepEqual(await importMaps('input.json', root), { maps: 1, catalogue: 1 });
  const before = await readFile(manifest, 'utf8');
  await importMaps('input.json', root);
  assert.equal(await readFile(manifest, 'utf8'), before);
  await writeFile(join(root, 'input.json'), JSON.stringify({ maps: [{ ...record, layout: 'Unreviewed replacement' }] }));
  await assert.rejects(importMaps('input.json', root), /Refusing to replace/);
  assert.equal(await readFile(manifest, 'utf8'), before);
});

test('duplicate IDs and corrupt assets leave the library untouched', async () => {
  const { root, record, manifest } = await fixture();
  const before = await readFile(manifest, 'utf8');
  for (const maps of [[record, record], [{ ...record, sha256: '0'.repeat(64) }], [{ ...record, width: 801 }]]) {
    await writeFile(join(root, 'input.json'), JSON.stringify({ maps }));
    await assert.rejects(importMaps('input.json', root));
    assert.equal(await readFile(manifest, 'utf8'), before);
    await assert.rejects(access(join(root, 'public/images/circuits/detailed/buddh.png')));
  }
});
