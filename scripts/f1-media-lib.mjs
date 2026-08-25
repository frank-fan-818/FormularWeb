import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export function normalizeMediaId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildMediaIndex(entries) {
  const index = new Map();
  Object.entries(entries).forEach(([canonicalId, entry]) => {
    index.set(normalizeMediaId(canonicalId), canonicalId);
    for (const alias of entry.aliases ?? []) {
      index.set(normalizeMediaId(alias), canonicalId);
    }
  });
  return index;
}

export function detectImageFormat(contents) {
  if (contents.length >= 8 && contents.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'png';
  }
  if (
    contents.length >= 12
    && contents.subarray(0, 4).toString('ascii') === 'RIFF'
    && contents.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  if (contents.length >= 12 && contents.subarray(4, 12).toString('ascii').startsWith('ftyp')) {
    const brand = contents.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'avif';
  }
  if (contents.subarray(0, 512).toString('utf8').trimStart().startsWith('<svg')) return 'svg';
  return 'unknown';
}

function validateEntries(kind, entries) {
  const errors = [];
  const seen = new Map();
  for (const [canonicalId, entry] of Object.entries(entries ?? {})) {
    const ids = [canonicalId, ...(entry.aliases ?? [])];
    for (const id of ids) {
      const normalized = normalizeMediaId(id);
      if (!normalized) errors.push(`Empty ${kind} ID or alias on ${canonicalId}`);
      const previous = seen.get(normalized);
      if (previous && previous !== canonicalId) {
        errors.push(`Duplicate ${kind} ID or alias "${id}" on ${previous} and ${canonicalId}`);
      }
      seen.set(normalized, canonicalId);
    }

    if (
      typeof entry.file !== 'string'
      || path.basename(entry.file) !== entry.file
      || !/^[a-z0-9][a-z0-9_.-]*\.(?:png|webp|svg)$/i.test(entry.file)
    ) {
      errors.push(`Unsafe media filename for ${kind} ${canonicalId}: ${entry.file}`);
    }
  }
  return errors;
}

export function validateManifest(manifest) {
  const errors = [];
  if (manifest?.version !== 1) errors.push('Unsupported or missing media manifest version');
  if (!Number.isInteger(manifest?.season)) errors.push('Media manifest season must be an integer');
  errors.push(...validateEntries('driver', manifest?.drivers));
  errors.push(...validateEntries('constructor', manifest?.constructors));
  return errors;
}

export async function auditLocalMedia(manifest, publicDir) {
  const errors = [...validateManifest(manifest)];
  const driverHashes = new Map();

  for (const [kind, entries] of [
    ['driver', manifest.drivers],
    ['constructor', manifest.constructors],
  ]) {
    const directory = kind === 'driver' ? 'drivers' : 'constructors';
    for (const [canonicalId, entry] of Object.entries(entries)) {
      const filePath = path.join(publicDir, 'images', directory, entry.file);
      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile() || fileStat.size < 256) {
          errors.push(`Invalid ${kind} asset: ${entry.file}`);
          continue;
        }
        const contents = await readFile(filePath);
        const detectedFormat = detectImageFormat(contents);
        const expectedFormat = path.extname(entry.file).slice(1).toLowerCase();
        if (detectedFormat !== expectedFormat) {
          errors.push(
            `${kind} asset format does not match filename: ${entry.file} `
            + `(expected ${expectedFormat}, found ${detectedFormat})`,
          );
          continue;
        }
        if (kind === 'driver') {
          const hash = createHash('sha256').update(contents).digest('hex');
          const files = driverHashes.get(hash) ?? [];
          files.push(`${canonicalId}:${entry.file}`);
          driverHashes.set(hash, files);
        }
      } catch {
        errors.push(`Missing ${kind} asset: ${entry.file}`);
      }
    }
  }

  for (const files of driverHashes.values()) {
    if (files.length > 1) errors.push(`Duplicate driver assets: ${files.join(', ')}`);
  }
  return errors;
}

export function findRosterGaps(manifest, roster) {
  const driverIndex = buildMediaIndex(manifest.drivers);
  const constructorIndex = buildMediaIndex(manifest.constructors);
  return {
    drivers: [...new Set(roster.driverIds.map(normalizeMediaId).filter((id) => !driverIndex.has(id)))].sort(),
    constructors: [...new Set(roster.constructorIds.map(normalizeMediaId).filter((id) => !constructorIndex.has(id)))].sort(),
  };
}

export async function loadMediaManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, 'src', 'data', 'f1-media-manifest.json');
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}
