import type {
  ConstructorHistorySummaryRecord,
  DriverHistorySummaryRecord,
} from '../types/index.ts';

export interface SummaryDriverRow {
  driver_id: string;
  first_name: string | null;
  last_name: string | null;
  code: string | null;
  permanent_number: string | number | null;
  date_of_birth: string | null;
  nationality: string | null;
}

export interface SummaryConstructorRow {
  constructor_id: string;
  name: string | null;
  nationality: string | null;
}

export interface SummaryRaceRow {
  id: number;
  season: string | number;
  round: string | number | null;
  date: string | null;
  time: string | null;
}

export interface SummaryRaceResultRow {
  race_id: number;
  driver_id: string | null;
  constructor_id: string | null;
  position: string | number | null;
  points: string | number | null;
  status?: string | null;
}

export interface SummaryQualifyingResultRow {
  race_id: number;
  driver_id: string | null;
  constructor_id: string | null;
  position: string | number | null;
}

export interface SummaryOfficialDriverStandingRow {
  season: string | number;
  driver_id: string;
  position: string | number;
  points: string | number;
}

export interface SummaryOfficialConstructorStandingRow {
  season: string | number;
  constructor_id: string;
  position: string | number;
  points: string | number;
}

export interface HistorySummarySourceData {
  drivers: SummaryDriverRow[];
  constructors: SummaryConstructorRow[];
  races: SummaryRaceRow[];
  raceResults: SummaryRaceResultRow[];
  qualifyingResults: SummaryQualifyingResultRow[];
  officialDriverStandings?: SummaryOfficialDriverStandingRow[];
  officialConstructorStandings?: SummaryOfficialConstructorStandingRow[];
}

export interface HistorySummaryPayloads {
  driverSummaries: DriverHistorySummaryRecord[];
  constructorSummaries: ConstructorHistorySummaryRecord[];
}

interface DriverSeasonSummaryItem {
  season: string;
  position: string;
  points: number;
  wins: number;
  constructorName: string;
  constructorId: string;
}

interface ConstructorSeasonSummaryItem {
  season: string;
  position: string;
  points: number;
  wins: number;
}

interface JoinedRaceResult extends SummaryRaceResultRow {
  season: string;
  round: number;
  dateSortKey: string;
}

interface DriverSeasonAggregate {
  season: string;
  driverId: string;
  points: number;
  wins: number;
  latestRound: number;
  latestDateSortKey: string;
  latestConstructorId: string;
}

interface ConstructorSeasonAggregate {
  season: string;
  constructorId: string;
  points: number;
  wins: number;
}

interface BestFinishSummary {
  position: string;
  seasons: string[];
}

function toSeasonString(value: string | number): string {
  return String(value);
}

function toFiniteNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toPositionNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function toNullableString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text ? text : null;
}

function sortSeasonsDescending<T extends { season: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => Number.parseInt(right.season, 10) - Number.parseInt(left.season, 10));
}

function getDateSortKey(race: SummaryRaceRow): string {
  return `${race.date || ''}T${race.time || ''}`;
}

