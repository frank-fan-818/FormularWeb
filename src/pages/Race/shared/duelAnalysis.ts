import type { FastF1RaceAnalytics } from '@/types';
import { getStintPaceMetrics } from './charts/tyreStrategy';
import type { StintPaceMetric } from './charts/tyreStrategy';
import { getDriverColor } from './charts/helpers';
import { TEXT } from './constants';

export function getDuelDriverItems(analytics: FastF1RaceAnalytics | null) {
  return (analytics?.lapTimeSeries || []).map((series, index) => ({
    driver: series.driver,
    team: series.team,
    color: getDriverColor(index),
  }));
}

export function getSelectedDuelDrivers(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics || selectedDrivers.length !== 2) {
    return [];
  }

  const selectedSet = new Set(selectedDrivers);
  return analytics.lapTimeSeries.filter((series) => selectedSet.has(series.driver));
}

export function getDuelTyreSummaryItems(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics || selectedDrivers.length !== 2) {
    return [];
  }

  return selectedDrivers
    .map((driver) => {
      const strategy = analytics.tyreStrategies.find((item) => item.driver === driver);

      if (!strategy) {
        return null;
      }

      return {
        driver,
        stints: getStintPaceMetrics(analytics, driver, strategy.stints),
      };
    })
    .filter((item): item is { driver: string; stints: StintPaceMetric[] } => item !== null);
}

export function getDuelSectorRows(
  qualifyingAnalytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (selectedDrivers.length !== 2) {
    return [];
  }

  const selectedSet = new Set(selectedDrivers);
  return (qualifyingAnalytics?.qualifyingAnalysis?.bestLaps || [])
    .filter((lap) => selectedSet.has(lap.driver))
    .sort((a, b) => selectedDrivers.indexOf(a.driver) - selectedDrivers.indexOf(b.driver))
    .map((lap) => ({
      key: lap.driver,
      driver: lap.driver,
      fastestLap: lap.lapTimeSeconds,
      s1: lap.sector1Seconds,
      s2: lap.sector2Seconds,
      s3: lap.sector3Seconds,
    }));
}

export function getDuelSectorGapItems(
  qualifyingAnalytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  const rows = getDuelSectorRows(qualifyingAnalytics, selectedDrivers);

  if (rows.length !== 2) {
    return [];
  }

  const [first, second] = rows;
  const delta = (firstValue: number | null | undefined, secondValue: number | null | undefined) => (
    firstValue !== null
    && firstValue !== undefined
    && secondValue !== null
    && secondValue !== undefined
    && Number.isFinite(firstValue)
    && Number.isFinite(secondValue)
      ? Number((firstValue - secondValue).toFixed(3))
      : null
  );

  return [
    {
      key: 'total',
      label: TEXT.fastestLap,
      value: delta(first.fastestLap, second.fastestLap),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's1',
      label: TEXT.sector1,
      value: delta(first.s1, second.s1),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's2',
      label: TEXT.sector2,
      value: delta(first.s2, second.s2),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
    {
      key: 's3',
      label: TEXT.sector3,
      value: delta(first.s3, second.s3),
      firstDriver: first.driver,
      secondDriver: second.driver,
    },
  ];
}

export function getDuelCornerRows(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  if (!analytics?.telemetry || selectedDrivers.length !== 2) {
    return [];
  }

  const [driverA, driverB] = selectedDrivers;
  return analytics.telemetry.cornerAnalysis.map((corner) => {
    const first = corner.drivers.find((driver) => driver.driver === driverA);
    const second = corner.drivers.find((driver) => driver.driver === driverB);
    const delta = first?.minSpeedKph !== null
      && first?.minSpeedKph !== undefined
      && second?.minSpeedKph !== null
      && second?.minSpeedKph !== undefined
      ? Number((first.minSpeedKph - second.minSpeedKph).toFixed(1))
      : null;

    return {
      key: `${corner.corner}-${corner.distanceM}`,
      corner: corner.corner,
      distanceM: corner.distanceM,
      driverA,
      driverB,
      firstMinSpeed: first?.minSpeedKph ?? null,
      secondMinSpeed: second?.minSpeedKph ?? null,
      delta,
    };
  });
}

export function getActiveTelemetryDrivers(
  analytics: FastF1RaceAnalytics | null,
  selectedDrivers: string[],
) {
  const drivers = analytics?.telemetry?.drivers || [];
  const selectedSet = new Set(selectedDrivers);

  return drivers.filter((driver) => selectedSet.has(driver.driver));
}
