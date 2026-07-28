import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import YAML from 'yaml';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, 'f1db-main', 'src', 'data');
const SEASONS_ROOT = path.join(DATA_ROOT, 'seasons');
const CHUNK_SIZE = 500;

const circuitIdAliases = {
  albert_park: 'melbourne',
  melbourne: 'melbourne',
  red_bull_ring: 'spielberg',
  spielberg: 'spielberg',
  spa: 'spa_francorchamps',
  spa_francorchamps: 'spa_francorchamps',
  villeneuve: 'montreal',
  montreal: 'montreal',
  rodriguez: 'mexico_city',
  mexico_city: 'mexico_city',
  monaco_circuit: 'monaco',
  monaco: 'monaco',
  losail: 'lusail',
  lusail: 'lusail',
  vegas: 'las_vegas',
  las_vegas: 'las_vegas',
  americas: 'austin',
  austin: 'austin',
  cota: 'austin',
  circuit_of_the_americas: 'austin',
  paul_ricard: 'paul_ricard',
  ricard: 'paul_ricard',
  jeddah: 'jeddah',
  jeddah_corniche: 'jeddah',
};

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

function getSupabaseCircuitId(value) {
  const normalized = normalizeId(value);
  return circuitIdAliases[normalized] || normalized;
}

function toIntegerOrNull(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function chooseBetterRaceResult(left, right) {
  const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
  const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
  if (rightPosition < leftPosition) {
    return right;
  }
  if (leftPosition < rightPosition) {
    return left;
  }

  const leftLaps = left.laps ?? -1;
  const rightLaps = right.laps ?? -1;
  if (rightLaps > leftLaps) {
    return right;
  }
  if (leftLaps > rightLaps) {
    return left;
  }

  const leftPoints = left.points ?? -1;
  const rightPoints = right.points ?? -1;
  return rightPoints > leftPoints ? right : left;
}

function chooseBetterQualifyingResult(left, right) {
  const leftPosition = left.position ?? Number.POSITIVE_INFINITY;
  const rightPosition = right.position ?? Number.POSITIVE_INFINITY;
  if (rightPosition < leftPosition) {
    return right;
  }
  if (leftPosition < rightPosition) {
    return left;
  }

  const leftDepth = [left.q1_time, left.q2_time, left.q3_time].filter(Boolean).length;
  const rightDepth = [right.q1_time, right.q2_time, right.q3_time].filter(Boolean).length;
  return rightDepth > leftDepth ? right : left;
}

function readYamlFile(filePath) {
  return YAML.parse(fs.readFileSync(filePath, 'utf8'));
}

async function fetchAllValues(table, column) {
  const values = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(from, from + 999);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    values.push(...data.map((row) => row[column]));

    if (data.length < 1000) {
      break;
    }

    from += 1000;
  }

  return values;
}

async function insertChunks(table, rows) {
  let inserted = 0;

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      throw error;
    }
    inserted += chunk.length;
  }

  return inserted;
}

async function upsertChunks(table, rows, onConflict) {
  let processed = 0;

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw error;
    }
    processed += chunk.length;
  }

  return processed;
}

function buildCircuitRows() {
  const circuitsDir = path.join(DATA_ROOT, 'circuits');
  const files = fs.readdirSync(circuitsDir).filter((file) => file.endsWith('.yml'));

  return files.map((file) => {
    const source = readYamlFile(path.join(circuitsDir, file));
    const circuitId = getSupabaseCircuitId(source.id);
    return {
      circuit_id: circuitId,
      name: source.name || source.fullName || source.id,
      locality: source.placeName || null,
      country: source.countryId || null,
      lat: source.latitude ?? null,
      long: source.longitude ?? null,
      length: source.length ?? null,
      turns: source.turns ?? null,
      direction: source.direction || null,
    };
  });
}

function buildConstructorRows() {
  const constructorsDir = path.join(DATA_ROOT, 'constructors');
  const files = fs.readdirSync(constructorsDir).filter((file) => file.endsWith('.yml'));

  return files.map((file) => {
    const source = readYamlFile(path.join(constructorsDir, file));
    return {
      constructor_id: normalizeId(source.id),
      name: source.name || source.fullName || source.id,
      nationality: source.countryId || null,
      total_race_entries: source.totalRaceEntries ?? null,
      total_wins: source.totalRaceWins ?? null,
      total_podiums: source.totalPodiums ?? null,
      total_pole_positions: source.totalPolePositions ?? null,
      total_fastest_laps: source.totalFastestLaps ?? null,
      total_championships: source.totalChampionshipWins ?? null,
    };
  });
}