function getRaceStartTimestamp(race: SummaryRaceRow): number | null {
  if (!race.date) {
    return null;
  }

  const time = race.time && race.time.trim() ? race.time.trim() : '23:59:59Z';
  const normalizedTime = time.endsWith('Z') ? time : `${time}Z`;
  const timestamp = Date.parse(`${race.date}T${normalizedTime}`);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildCompletedSeasonSet(races: SummaryRaceRow[], now: number): Set<string> {
  const racesBySeason = new Map<string, SummaryRaceRow[]>();

  races.forEach((race) => {
    const season = toSeasonString(race.season);
    const seasonRaces = racesBySeason.get(season) || [];
    seasonRaces.push(race);
    racesBySeason.set(season, seasonRaces);
  });

  const completedSeasons = new Set<string>();
  racesBySeason.forEach((seasonRaces, season) => {
    const isComplete = seasonRaces.length > 0 && seasonRaces.every((race) => {
      const timestamp = getRaceStartTimestamp(race);
      return timestamp !== null && timestamp <= now;
    });

    if (isComplete) {
      completedSeasons.add(season);
    }
  });

  return completedSeasons;
}

function isLaterRace(
  candidateRound: number,
  candidateDateSortKey: string,
  currentRound: number,
  currentDateSortKey: string,
): boolean {
  if (candidateRound !== currentRound) {
    return candidateRound > currentRound;
  }

  return candidateDateSortKey > currentDateSortKey;
}

function buildJoinedRaceResults(
  races: SummaryRaceRow[],
  raceResults: SummaryRaceResultRow[],
): JoinedRaceResult[] {
  const raceById = new Map<number, SummaryRaceRow>();
  races.forEach((race) => {
    raceById.set(race.id, race);
  });

  return raceResults.flatMap((result) => {
    const race = raceById.get(result.race_id);
    if (!race) {
      return [];
    }

    return [{
      ...result,
      season: toSeasonString(race.season),
      round: toFiniteNumber(race.round),
      dateSortKey: getDateSortKey(race),
    }];
  });
}

function buildDriverSeasonItems(
  joinedRaceResults: JoinedRaceResult[],
  constructorNameById: Map<string, string>,
  officialStandings: SummaryOfficialDriverStandingRow[] = [],
): Map<string, DriverSeasonSummaryItem[]> {
  const driverSeasonMap = new Map<string, DriverSeasonAggregate>();

  joinedRaceResults.forEach((result) => {
    if (!result.driver_id) {
      return;
    }

    const key = `${result.season}::${result.driver_id}`;
    const existing = driverSeasonMap.get(key) || {
      season: result.season,
      driverId: result.driver_id,
      points: 0,
      wins: 0,
      latestRound: -1,
      latestDateSortKey: '',
      latestConstructorId: '',
    };

    existing.points += toFiniteNumber(result.points);

    if (toPositionNumber(result.position) === 1) {
      existing.wins += 1;
    }

    if (
      result.constructor_id
      && isLaterRace(result.round, result.dateSortKey, existing.latestRound, existing.latestDateSortKey)
    ) {
      existing.latestRound = result.round;
      existing.latestDateSortKey = result.dateSortKey;
      existing.latestConstructorId = result.constructor_id;
    }

    driverSeasonMap.set(key, existing);
  });

  const bySeason = new Map<string, DriverSeasonAggregate[]>();
  driverSeasonMap.forEach((aggregate) => {
    const seasonItems = bySeason.get(aggregate.season) || [];
    seasonItems.push(aggregate);
    bySeason.set(aggregate.season, seasonItems);
  });

  const byDriverId = new Map<string, DriverSeasonSummaryItem[]>();
  const officialBySeason = new Map<string, SummaryOfficialDriverStandingRow[]>();
  const officialKeySet = new Set<string>();

  officialStandings.forEach((standing) => {
    const season = toSeasonString(standing.season);
    const seasonItems = officialBySeason.get(season) || [];
    seasonItems.push(standing);
    officialBySeason.set(season, seasonItems);
    officialKeySet.add(`${season}::${standing.driver_id}`);
  });

  bySeason.forEach((seasonItems) => {
    const officialSeasonItems = officialBySeason.get(seasonItems[0]?.season || '') || [];

    const ranked = [...seasonItems].filter((item) => !officialKeySet.has(`${item.season}::${item.driverId}`)).sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return left.driverId.localeCompare(right.driverId);
    });

    const season = seasonItems[0]?.season || '';
    const orderedOfficialSeasonItems = [...officialSeasonItems].sort((left, right) => {
      const leftPosition = toPositionNumber(left.position) ?? Number.POSITIVE_INFINITY;
      const rightPosition = toPositionNumber(right.position) ?? Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      return left.driver_id.localeCompare(right.driver_id);
    });

    orderedOfficialSeasonItems.forEach((standing) => {
      const item = driverSeasonMap.get(`${season}::${standing.driver_id}`);
      const driverItems = byDriverId.get(standing.driver_id) || [];
      driverItems.push({
        season,
        position: String(standing.position),
        points: toFiniteNumber(standing.points),
        wins: item?.wins || 0,
        constructorName: constructorNameById.get(item?.latestConstructorId || '') || item?.latestConstructorId || '',
        constructorId: item?.latestConstructorId || '',
      });
      byDriverId.set(standing.driver_id, driverItems);
    });

    ranked.forEach((item, index) => {
      const driverItems = byDriverId.get(item.driverId) || [];
      driverItems.push({
        season: item.season,
        position: String(orderedOfficialSeasonItems.length + index + 1),
        points: item.points,
        wins: item.wins,
        constructorName: constructorNameById.get(item.latestConstructorId) || item.latestConstructorId,
        constructorId: item.latestConstructorId,
      });
      byDriverId.set(item.driverId, driverItems);
    });
  });

  const result = new Map<string, DriverSeasonSummaryItem[]>();
  byDriverId.forEach((items, driverId) => {
    result.set(driverId, sortSeasonsDescending(items));
  });

  return result;
}

