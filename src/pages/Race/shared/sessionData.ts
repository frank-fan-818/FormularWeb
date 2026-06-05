import type {
  Constructor,
  Driver,
  FastF1DriverLapSeries,
  FastF1RaceAnalytics,
  FastF1SessionResult,
  QualifyingResult,
  Result,
} from '@/types';
import { normalizeConstructorId } from '@/utils/teamColors';
import { getDriverColor, formatSessionSeconds } from './charts/helpers';

export interface FastF1SprintLapSummary {
  driver: string;
  position: number | null;
  lapCount: number;
  lapNumber: number | null;
  lapTimeSeconds: number | null;
}

export interface PracticeRankingItem {
  driver: string;
  team: string;
  constructorId: string;
  bestTimeSeconds: number;
  bestTime: string;
  gap: string;
  gapSeconds: number | null;
  sector1: string;
  sector2: string;
  sector3: string;
  compound: string;
  laps: number;
  lapNumber: number | null;
}

type ParticipantRecord = Result | QualifyingResult;

export function buildFastF1Summary(analytics: FastF1RaceAnalytics | null) {
  if (!analytics) {
    return null;
  }

  const lapNumbers = analytics.lapTimeSeries.flatMap((series) =>
    series.laps.map((lap) => lap.lapNumber),
  );
  const maxLap = analytics.totalLaps || Math.max(0, ...lapNumbers);
  const stints = analytics.tyreStrategies.reduce((total, strategy) =>
    total + strategy.stints.length, 0);
  const compounds = [...new Set(
    analytics.tyreStrategies.flatMap((strategy) =>
      strategy.stints.map((stint) => stint.compound || 'UNKNOWN'),
    ),
  )];
  const statusCount = analytics.trackStatusPeriods?.length || 0;

  return {
    driverCount: analytics.lapTimeSeries.length,
    maxLap,
    stints,
    compounds,
    statusCount,
    weatherSummary: analytics.weather?.summary || null,
  };
}

export function getDriverLegendItems(series: FastF1DriverLapSeries[]) {
  return series.map((item, index) => ({
    driver: item.driver,
    color: getDriverColor(index),
  }));
}

export function getBestLapByDriver(analytics: FastF1RaceAnalytics | null) {
  return new Map(
    analytics?.qualifyingAnalysis?.bestLaps.map((lap) => [lap.driver, lap]) || [],
  );
}

export function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function buildDriverLookup(records: ParticipantRecord[]) {
  const drivers = new Map<string, Driver>();

  records.forEach((record) => {
    const code = record.Driver.code;
    if (code && !drivers.has(code)) {
      drivers.set(code, record.Driver);
    }
  });

  return drivers;
}

export function buildConstructorLookup(records: ParticipantRecord[]) {
  const constructors = new Map<string, Constructor>();

  records.forEach((record) => {
    const name = record.Constructor.name;
    if (name) {
      constructors.set(normalizeLookupKey(name), record.Constructor);
    }
  });

  return constructors;
}

export function getFastF1SprintLapByDriver(analytics: FastF1RaceAnalytics | null) {
  const summaries = (analytics?.lapTimeSeries || []).map((series) => {
    const fastestLap = series.laps
      .filter((lap) => Number.isFinite(lap.lapTimeSeconds))
      .sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds)[0];

    return {
      driver: series.driver,
      position: series.racePosition ?? null,
      lapCount: series.laps.length,
      lapNumber: fastestLap?.lapNumber ?? null,
      lapTimeSeconds: fastestLap?.lapTimeSeconds ?? null,
    };
  });

  return new Map(summaries.map((summary) => [summary.driver, summary]));
}

