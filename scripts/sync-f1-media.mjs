import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  auditLocalMedia,
  buildMediaIndex,
  detectImageFormat,
  findRosterGaps,
  loadMediaManifest,
  normalizeMediaId,
} from './f1-media-lib.mjs';

const OPENF1_DRIVERS_URL = 'https://api.openf1.org/v1/drivers?session_key=latest';
const JOLPICA_STANDINGS_URL = 'https://api.jolpi.ca/ergast/f1/current/driverstandings/';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = await loadMediaManifest(projectRoot);
const sources = JSON.parse(
  await readFile(path.join(projectRoot, 'scripts', 'f1-media-sources.json'), 'utf8'),
);

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Request failed (${response.status}): ${url}`);
  return response.json();
}

async function discoverRoster() {
  const payload = await fetchJson(JOLPICA_STANDINGS_URL);
  const standings = payload?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
  return {
    driverIds: standings.map((row) => row.Driver?.driverId).filter(Boolean),
    constructorIds: standings.flatMap((row) => row.Constructors ?? [])
      .map((constructor) => constructor.constructorId)
      .filter(Boolean),
  };
}

function printRosterGaps(gaps) {
  if (gaps.drivers.length === 0 && gaps.constructors.length === 0) {
    console.log('Current roster is fully represented in the media manifest.');
    return false;
  }
  if (gaps.drivers.length > 0) console.error(`Unknown drivers: ${gaps.drivers.join(', ')}`);
  if (gaps.constructors.length > 0) console.error(`Unknown constructors: ${gaps.constructors.join(', ')}`);
  return true;
}

async function downloadImage(url, destination) {
  const expectedFormat = path.extname(destination).slice(1).toLowerCase();
  const acceptedType = expectedFormat === 'svg' ? 'image/svg+xml' : `image/${expectedFormat}`;
  const response = await fetch(url, { headers: { accept: acceptedType } });
  if (!response.ok) throw new Error(`Image request failed (${response.status}): ${url}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Expected an image but received ${contentType || 'unknown content'}: ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 256) throw new Error(`Image response is suspiciously small (${bytes.length} bytes): ${url}`);
  const detectedFormat = detectImageFormat(bytes);
  if (detectedFormat !== expectedFormat) {
    throw new Error(
      `Downloaded ${detectedFormat} media for a .${expectedFormat} destination: ${url}`,
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  console.log(`Updated ${path.relative(projectRoot, destination)} (${bytes.length} bytes)`);
}

async function syncDrivers() {
  const rows = await fetchJson(OPENF1_DRIVERS_URL);
  const index = buildMediaIndex(manifest.drivers);
  const discoveredSources = new Map();

  for (const row of rows) {
    if (!row?.headshot_url) continue;
    const candidates = [
      row.last_name,
      `${row.first_name ?? ''}_${row.last_name ?? ''}`,
      row.full_name,
    ].map(normalizeMediaId);
    const canonicalId = candidates.map((candidate) => index.get(candidate)).find(Boolean);
    if (canonicalId) discoveredSources.set(canonicalId, row.headshot_url);
  }

  for (const [canonicalId, url] of Object.entries(sources.driverOverrides ?? {})) {
    discoveredSources.set(canonicalId, url);
  }

  for (const [canonicalId, url] of discoveredSources) {
    const entry = manifest.drivers[canonicalId];
    if (!entry) {
      console.warn(`Skipping undeclared driver source: ${canonicalId}`);
      continue;
    }
    await downloadImage(
      url,
      path.join(projectRoot, 'public', 'images', 'drivers', entry.file),
    );
  }
}

async function syncConstructors() {
  for (const [canonicalId, url] of Object.entries(sources.constructors ?? {})) {
    const entry = manifest.constructors[canonicalId];
    if (!entry) {
      console.warn(`Skipping undeclared constructor source: ${canonicalId}`);
      continue;
    }
    await downloadImage(
      url,
      path.join(projectRoot, 'public', 'images', 'constructors', entry.file),
    );
  }
}

const discoverOnly = process.argv.includes('--discover-only');
const roster = await discoverRoster();
const gaps = findRosterGaps(manifest, roster);
if (printRosterGaps(gaps)) process.exitCode = 1;

if (!discoverOnly) {
  await syncDrivers();
  await syncConstructors();
  const errors = await auditLocalMedia(manifest, path.join(projectRoot, 'public'));
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log('F1 media sync and local audit completed successfully.');
  }
}