function buildConstructorSeasonItems(
  joinedRaceResults: JoinedRaceResult[],
  officialStandings: SummaryOfficialConstructorStandingRow[] = [],
): Map<string, ConstructorSeasonSummaryItem[]> {
  const constructorSeasonMap = new Map<string, ConstructorSeasonAggregate>();

  joinedRaceResults.forEach((result) => {
    if (!result.constructor_id) {
      return;
    }

    const key = `${result.season}::${result.constructor_id}`;
    const existing = constructorSeasonMap.get(key) || {
      season: result.season,
      constructorId: result.constructor_id,
      points: 0,
      wins: 0,
    };

    existing.points += toFiniteNumber(result.points);

    if (toPositionNumber(result.position) === 1) {
      existing.wins += 1;
    }

    constructorSeasonMap.set(key, existing);
  });

  const bySeason = new Map<string, ConstructorSeasonAggregate[]>();
  constructorSeasonMap.forEach((aggregate) => {
    const seasonItems = bySeason.get(aggregate.season) || [];
    seasonItems.push(aggregate);
    bySeason.set(aggregate.season, seasonItems);
  });

  const byConstructorId = new Map<string, ConstructorSeasonSummaryItem[]>();
  const officialBySeason = new Map<string, SummaryOfficialConstructorStandingRow[]>();
  const officialKeySet = new Set<string>();

  officialStandings.forEach((standing) => {
    const season = toSeasonString(standing.season);
    const seasonItems = officialBySeason.get(season) || [];
    seasonItems.push(standing);
    officialBySeason.set(season, seasonItems);
    officialKeySet.add(`${season}::${standing.constructor_id}`);
  });

  bySeason.forEach((seasonItems) => {
    const officialSeasonItems = officialBySeason.get(seasonItems[0]?.season || '') || [];

    const ranked = [...seasonItems].filter((item) => !officialKeySet.has(`${item.season}::${item.constructorId}`)).sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }

      if (right.wins !== left.wins) {
        return right.wins - left.wins;
      }

      return left.constructorId.localeCompare(right.constructorId);
    });

    const season = seasonItems[0]?.season || '';
    const orderedOfficialSeasonItems = [...officialSeasonItems].sort((left, right) => {
      const leftPosition = toPositionNumber(left.position) ?? Number.POSITIVE_INFINITY;
      const rightPosition = toPositionNumber(right.position) ?? Number.POSITIVE_INFINITY;
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }

      return left.constructor_id.localeCompare(right.constructor_id);
    });

    orderedOfficialSeasonItems.forEach((standing) => {
      const item = constructorSeasonMap.get(`${season}::${standing.constructor_id}`);
      const constructorItems = byConstructorId.get(standing.constructor_id) || [];
      constructorItems.push({
        season,
        position: String(standing.position),
        points: toFiniteNumber(standing.points),
        wins: item?.wins || 0,
      });
      byConstructorId.set(standing.constructor_id, constructorItems);
    });

    ranked.forEach((item, index) => {
      const constructorItems = byConstructorId.get(item.constructorId) || [];
      constructorItems.push({
        season: item.season,
        position: String(orderedOfficialSeasonItems.length + index + 1),
        points: item.points,
        wins: item.wins,
      });
      byConstructorId.set(item.constructorId, constructorItems);
    });
  });

  const result = new Map<string, ConstructorSeasonSummaryItem[]>();
  byConstructorId.forEach((items, constructorId) => {
    result.set(constructorId, sortSeasonsDescending(items));
  });

  return result;
}