export function buildPracticeRanking(analytics: FastF1RaceAnalytics | null): PracticeRankingItem[] {
  if (!analytics?.lapTimeSeries?.length) {
    return [];
  }

  const teamsByDriver = new Map<string, string>(
    (analytics.sessionResults || []).map((r) => [r.driver, r.team || '']),
  );

  const items = analytics.lapTimeSeries
    .map((series) => {
      const fastest = series.laps
        .filter((lap) => Number.isFinite(lap.lapTimeSeconds))
        .sort((a, b) => (a.lapTimeSeconds ?? Infinity) - (b.lapTimeSeconds ?? Infinity))[0];

      const lapCount = series.laps.filter((lap) => Number.isFinite(lap.lapTimeSeconds)).length;

      if (!fastest) {
        return null;
      }

      return {
        driver: series.driver,
        team: teamsByDriver.get(series.driver) || '',
        constructorId: normalizeConstructorId(teamsByDriver.get(series.driver) || ''),
        bestTimeSeconds: fastest.lapTimeSeconds!,
        bestTime: formatSessionSeconds(fastest.lapTimeSeconds),
        gap: '',
        gapSeconds: null as number | null,
        sector1: formatSessionSeconds(fastest.sector1TimeSeconds),
        sector2: formatSessionSeconds(fastest.sector2TimeSeconds),
        sector3: formatSessionSeconds(fastest.sector3TimeSeconds),
        compound: fastest.compound || '',
        laps: lapCount,
        lapNumber: fastest.lapNumber ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds);

  if (!items.length) {
    return [];
  }

  const bestTime = items[0].bestTimeSeconds;
  items.forEach((item, index) => {
    item.gapSeconds = index === 0 ? null : item.bestTimeSeconds - bestTime;
    item.gap = index === 0 ? '-' : `+${formatSessionSeconds(item.gapSeconds)}`;
  });

  return items;
}

export function buildFallbackDriver(
  code: string,
  driverByCode: Map<string, Driver> = new Map(),
  result?: FastF1SessionResult,
): Driver {
  const [firstName = code, ...lastNameParts] = (result?.fullName || '').split(' ').filter(Boolean);

  return driverByCode.get(code) || {
    driverId: result?.driverId || code.toLowerCase(),
    permanentNumber: result?.driverNumber || '',
    code,
    url: '',
    givenName: result?.firstName || firstName || code,
    familyName: result?.lastName || lastNameParts.join(' '),
    dateOfBirth: '',
    nationality: '',
  };
}

export function buildFallbackConstructor(
  name: string,
  constructorByName: Map<string, Constructor> = new Map(),
): Constructor {
  return constructorByName.get(normalizeLookupKey(name)) || {
    constructorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown',
    url: '',
    name: name || '-',
    nationality: '',
  };
}

export function buildSessionResultByDriver(analytics: FastF1RaceAnalytics | null) {
  return new Map(
    (analytics?.sessionResults || []).map((result) => [result.driver, result]),
  );
}

export function buildFastF1QualifyingRows(
  analytics: FastF1RaceAnalytics | null,
  driverByCode: Map<string, Driver>,
  constructorByName: Map<string, Constructor>,
): QualifyingResult[] {
  const phaseResults = analytics?.qualifyingAnalysis?.phaseResults || [];
  const bestLaps = analytics?.qualifyingAnalysis?.bestLaps || [];

  if (!phaseResults.length && !bestLaps.length) {
    return [];
  }

  const phaseByDriver = new Map(phaseResults.map((result) => [result.driver, result]));
  const sessionResultByDriver = buildSessionResultByDriver(analytics);
  const rows = (phaseResults.length ? phaseResults : bestLaps)
    .map((item) => {
      const phaseResult = phaseByDriver.get(item.driver);
      const sessionResult = sessionResultByDriver.get(item.driver);
      return {
        number: '',
        position: String(item.position || sessionResult?.position || ''),
        Driver: buildFallbackDriver(item.driver, driverByCode, sessionResult),
        Constructor: buildFallbackConstructor(item.team, constructorByName),
        Q1: phaseResult?.phases.q1?.time || undefined,
        Q2: phaseResult?.phases.q2?.time || undefined,
        Q3: phaseResult?.phases.q3?.time || undefined,
      };
    });

  return rows.sort((a, b) => Number(a.position) - Number(b.position));
}

export function buildFastF1SprintRows(
  analytics: FastF1RaceAnalytics | null,
  driverByCode: Map<string, Driver>,
  constructorByName: Map<string, Constructor>,
): Result[] {
  const sessionResults = analytics?.sessionResults || [];
  const lapSeries = analytics?.lapTimeSeries || [];
  const lapSummaryByDriver = getFastF1SprintLapByDriver(analytics);

  if (sessionResults.length) {
    return sessionResults
      .map((result, index) => {
        const lapSummary = lapSummaryByDriver.get(result.driver);

        return {
          number: result.driverNumber,
          position: String(result.position ?? index + 1),
          positionText: String(result.classifiedPosition || result.position || index + 1),
          points: result.points === null || result.points === undefined ? '0' : String(result.points),
          Driver: buildFallbackDriver(result.driver, driverByCode, result),
          Constructor: buildFallbackConstructor(result.team, constructorByName),
          grid: result.gridPosition === null || result.gridPosition === undefined ? '-' : String(result.gridPosition),
          laps: result.laps === null || result.laps === undefined ? String(lapSummary?.lapCount || '') : String(result.laps),
          status: result.time || result.status || 'Finished',
          FastestLap: lapSummary?.lapTimeSeconds ? {
            rank: '',
            lap: lapSummary.lapNumber === null ? '' : String(lapSummary.lapNumber),
            Time: {
              time: formatSessionSeconds(lapSummary.lapTimeSeconds),
            },
            AverageSpeed: {
              units: 'kph',
              speed: '',
            },
          } : undefined,
        };
      })
      .sort((a, b) => Number(a.position) - Number(b.position));
  }

  return lapSeries
    .map((series, index) => ({
      number: '',
      position: String(series.racePosition ?? index + 1),
      positionText: String(series.racePosition ?? index + 1),
      points: '0',
      Driver: buildFallbackDriver(series.driver, driverByCode),
      Constructor: buildFallbackConstructor(series.team, constructorByName),
      grid: '-',
      laps: String(series.laps.length),
      status: '',
    }))
    .sort((a, b) => Number(a.position) - Number(b.position));
}
