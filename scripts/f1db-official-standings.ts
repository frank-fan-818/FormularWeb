import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import type {
  SummaryOfficialConstructorStandingRow,
  SummaryOfficialDriverStandingRow,
} from '../src/utils/historySummaryAggregation.ts';

const DATA_ROOT = path.join(process.cwd(), 'f1db-main', 'src', 'data');
const SEASONS_ROOT = path.join(DATA_ROOT, 'seasons');

type RawDriverStanding = {
  position?: string | number | null;
  driverId?: string | null;
  points?: string | number | null;
};

type RawConstructorStanding = {
  position?: string | number | null;
  constructorId?: string | null;
  points?: string | number | null;
};

function normalizeId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

function toPositionString(value: string | number | null | undefined): string | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : null;
}

function toPoints(value: string | number | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readYamlArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const parsed = YAML.parse(fs.readFileSync(filePath, 'utf8'));
  return Array.isArray(parsed) ? parsed as T[] : [];
}

function getSeasonFolders(): string[] {
  if (!fs.existsSync(SEASONS_ROOT)) {
    return [];
  }

  return fs.readdirSync(SEASONS_ROOT)
    .filter((name) => /^\d+$/.test(name))
    .sort((left, right) => Number(left) - Number(right));
}

export function loadF1DbOfficialStandings(): {
  officialDriverStandings: SummaryOfficialDriverStandingRow[];
  officialConstructorStandings: SummaryOfficialConstructorStandingRow[];
} {
  const officialDriverStandings: SummaryOfficialDriverStandingRow[] = [];
  const officialConstructorStandings: SummaryOfficialConstructorStandingRow[] = [];

  getSeasonFolders().forEach((season) => {
    const seasonRoot = path.join(SEASONS_ROOT, season);

    readYamlArray<RawDriverStanding>(path.join(seasonRoot, 'driver-standings.yml')).forEach((item) => {
      const position = toPositionString(item.position);
      const points = toPoints(item.points);
      const driverId = normalizeId(item.driverId);

      if (!position || points === null || !driverId) {
        return;
      }

      officialDriverStandings.push({
        season,
        driver_id: driverId,
        position,
        points,
      });
    });

    readYamlArray<RawConstructorStanding>(path.join(seasonRoot, 'constructor-standings.yml')).forEach((item) => {
      const position = toPositionString(item.position);
      const points = toPoints(item.points);
      const constructorId = normalizeId(item.constructorId);

      if (!position || points === null || !constructorId) {
        return;
      }

      officialConstructorStandings.push({
        season,
        constructor_id: constructorId,
        position,
        points,
      });
    });
  });

  return {
    officialDriverStandings,
    officialConstructorStandings,
  };
}
