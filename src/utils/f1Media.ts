import { f1MediaManifest, type F1MediaEntry } from '@/data/f1MediaManifest';

export interface ResolvedF1Media extends F1MediaEntry {
  canonicalId: string;
  isDeclared: boolean;
  path: string;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildIndex(entries: Record<string, F1MediaEntry>): Map<string, string> {
  const index = new Map<string, string>();
  Object.entries(entries).forEach(([canonicalId, entry]) => {
    index.set(normalizeId(canonicalId), canonicalId);
    entry.aliases.forEach((alias) => index.set(normalizeId(alias), canonicalId));
  });
  return index;
}

const DRIVER_INDEX = buildIndex(f1MediaManifest.drivers);
const CONSTRUCTOR_INDEX = buildIndex(f1MediaManifest.constructors);

function resolveMedia(
  rawId: string,
  entries: Record<string, F1MediaEntry>,
  index: Map<string, string>,
  directory: 'drivers' | 'constructors',
): ResolvedF1Media {
  const normalizedId = normalizeId(rawId);
  const canonicalId = index.get(normalizedId);
  if (canonicalId) {
    const entry = entries[canonicalId];
    return { ...entry, canonicalId, isDeclared: true, path: `/images/${directory}/${entry.file}` };
  }

  const fallbackParts = normalizedId.split('_').filter(Boolean);
  const fallbackId = fallbackParts[fallbackParts.length - 1] || directory.slice(0, -1);
  const extension = directory === 'drivers' ? 'png' : 'png';
  return {
    canonicalId: fallbackId,
    isDeclared: false,
    file: `${fallbackId}.${extension}`,
    aliases: [],
    path: `/images/${directory}/${fallbackId}.${extension}`,
  };
}

export function getDriverMedia(driverId: string): ResolvedF1Media {
  return resolveMedia(driverId, f1MediaManifest.drivers, DRIVER_INDEX, 'drivers');
}

export function getConstructorMedia(constructorId: string): ResolvedF1Media {
  return resolveMedia(constructorId, f1MediaManifest.constructors, CONSTRUCTOR_INDEX, 'constructors');
}

function wordsFromId(value: string): string[] {
  return normalizeId(value).split('_').filter(Boolean);
}

export function getDriverFallbackInitials(
  driverId: string,
  givenName?: string,
  familyName?: string,
): string {
  const givenInitial = givenName?.trim().charAt(0) || '';
  const familyInitial = familyName?.trim().charAt(0) || '';
  if (givenInitial || familyInitial) return `${givenInitial}${familyInitial}`.toUpperCase();

  const words = wordsFromId(driverId);
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'DR';
}

export function getConstructorFallbackLabel(constructorId: string): string {
  const words = wordsFromId(constructorId);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'F1';
}
