import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';

const manifestPath = 'src/data/circuit-detailed-maps.json';
const coveragePath = 'scripts/data/circuit-map-coverage.json';
const hosts = new Set(['www.formula1.com', 'media.formula1.com', 'api.fia.com',
  'www.okayama-international-circuit.jp', 'www.circuitmagnycours.com', 'msvstatic.com',
  'docs.msv.com', 'www.brandshatch.co.uk', 'www.donington-park.co.uk', 'portalmedia.acp.pt',
  'www.acp.pt', 'www.fim-moto.com', 'resources.worldsbk.com', 'www.worldsbk.com',
  'circuitodejerez.com', 'www.kyalamigrandprixcircuit.com', 'www.mx-5cup.com',
  'imsa.results.alkamelcloud.com', 'www.circuit-dijon-prenois.com', 'www.fsw.tv',
  'fsw.tv', 'storage.googleapis.com', 'www.fiawec.com', 'www.scandinavianraceway.se']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateMapRecord(map, circuitIds) {
  assert(circuitIds.has(map.circuitId), `Unknown circuit: ${map.circuitId}`);
  assert(/^[a-z][a-z0-9_]*$/.test(map.circuitId), 'Invalid circuit ID');
  assert(new RegExp(`^/images/circuits/detailed/${map.circuitId}\\.(webp|png|jpg)$`).test(map.asset), 'Invalid asset path');
  for (const value of [map.sourcePage, map.sourceUrl]) {
    const url = new URL(value);
    assert(url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password, 'Unverified source');
    // The shared Google bucket is accepted only for the WEC publisher's assets.
    if (url.hostname === 'storage.googleapis.com') assert(url.pathname.startsWith('/fiawec-prod/assets/fileuploads/'), 'Unverified bucket');
  }
  assert(typeof map.publisher === 'string' && map.publisher.trim(), 'Missing publisher');
  assert(typeof map.layout === 'string' && map.layout.trim(), 'Missing layout description');
  assert(map.year === null || (Number.isInteger(map.year) && map.year >= 1900 && map.year <= 2100), 'Invalid source year');
  assert(['image', 'pdf-page'].includes(map.sourceType), 'Unsupported source type');
  for (const key of ['width', 'height', 'bytes']) assert(Number.isInteger(map[key]) && map[key] > 0, `Invalid ${key}`);
  assert(map.width >= 800, 'Map must retain readable source resolution');
  assert(/^[a-f0-9]{64}$/.test(map.sha256), 'Invalid asset checksum');
  if (map.sourceType === 'pdf-page') {
    assert(Number.isInteger(map.renderPage) && map.renderPage > 0, 'Invalid PDF page');
    assert(Number.isInteger(map.renderLongestEdge) && map.renderLongestEdge >= 1000, 'Invalid render size');
    assert(Number.isInteger(map.sourceBytes) && map.sourceBytes > 0, 'Missing PDF size');
    assert(/^[a-f0-9]{64}$/.test(map.sourceSha256), 'Missing PDF checksum');
  }
}

async function validateAsset(map, bytes) {
  assert(bytes.length === map.bytes && hash(bytes) === map.sha256, `${map.circuitId}: asset checksum mismatch`);
  const meta = await sharp(bytes).metadata();
  const ext = map.asset.split('.').at(-1);
  assert(meta.format === (ext === 'jpg' ? 'jpeg' : ext), `${map.circuitId}: format mismatch`);
  assert(meta.width === map.width && meta.height === map.height, `${map.circuitId}: dimension mismatch`);
}

export async function checkLibrary(manifest, coverage, root = process.cwd()) {
  const ids = new Set(coverage.circuits.map(circuit => circuit.id));
  assert(ids.size === coverage.circuits.length, 'Duplicate catalogue ID');
  const seen = new Set();
  for (const map of manifest.maps) {
    validateMapRecord(map, ids);
    assert(!seen.has(map.circuitId), `Duplicate map: ${map.circuitId}`);
    seen.add(map.circuitId);
    await validateAsset(map, await readFile(resolve(root, 'public', map.asset.slice(1))));
  }
  for (const circuit of coverage.circuits) {
    assert(['covered', 'unavailable'].includes(circuit.status), 'Invalid coverage status');
    assert((circuit.status === 'covered') === seen.has(circuit.id), `Coverage mismatch: ${circuit.id}`);
    assert(circuit.reason && Array.isArray(circuit.sources), `Missing research decision: ${circuit.id}`);
  }
  return { maps: seen.size, catalogue: ids.size };
}

// Offline import accepts only manually reviewed local assets and pinned metadata.
// All records and bytes are validated before any library file is written.
export async function importMaps(inputPath, root = process.cwd()) {
  const manifest = JSON.parse(await readFile(resolve(root, manifestPath), 'utf8'));
  const coverage = JSON.parse(await readFile(resolve(root, coveragePath), 'utf8'));
  await checkLibrary(manifest, coverage, root);
  const input = JSON.parse(await readFile(resolve(root, inputPath), 'utf8'));
  const ids = new Set(coverage.circuits.map(circuit => circuit.id));
  const byId = new Map(manifest.maps.map(map => [map.circuitId, map]));
  const incoming = new Set();
  const writes = [];
  for (const { file, ...map } of input.maps) {
    validateMapRecord(map, ids);
    assert(!incoming.has(map.circuitId), 'Duplicate incoming map');
    incoming.add(map.circuitId);
    const bytes = await readFile(resolve(root, file));
    await validateAsset(map, bytes);
    const previous = byId.get(map.circuitId);
    assert(!previous || isDeepStrictEqual(previous, map), `Refusing to replace an existing map: ${map.circuitId}`);
    byId.set(map.circuitId, map);
    writes.push({ map, bytes });
  }
  for (const { map, bytes } of writes) {
    await mkdir(resolve(root, 'public/images/circuits/detailed'), { recursive: true });
    await writeFile(resolve(root, 'public', map.asset.slice(1)), bytes);
  }
  manifest.maps = [...byId.values()].sort((a, b) => a.circuitId.localeCompare(b.circuitId));
  for (const circuit of coverage.circuits) if (incoming.has(circuit.id)) {
    const map = byId.get(circuit.id);
    circuit.status = 'covered';
    circuit.reason = map.layout;
    circuit.sources = [...new Set([map.sourcePage, map.sourceUrl])];
  }
  await writeFile(resolve(root, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(root, coveragePath), JSON.stringify(coverage, null, 2) + '\n');
  return checkLibrary(manifest, coverage, root);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = process.argv[2] === '--import'
    ? await importMaps(process.argv[3])
    : await checkLibrary(JSON.parse(await readFile(manifestPath, 'utf8')), JSON.parse(await readFile(coveragePath, 'utf8')));
  process.stdout.write(`Circuit maps verified: ${result.maps}/${result.catalogue}\n`);
}
