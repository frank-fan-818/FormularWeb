// Refresh the bundled fallback from a local F1DB checkout (CC BY 4.0).
// Usage: node scripts/generate-circuit-profiles.mjs [path/to/f1db/src/data]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parse } from 'yaml';

const root = resolve(process.argv[2] || 'f1db-main/src/data');
const read = path => parse(readFileSync(path, 'utf8'));
const throughSeason = 2025; // Only completed seasons in the bundled reference.
const races = [];
for (const season of readdirSync(join(root, 'seasons')).filter(value => /^\d{4}$/.test(value) && Number(value) <= throughSeason).sort()) {
  const directory = join(root, 'seasons', season, 'races');
  if (!existsSync(directory)) continue;
  for (const round of readdirSync(directory).sort()) {
    const path = join(directory, round, 'race.yml');
    if (existsSync(path)) races.push({ ...read(path), season: Number(season) });
  }
}
const profiles = {};
for (const file of readdirSync(join(root, 'circuits')).filter(file => file.endsWith('.yml')).sort()) {
  const circuit = read(join(root, 'circuits', file));
  const history = races.filter(race => race.circuitId === circuit.id);
  const last = history.at(-1);
  if (!last) continue; // A planned venue needs a reviewed source, not invented history.
  const country = read(join(root, 'countries', `${circuit.countryId}.yml`));
  profiles[circuit.id.replaceAll('-', '_')] = {
    name: circuit.fullName, locality: circuit.placeName, country: country.name,
    lat: circuit.latitude, long: circuit.longitude,
    length: Number(last.courseLength).toFixed(3), turns: last.turns,
    direction: last.direction, firstRace: history[0].season, totalRaces: history.length,
    raceLaps: last.scheduledLaps || last.laps,
    totalDistance: `${Number(last.scheduledDistance || last.distance).toFixed(3)} km`,
  };
}
// Reviewed 2026 debut; supersedes the older proposed layout in the reference.
// https://www.formula1.com/en/racing/2026/spain
profiles.madring = {
  name: 'Madring', locality: 'Madrid', country: 'Spain', lat: 40.465278, long: -3.615278,
  length: '5.414', turns: 22, direction: 'CLOCKWISE', firstRace: 2026,
  totalRaces: 1, raceLaps: 57, totalDistance: '308.399 km',
};
const output = '{\n' + Object.entries(profiles).sort(([a], [b]) => a.localeCompare(b))
  .map(([id, profile]) => `  ${JSON.stringify(id)}: ${JSON.stringify(profile)}`).join(',\n') + '\n}\n';
writeFileSync('src/data/circuit-profiles.json', output);
console.log(`Generated ${Object.keys(profiles).length} circuit profiles (completed seasons through ${throughSeason}; reviewed Madring 2026 override).`);