function buildDriverRows() {
  const driversDir = path.join(DATA_ROOT, 'drivers');
  const files = fs.readdirSync(driversDir).filter((file) => file.endsWith('.yml'));

  return files.map((file) => {
    const source = readYamlFile(path.join(driversDir, file));
    return {
      driver_id: normalizeId(source.id),
      first_name: source.firstName || null,
      last_name: source.lastName || null,
      code: source.abbreviation || null,
      permanent_number: source.permanentNumber || null,
      date_of_birth: source.dateOfBirth || null,
      nationality: source.nationalityCountryId || null,
      total_race_entries: source.totalRaceEntries ?? null,
      total_race_starts: source.totalRaceStarts ?? null,
      total_wins: source.totalRaceWins ?? null,
      total_podiums: source.totalPodiums ?? null,
      total_pole_positions: source.totalPolePositions ?? null,
      total_fastest_laps: source.totalFastestLaps ?? null,
      total_championships: source.totalChampionshipWins ?? null,
    };
  });
}

function getSeasonFolders() {
  return fs.readdirSync(SEASONS_ROOT)
    .filter((name) => /^\d+$/.test(name))
    .sort((left, right) => Number(left) - Number(right));
}

function buildRaceImportPayload(existingRaceIds, existingResultRaceIds, existingQualifyingRaceIds) {
  const seasons = getSeasonFolders();
  const seasonRows = [];
  const raceRows = [];
  const resultRowMap = new Map();
  const qualifyingRowMap = new Map();

  const existingSeasonYears = new Set();

  seasons.forEach((seasonName) => {
    const year = Number(seasonName);
    if (!existingSeasonYears.has(year)) {
      seasonRows.push({ year });
      existingSeasonYears.add(year);
    }

    const racesDir = path.join(SEASONS_ROOT, seasonName, 'races');
    const raceFolders = fs.readdirSync(racesDir)
      .filter((name) => fs.statSync(path.join(racesDir, name)).isDirectory())
      .sort();

    raceFolders.forEach((raceFolder) => {
      const raceRoot = path.join(racesDir, raceFolder);
      const raceFile = path.join(raceRoot, 'race.yml');
      if (!fs.existsSync(raceFile)) {
        return;
      }

      const race = readYamlFile(raceFile);
      const raceId = Number(race.id);
      const isSprintWeekend = fs.existsSync(path.join(raceRoot, 'sprint-race-results.yml'))
        || fs.existsSync(path.join(raceRoot, 'sprint-qualifying-results.yml'))
        || fs.existsSync(path.join(raceRoot, 'sprint-starting-grid-positions.yml'));

      if (!existingRaceIds.has(raceId)) {
        raceRows.push({
          id: raceId,
          season: year,
          round: Number(race.round),
          race_name: race.officialName || race.grandPrixId || raceFolder,
          circuit_id: getSupabaseCircuitId(race.circuitId),
          date: race.date || null,
          time: race.time || null,
          is_sprint_weekend: isSprintWeekend,
        });
      }

      const fastestLapsFile = path.join(raceRoot, 'fastest-laps.yml');
      const fastestLaps = fs.existsSync(fastestLapsFile) ? readYamlFile(fastestLapsFile) : [];
      const fastestLapMap = new Map(
        fastestLaps.map((item) => [
          normalizeId(item.driverId),
          {
            fastest_lap_rank: item.position ?? null,
            fastest_lap_time: item.time ?? null,
          },
        ]),
      );

      const raceResultsFile = path.join(raceRoot, 'race-results.yml');
      if (fs.existsSync(raceResultsFile) && !existingResultRaceIds.has(raceId)) {
        const raceResults = readYamlFile(raceResultsFile) || [];
        raceResults.forEach((item) => {
          const driverId = normalizeId(item.driverId);
          const fastestLap = fastestLapMap.get(driverId);
          const resultRow = {
            race_id: raceId,
            driver_id: driverId,
            constructor_id: normalizeId(item.constructorId),
            position: toIntegerOrNull(item.position),
            grid_position: toIntegerOrNull(item.gridPosition),
            points: toNumberOrNull(item.points) ?? 0,
            laps: toIntegerOrNull(item.laps),
            status: item.reasonRetired || 'Finished',
            time: item.time || item.gap || item.interval || null,
            fastest_lap_rank: toIntegerOrNull(fastestLap?.fastest_lap_rank),
            fastest_lap_time: fastestLap?.fastest_lap_time ?? null,
          };
          const resultKey = `${raceId}:${driverId}`;
          const existingRow = resultRowMap.get(resultKey);
          resultRowMap.set(resultKey, existingRow ? chooseBetterRaceResult(existingRow, resultRow) : resultRow);
        });
      }

      const qualifyingResultsFile = path.join(raceRoot, 'qualifying-results.yml');
      if (fs.existsSync(qualifyingResultsFile) && !existingQualifyingRaceIds.has(raceId)) {
        const qualifyingResults = readYamlFile(qualifyingResultsFile) || [];
        qualifyingResults.forEach((item) => {
          const qualifyingRow = {
            race_id: raceId,
            driver_id: normalizeId(item.driverId),
            constructor_id: normalizeId(item.constructorId),
            position: toIntegerOrNull(item.position),
            q1_time: item.q1 || null,
            q2_time: item.q2 || null,
            q3_time: item.q3 || null,
          };
          const qualifyingKey = `${raceId}:${qualifyingRow.driver_id}`;
          const existingRow = qualifyingRowMap.get(qualifyingKey);
          qualifyingRowMap.set(
            qualifyingKey,
            existingRow ? chooseBetterQualifyingResult(existingRow, qualifyingRow) : qualifyingRow,
          );
        });
      }
    });
  });

  return {
    seasonRows,
    raceRows,
    resultRows: [...resultRowMap.values()],
    qualifyingRows: [...qualifyingRowMap.values()],
  };
}

