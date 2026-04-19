import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DATA_ROOT = path.resolve('f1db-main', 'src', 'data', 'seasons');
const DRIVER_TABLE = 'drivers';
const CONSTRUCTOR_TABLE = 'constructors';
const BATCH_SIZE = 25;
const MAX_RETRIES = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeId(id) {
  return String(id || '').trim().replace(/-/g, '_');
}

function getPositionValue(result) {
  const position = result?.position;
  if (typeof position === 'number') {
    return position;
  }

  const parsed = parseInt(String(position || '').trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function getRaceResultFiles(rootDir) {
  const resultFiles = [];
  const seasons = await fs.readdir(rootDir, { withFileTypes: true });

  for (const season of seasons) {
    if (!season.isDirectory()) {
      continue;
    }

    const racesDir = path.join(rootDir, season.name, 'races');
    let races;

    try {
      races = await fs.readdir(racesDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const race of races) {
      if (!race.isDirectory()) {
        continue;
      }

      const resultFile = path.join(racesDir, race.name, 'race-results.yml');

      try {
        await fs.access(resultFile);
        resultFiles.push(resultFile);
      } catch {
        // Some future races exist in the dataset before results are available.
      }
    }
  }

  return resultFiles;
}

async function collectPodiumCounts() {
  const driverPodiums = new Map();
  const constructorPodiums = new Map();
  const resultFiles = await getRaceResultFiles(DATA_ROOT);

  for (const resultFile of resultFiles) {
    const content = await fs.readFile(resultFile, 'utf8');
    const results = YAML.parse(content);

    if (!Array.isArray(results)) {
      continue;
    }

    for (const result of results) {
      const position = getPositionValue(result);
      if (!position || position > 3) {
        continue;
      }

      const driverId = normalizeId(result.driverId);
      if (driverId) {
        driverPodiums.set(driverId, (driverPodiums.get(driverId) || 0) + 1);
      }

      const constructorId = normalizeId(result.constructorId);
      if (constructorId) {
        constructorPodiums.set(constructorId, (constructorPodiums.get(constructorId) || 0) + 1);
      }
    }
  }

  return {
    resultFiles,
    driverPodiums,
    constructorPodiums,
  };
}

async function loadExistingIds(tableName, idColumn) {
  const { data, error } = await supabase.from(tableName).select(idColumn);
  if (error) {
    throw error;
  }

  return (data || []).map((item) => item[idColumn]).filter(Boolean);
}

function buildRows(ids, counts, idColumn) {
  return ids.map((id) => ({
    [idColumn]: id,
    total_podiums: counts.get(id) || 0,
  }));
}

async function updateRows(tableName, rows, idColumn) {
  let updated = 0;

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const chunk = rows.slice(index, index + BATCH_SIZE);
    const results = [];

    for (const row of chunk) {
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const { error } = await supabase
          .from(tableName)
          .update({ total_podiums: row.total_podiums })
          .eq(idColumn, row[idColumn]);

        if (!error) {
          results.push(1);
          success = true;
          break;
        }

        const message = String(error.message || '');
        const isRetryable = message.includes('502') || message.includes('Bad gateway') || message.includes('Failed to fetch');
        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          throw error;
        }

        await sleep(400 * (attempt + 1));
      }

      if (!success) {
        throw new Error(`Failed to update ${tableName}.${idColumn}=${row[idColumn]}`);
      }
    }

    updated += results.length;
    await sleep(150);
  }

  return updated;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const [{ resultFiles, driverPodiums, constructorPodiums }, driverIds, constructorIds] = await Promise.all([
    collectPodiumCounts(),
    loadExistingIds(DRIVER_TABLE, 'driver_id'),
    loadExistingIds(CONSTRUCTOR_TABLE, 'constructor_id'),
  ]);

  const driverRows = buildRows(driverIds, driverPodiums, 'driver_id');
  const constructorRows = buildRows(constructorIds, constructorPodiums, 'constructor_id');

  const driverSample = ['lewis_hamilton', 'max_verstappen', 'charles_leclerc', 'ayrton_senna']
    .map((id) => ({ id, total_podiums: driverPodiums.get(id) || 0 }));
  const constructorSample = ['ferrari', 'mclaren', 'mercedes', 'red_bull']
    .map((id) => ({ id, total_podiums: constructorPodiums.get(id) || 0 }));

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    raceFilesScanned: resultFiles.length,
    driversInDatabase: driverIds.length,
    constructorsInDatabase: constructorIds.length,
    driversWithPodiums: driverPodiums.size,
    constructorsWithPodiums: constructorPodiums.size,
    driverSample,
    constructorSample,
  }, null, 2));

  if (!apply) {
    return;
  }

  const [updatedDrivers, updatedConstructors] = await Promise.all([
    updateRows(DRIVER_TABLE, driverRows, 'driver_id'),
    updateRows(CONSTRUCTOR_TABLE, constructorRows, 'constructor_id'),
  ]);

  console.log(JSON.stringify({
    updatedDrivers,
    updatedConstructors,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
