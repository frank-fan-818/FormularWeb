import type {
  FastF1CornerAnalysis,
  FastF1CornerDriverSpeed,
  FastF1TelemetryDriver,
  FastF1WeatherLapRange,
} from '@/types';
import { formatNumber } from '@/utils/raceDetailFormatters';

export interface CornerSpeedRow {
  key: string;
  corner: string;
  distanceM: number;
  drivers: FastF1CornerDriverSpeed[];
  minSpeedDelta: number | null;
}

export function formatAnalysisStatRange(summary?: { min: number | null; max: number | null }) {
  if (!summary || summary.min === null || summary.max === null) {
    return '-';
  }
  return `${formatNumber(summary.min, 1)}-${formatNumber(summary.max, 1)} C`;
}

function formatAnalysisLapRange(range: FastF1WeatherLapRange) {
  return range.startLap === range.endLap
    ? `L${range.startLap}`
    : `L${range.startLap}-L${range.endLap}`;
}

export function formatAnalysisLapRanges(ranges: FastF1WeatherLapRange[] = []) {
  if (!ranges.length) {
    return '-';
  }
  return ranges.map(formatAnalysisLapRange).join(', ');
}

export function getCornerSpeedRows(
  cornerAnalysis: FastF1CornerAnalysis[],
  activeDrivers: FastF1TelemetryDriver[],
): CornerSpeedRow[] {
  if (!activeDrivers.length) {
    return [];
  }
  const activeDriverSet = new Set(activeDrivers.map((driver) => driver.driver));
  return cornerAnalysis.map((corner) => {
    const driverSpeeds = corner.drivers.filter((driver) => activeDriverSet.has(driver.driver));
    const minSpeedDelta = driverSpeeds.length === 2
      && driverSpeeds[0].minSpeedKph !== null
      && driverSpeeds[1].minSpeedKph !== null
      ? Number((driverSpeeds[0].minSpeedKph - driverSpeeds[1].minSpeedKph).toFixed(1))
      : null;
    return {
      key: `${corner.corner}-${corner.distanceM}`,
      corner: corner.corner,
      distanceM: corner.distanceM,
      drivers: driverSpeeds,
      minSpeedDelta,
    };
  });
}

export function formatCornerSpeedSet(driverSpeed?: FastF1CornerDriverSpeed) {
  if (!driverSpeed) {
    return '-';
  }
  return [
    formatNumber(driverSpeed.entrySpeedKph, 0),
    formatNumber(driverSpeed.minSpeedKph, 0),
    formatNumber(driverSpeed.exitSpeedKph, 0),
  ].join(' / ');
}
