import { describe, expect, it } from 'vitest';
import type { FastF1RaceAnalytics, FastF1TelemetryDriver } from '@/types';
import {
  buildTelemetryControlOption,
  buildTelemetryHeatmapOption,
  buildTelemetrySpeedOption,
} from './telemetry';

function makeDriver(driver: string, speeds: number[]): FastF1TelemetryDriver {
  const distanceM = speeds.map((_, index) => index * 100);
  return {
    driver,
    team: 'Test Team',
    lapNumber: 1,
    lapTimeSeconds: 90,
    compound: 'MEDIUM',
    samples: {
      distanceM,
      timeSeconds: speeds.map(() => null),
      speedKph: speeds,
      rpm: speeds.map(() => null),
      gear: speeds.map(() => null),
      throttlePct: speeds.map(() => null),
      brake: speeds.map(() => false),
      drs: speeds.map(() => null),
    },
    positionSamples: {
      distanceM,
      x: speeds.map((_, index) => index),
      y: speeds.map((_, index) => index * 2),
      z: speeds.map(() => null),
      speedKph: speeds,
    },
  };
}

function makeAnalytics(drivers: FastF1TelemetryDriver[]): FastF1RaceAnalytics {
  return {
    source: 'fastf1',
    generatedAt: '2026-07-07T00:00:00.000Z',
    season: '2026',
    round: '1',
    session: 'R',
    eventName: 'Test Grand Prix',
    sessionName: 'Race',
    lapTimeSeries: [],
    tyreStrategies: [],
    telemetry: {
      drivers,
      corners: [],
      cornerAnalysis: [],
    },
  };
}

describe('telemetry heatmap option', () => {
  it('creates one lines series per driver instead of one series per segment', () => {
    const drivers = [
      makeDriver('AAA', [100, 150, 200, 250]),
      makeDriver('BBB', [110, 160, 210, 260]),
    ];
    const option = buildTelemetryHeatmapOption(makeAnalytics(drivers), drivers);
    const series = option?.series as Array<{
      type: string;
      data: Array<{ lineStyle?: { color?: string } }>;
    }>;

    const heatSeries = series.filter((item) => item.type === 'lines');
    expect(heatSeries).toHaveLength(2);
    expect(heatSeries[0].data).toHaveLength(3);
    expect(heatSeries[1].data).toHaveLength(3);
  });

  it('keeps an individual speed color on every track segment', () => {
    const drivers = [makeDriver('AAA', [100, 150, 200, 250])];
    const option = buildTelemetryHeatmapOption(makeAnalytics(drivers), drivers);
    const series = option?.series as Array<{
      type: string;
      data: Array<{ lineStyle?: { color?: string } }>;
    }>;
    const heatSeries = series.find((item) => item.type === 'lines');
    const colors = heatSeries?.data.map((item) => item.lineStyle?.color);

    expect(colors).toHaveLength(3);
    expect(colors?.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it('supports optimized telemetry assets without duplicated position distance or speed arrays', () => {
    const driver = makeDriver('AAA', [100, 150, 200, 250]);
    driver.positionSamples = {
      x: [0, 1, 2],
      y: [0, 2, 4],
      z: [null, null, null],
    };

    const option = buildTelemetryHeatmapOption(makeAnalytics([driver]), [driver]);
    const series = option?.series as Array<{
      type: string;
      data: Array<{ speedKph?: number; lineStyle?: { color?: string } }>;
    }>;
    const heatSeries = series.find((item) => item.type === 'lines');

    expect(heatSeries?.data).toHaveLength(2);
    expect(heatSeries?.data.map((item) => item.speedKph)).toEqual([100, 175]);
    expect(heatSeries?.data.every((item) => Boolean(item.lineStyle?.color))).toBe(true);
  });

  it('degrades malformed car samples to empty series instead of throwing', () => {
    const driver = makeDriver('AAA', [100, 150, 200]);
    driver.samples = {} as FastF1TelemetryDriver['samples'];
    const analytics = makeAnalytics([driver]);

    expect(() => buildTelemetrySpeedOption(analytics, [driver])).not.toThrow();
    expect(() => buildTelemetryControlOption(
      analytics,
      [driver],
      ['throttle', 'brake', 'gear', 'rpm'],
    )).not.toThrow();
    expect(() => buildTelemetryHeatmapOption(analytics, [driver])).not.toThrow();
  });

  it('omits the track heatmap when FastF1 has no position channel', () => {
    const driver = makeDriver('AAA', [100, 150, 200]);
    driver.positionSamples = { x: [], y: [], z: [] };

    expect(buildTelemetryHeatmapOption(makeAnalytics([driver]), [driver])).toBeNull();
  });

  it.each([2, 20, 1000])('builds all charts from optimized telemetry with %i car samples', (sampleCount) => {
    // Synthetic snapshots keep clean checkouts independent of private race data.
    const drivers = ['AAA', 'BBB'].map((code, driverIndex) => {
      const driver = makeDriver(code, Array.from({ length: sampleCount }, (_, i) => 80 + (i + driverIndex * 20) % 250));
      const positions = Math.max(2, Math.floor(sampleCount / 2));
      driver.positionSamples = {
        x: Array.from({ length: positions }, (_, i) => Math.cos(i / positions * Math.PI * 2) * 1000),
        y: Array.from({ length: positions }, (_, i) => Math.sin(i / positions * Math.PI * 2) * 500),
        z: Array.from({ length: positions }, () => null),
      };
      return driver;
    });
    const analytics = makeAnalytics(drivers);
    drivers.forEach((driver) => {
      expect(() => buildTelemetrySpeedOption(analytics, [driver])).not.toThrow();
      expect(() => buildTelemetryControlOption(
        analytics,
        [driver],
        ['throttle', 'brake', 'gear', 'rpm'],
      )).not.toThrow();
      const option = buildTelemetryHeatmapOption(analytics, [driver]);
      expect(option).not.toBeNull();
      if (option) {
        const series = option.series as Array<{ type: string; data: unknown[] }>;
        const heatSeries = series.find((item) => item.type === 'lines');
        expect(heatSeries?.data.length).toBeGreaterThan(0);
      }
    });
  });
});
