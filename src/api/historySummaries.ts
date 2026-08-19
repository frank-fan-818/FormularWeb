import type {
  BestFinishSummary,
  ConstructorHistoryProfile,
  ConstructorHistorySummaryRecord,
  ConstructorSeasonHistoryItem,
  DriverHistoryProfile,
  DriverHistorySummaryRecord,
  DriverSeasonHistoryItem,
  HistoryCareerSummary,
} from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function sortSeasonsDescending<T extends { season: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => parseInt(right.season, 10) - parseInt(left.season, 10));
}

function mapCareerSummary(value: unknown): HistoryCareerSummary {
  const record = isRecord(value) ? value : {};

  return {
    raceCount: toNumberValue(record.raceCount),
    poleCount: toNumberValue(record.poleCount),
    winCount: toNumberValue(record.winCount),
    podiumCount: toNumberValue(record.podiumCount),
    championshipCount: toNumberValue(record.championshipCount),
    totalPoints: toNumberValue(record.totalPoints),
  };
}

function hasUsableCareerHistory(
  summary: HistoryCareerSummary,
  seasons: Array<{ season: string }>,
): boolean {
  return seasons.length > 0 && summary.raceCount > 0;
}

function mapBestFinishSummary(value: unknown): BestFinishSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const position = toStringValue(value.position);
  const seasons = Array.isArray(value.seasons)
    ? value.seasons.map((season) => toStringValue(season)).filter(Boolean)
    : [];

  if (!position || seasons.length === 0) {
    return null;
  }

  return {
    position,
    seasons,
  };
}

function mapDriverSeasonHistory(value: unknown): DriverSeasonHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seasons = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const season = toStringValue(item.season);
      if (!season) {
        return null;
      }

      return {
        season,
        position: toStringValue(item.position, '-'),
        points: toNumberValue(item.points),
        wins: toNumberValue(item.wins),
        constructorName: toStringValue(item.constructorName),
        constructorId: toStringValue(item.constructorId),
      };
    })
    .filter((item): item is DriverSeasonHistoryItem => item !== null);

  return sortSeasonsDescending(seasons);
}

function mapConstructorSeasonHistory(value: unknown): ConstructorSeasonHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seasons = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const season = toStringValue(item.season);
      if (!season) {
        return null;
      }

      return {
        season,
        position: toStringValue(item.position, '-'),
        points: toNumberValue(item.points),
        wins: toNumberValue(item.wins),
      };
    })
    .filter((item): item is ConstructorSeasonHistoryItem => item !== null);

  return sortSeasonsDescending(seasons);
}

export function mapDriverHistorySummary(
  record: DriverHistorySummaryRecord | null | undefined,
): DriverHistoryProfile | null {
  if (!record?.driver_id || !record.given_name || !record.family_name) {
    return null;
  }

  const careerSummary = mapCareerSummary(record.career_summary);
  const seasons = mapDriverSeasonHistory(record.seasons);
  if (!hasUsableCareerHistory(careerSummary, seasons)) {
    return null;
  }

  return {
    driverId: record.driver_id,
    permanentNumber: record.permanent_number || '',
    code: record.code || '',
    url: record.url || '#',
    givenName: record.given_name,
    familyName: record.family_name,
    dateOfBirth: record.date_of_birth || '',
    nationality: record.nationality || '',
    recentConstructorName: record.recent_constructor_name || '',
    recentConstructorId: record.recent_constructor_id || '',
    careerSummary,
    bestRaceFinish: mapBestFinishSummary(record.best_race_finish),
    seasons,
  };
}

export function mapConstructorHistorySummary(
  record: ConstructorHistorySummaryRecord | null | undefined,
): ConstructorHistoryProfile | null {
  if (!record?.constructor_id || !record.name) {
    return null;
  }

  const careerSummary = mapCareerSummary(record.career_summary);
  const seasons = mapConstructorSeasonHistory(record.seasons);
  if (!hasUsableCareerHistory(careerSummary, seasons)) {
    return null;
  }

  return {
    constructorId: record.constructor_id,
    url: record.url || '#',
    name: record.name,
    nationality: record.nationality || '',
    careerSummary,
    bestRaceFinish: mapBestFinishSummary(record.best_race_finish),
    seasons,
  };
}
