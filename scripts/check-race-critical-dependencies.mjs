import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const seen = new Set();
function visit(key) {
  if (seen.has(key)) return;
  seen.add(key);
  manifest[key]?.imports?.forEach(visit);
}
visit('src/pages/Race/RaceLayout.tsx');
visit('src/pages/Race/RaceResults.tsx');
const files = [...seen].map(key => manifest[key]?.file).filter(Boolean);
assert.ok(!files.some(file => /\/(?:supabase|axios-vendor|ergast|fastf1Analytics|raceWeekendAnalytics)-/.test(file)),
  'Optional APIs must not become static dependencies of race classifications');
const bytes = (await Promise.all(files.map(file => stat(`dist/${file}`)))).reduce((sum, entry) => sum + entry.size, 0);
assert.ok(bytes <= 1_100_000, `Race static JS exceeded the 1.1 MB budget: ${bytes}`);
console.log(JSON.stringify({ chunks: files.length, uncompressedJsBytes: bytes, optionalApisExcluded: true }));