async function main() {
  console.log('Auditing and importing f1db data into the current Supabase schema...');

  const [
    existingCircuitIds,
    existingConstructorIds,
    existingDriverIds,
    existingSeasonYears,
    existingRaceIds,
    existingResultRaceIds,
    existingQualifyingRaceIds,
  ] = await Promise.all([
    fetchAllValues('circuits', 'circuit_id'),
    fetchAllValues('constructors', 'constructor_id'),
    fetchAllValues('drivers', 'driver_id'),
    fetchAllValues('seasons', 'year'),
    fetchAllValues('races', 'id'),
    fetchAllValues('race_results', 'race_id'),
    fetchAllValues('qualifying_results', 'race_id'),
  ]);

  const existingCircuitIdSet = new Set(existingCircuitIds);
  const existingConstructorIdSet = new Set(existingConstructorIds);
  const existingDriverIdSet = new Set(existingDriverIds);
  const existingSeasonYearSet = new Set(existingSeasonYears);
  const existingRaceIdSet = new Set(existingRaceIds);
  const existingResultRaceIdSet = new Set(existingResultRaceIds);
  const existingQualifyingRaceIdSet = new Set(existingQualifyingRaceIds);

  const circuitRows = buildCircuitRows().filter((row) => !existingCircuitIdSet.has(row.circuit_id));
  const constructorRows = buildConstructorRows().filter((row) => !existingConstructorIdSet.has(row.constructor_id));
  const driverRows = buildDriverRows().filter((row) => !existingDriverIdSet.has(row.driver_id));

  const { seasonRows, raceRows, resultRows, qualifyingRows } = buildRaceImportPayload(
    existingRaceIdSet,
    existingResultRaceIdSet,
    existingQualifyingRaceIdSet,
  );

  const missingSeasonRows = seasonRows.filter((row) => !existingSeasonYearSet.has(row.year));

  console.log('Import plan:');
  console.log(`- circuits to insert: ${circuitRows.length}`);
  console.log(`- constructors to insert: ${constructorRows.length}`);
  console.log(`- drivers to insert: ${driverRows.length}`);
  console.log(`- seasons to insert: ${missingSeasonRows.length}`);
  console.log(`- races to insert: ${raceRows.length}`);
  console.log(`- race results to insert: ${resultRows.length}`);
  console.log(`- qualifying results to insert: ${qualifyingRows.length}`);

  if (circuitRows.length > 0) {
    await upsertChunks('circuits', circuitRows, 'circuit_id');
  }

  if (constructorRows.length > 0) {
    await upsertChunks('constructors', constructorRows, 'constructor_id');
  }

  if (driverRows.length > 0) {
    await upsertChunks('drivers', driverRows, 'driver_id');
  }

  if (missingSeasonRows.length > 0) {
    await insertChunks('seasons', missingSeasonRows);
  }

  if (raceRows.length > 0) {
    await insertChunks('races', raceRows);
  }

  if (resultRows.length > 0) {
    await insertChunks('race_results', resultRows);
  }

  if (qualifyingRows.length > 0) {
    await insertChunks('qualifying_results', qualifyingRows);
  }

  console.log('Import finished successfully.');
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exitCode = 1;
});