function buildBestFinishByEntity(
  joinedRaceResults: JoinedRaceResult[],
  entitySelector: (result: JoinedRaceResult) => string | null,
): Map<string, BestFinishSummary> {
  const tracker = new Map<string, { bestPosition: number; seasons: Set<string> }>();

  joinedRaceResults.forEach((result) => {
    const entityId = entitySelector(result);
    const position = toPositionNumber(result.position);

    if (!entityId || position === null) {
      return;
    }

    const existing = tracker.get(entityId);

    if (!existing || position < existing.bestPosition) {
      tracker.set(entityId, {
        bestPosition: position,
        seasons: new Set([result.season]),
      });
      return;
    }

    if (position === existing.bestPosition) {
      existing.seasons.add(result.season);
    }
  });

  const bestFinishByEntity = new Map<string, BestFinishSummary>();
  tracker.forEach((value, entityId) => {
    bestFinishByEntity.set(entityId, {
      position: String(value.bestPosition),
      seasons: [...value.seasons].sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10)),
    });
  });

  return bestFinishByEntity;
}

function countPolePositions(
  qualifyingResults: SummaryQualifyingResultRow[],
  entitySelector: (result: SummaryQualifyingResultRow) => string | null,
): Map<string, number> {
  const poleCounts = new Map<string, number>();

  qualifyingResults.forEach((result) => {
    const entityId = entitySelector(result);
    if (!entityId || toPositionNumber(result.position) !== 1) {
      return;
    }

    poleCounts.set(entityId, (poleCounts.get(entityId) || 0) + 1);
  });

  return poleCounts;
}

function countDistinctRaceEntries(
  joinedRaceResults: JoinedRaceResult[],
  entitySelector: (result: JoinedRaceResult) => string | null,
): Map<string, number> {
  const raceIdsByEntity = new Map<string, Set<number>>();

  joinedRaceResults.forEach((result) => {
    const entityId = entitySelector(result);
    if (!entityId) {
      return;
    }

    const raceIds = raceIdsByEntity.get(entityId) || new Set<number>();
    raceIds.add(result.race_id);
    raceIdsByEntity.set(entityId, raceIds);
  });

  const counts = new Map<string, number>();
  raceIdsByEntity.forEach((raceIds, entityId) => {
    counts.set(entityId, raceIds.size);
  });

  return counts;
}

function countResultPositions(
  joinedRaceResults: JoinedRaceResult[],
  entitySelector: (result: JoinedRaceResult) => string | null,
  predicate: (position: number) => boolean,
): Map<string, number> {
  const counts = new Map<string, number>();

  joinedRaceResults.forEach((result) => {
    const entityId = entitySelector(result);
    const position = toPositionNumber(result.position);

    if (!entityId || position === null || !predicate(position)) {
      return;
    }

    counts.set(entityId, (counts.get(entityId) || 0) + 1);
  });

  return counts;
}

