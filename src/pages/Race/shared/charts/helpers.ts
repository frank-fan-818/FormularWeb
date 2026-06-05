import type { FastF1RaceAnalytics, FastF1TelemetryDriver } from '@/types';
import { formatSeconds } from '@/utils/raceDetailFormatters';
import { COMPOUND_COLORS, DRIVER_COLORS } from '../constants';

export type TelemetryMetric = 'throttle' | 'brake' | 'gear' | 'rpm';

export type ChartTooltipParam = {
  seriesName?: string;
  name?: string;
  color?: string;
  value?: number[];
  data?: Record<string, unknown>;
};

export type ChartTooltipInput = ChartTooltipParam | ChartTooltipParam[];

export type ChartTooltipParamWithValue = ChartTooltipParam & { value: number[] };

export function hasNumericTooltipValue(param: ChartTooltipParam): param is ChartTooltipParamWithValue {
  return Number.isFinite(param.value?.[1]);
}

export interface RankingChartRow {
  label: string;
  value: number;
  color?: string;
  displayValue?: string;
}

export function getDriverColor(index: number) {
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

export function getCompoundColor(compound: string) {
  return COMPOUND_COLORS[compound.toUpperCase()] || COMPOUND_COLORS.UNKNOWN;
}

export function getMaxRaceLap(analytics: FastF1RaceAnalytics) {
  if (analytics.totalLaps) {
    return analytics.totalLaps;
  }

  return Math.max(
    0,
    ...analytics.lapTimeSeries.flatMap((series) =>
      series.laps.map((lap) => lap.lapNumber),
    ),
    ...analytics.tyreStrategies.flatMap((strategy) =>
      strategy.stints.map((stint) => stint.endLap),
    ),
  );
}

export function averageLapTimes(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3));
}

export function formatSessionSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return formatSeconds(value);
}

export function getTelemetryMaxDistance(drivers: FastF1TelemetryDriver[]) {
  const distances = drivers.flatMap((driver) =>
    (driver.samples.distanceM || []).filter((distance) => Number.isFinite(distance)),
  );

  if (!distances.length) {
    return undefined;
  }

  return Math.max(...distances);
}

export function getTelemetryChartDrivers(
  analytics: FastF1RaceAnalytics,
  activeDrivers: FastF1TelemetryDriver[],
) {
  return activeDrivers.length ? activeDrivers : analytics.telemetry?.drivers || [];
}

export function getTelemetryDriverColor(driver: string, drivers: FastF1TelemetryDriver[]) {
  const index = Math.max(0, drivers.findIndex((item) => item.driver === driver));
  return getDriverColor(index);
}