export function buildHistorySummaryPayloads(
  source: HistorySummarySourceData,
  updatedAt = new Date().toISOString(),
): HistorySummaryPayloads {
  const constructorNameById = new Map<string, string>();
  source.constructors.forEach((constructor) => {
    constructorNameById.set(constructor.constructor_id, constructor.name || constructor.constructor_id);
  });

  const joinedRaceResults = buildJoinedRaceResults(source.races, source.raceResults);
  const driverSeasonItems = buildDriverSeasonItems(joinedRaceResults, constructorNameById, source.officialDriverStandings);
  const constructorSeasonItems = buildConstructorSeasonItems(joinedRaceResults, source.officialConstructorStandings);
  const updatedAtTime = Date.parse(updatedAt);
  const completedSeasonSet = buildCompletedSeasonSet(source.races, Number.isNaN(updatedAtTime) ? Date.now() : updatedAtTime);
  const driverBestFinishById = buildBestFinishByEntity(joinedRaceResults, (result) => result.driver_id);
  const constructorBestFinishById = buildBestFinishByEntity(joinedRaceResults, (result) => result.constructor_id);
  const driverPoleCountById = countPolePositions(source.qualifyingResults, (result) => result.driver_id);
  const constructorPoleCountById = countPolePositions(source.qualifyingResults, (result) => result.constructor_id);
  const driverRaceCountById = countDistinctRaceEntries(joinedRaceResults, (result) => result.driver_id);
  const constructorRaceCountById = countDistinctRaceEntries(joinedRaceResults, (result) => result.constructor_id);
  const driverWinCountById = countResultPositions(joinedRaceResults, (result) => result.driver_id, (position) => position === 1);
  const constructorWinCountById = countResultPositions(joinedRaceResults, (result) => result.constructor_id, (position) => position === 1);
  const driverPodiumCountById = countResultPositions(joinedRaceResults, (result) => result.driver_id, (position) => position <= 3);
  const constructorPodiumCountById = countResultPositions(joinedRaceResults, (result) => result.constructor_id, (position) => position <= 3);

  const driverSummaries = source.drivers.map<DriverHistorySummaryRecord>((driver) => {
    const seasons = driverSeasonItems.get(driver.driver_id) || [];
    const recentSeason = seasons[0];
    const championshipCount = seasons.filter((season) => season.position === '1' && completedSeasonSet.has(season.season)).length;
    const totalPoints = seasons.reduce((sum, season) => sum + season.points, 0);

    return {
      driver_id: driver.driver_id,
      permanent_number: toNullableString(driver.permanent_number),
      code: toNullableString(driver.code),
      url: '#',
      given_name: toNullableString(driver.first_name),
      family_name: toNullableString(driver.last_name),
      date_of_birth: toNullableString(driver.date_of_birth),
      nationality: toNullableString(driver.nationality),
      recent_constructor_name: recentSeason?.constructorName || null,
      recent_constructor_id: recentSeason?.constructorId || null,
      career_summary: {
        raceCount: driverRaceCountById.get(driver.driver_id) || 0,
        poleCount: driverPoleCountById.get(driver.driver_id) || 0,
        winCount: driverWinCountById.get(driver.driver_id) || 0,
        podiumCount: driverPodiumCountById.get(driver.driver_id) || 0,
        championshipCount,
        totalPoints,
      },
      best_race_finish: driverBestFinishById.get(driver.driver_id) || null,
      seasons,
      updated_at: updatedAt,
    };
  });

  const constructorSummaries = source.constructors.map<ConstructorHistorySummaryRecord>((constructor) => {
    const seasons = constructorSeasonItems.get(constructor.constructor_id) || [];
    const championshipCount = seasons.filter((season) => season.position === '1' && completedSeasonSet.has(season.season)).length;
    const totalPoints = seasons.reduce((sum, season) => sum + season.points, 0);

    return {
      constructor_id: constructor.constructor_id,
      url: '#',
      name: toNullableString(constructor.name) || constructor.constructor_id,
      nationality: toNullableString(constructor.nationality),
      career_summary: {
        raceCount: constructorRaceCountById.get(constructor.constructor_id) || 0,
        poleCount: constructorPoleCountById.get(constructor.constructor_id) || 0,
        winCount: constructorWinCountById.get(constructor.constructor_id) || 0,
        podiumCount: constructorPodiumCountById.get(constructor.constructor_id) || 0,
        championshipCount,
        totalPoints,
      },
      best_race_finish: constructorBestFinishById.get(constructor.constructor_id) || null,
      seasons,
      updated_at: updatedAt,
    };
  });

  return {
    driverSummaries,
    constructorSummaries,
  };
}
