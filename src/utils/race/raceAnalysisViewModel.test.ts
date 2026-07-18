import { describe, expect, it } from 'vitest';
import type { FastF1CornerAnalysis, FastF1TelemetryDriver } from '@/types';
import {
  formatAnalysisLapRanges,
  formatAnalysisStatRange,
  getCornerSpeedRows,
} from './raceAnalysisViewModel';

describe('race analysis view model', () => {
  it('formats unavailable and populated statistic ranges', () => {
    expect(formatAnalysisStatRange()).toBe('-');
    expect(formatAnalysisStatRange({ min: null, max: 32 })).toBe('-');
    expect(formatAnalysisStatRange({ min: 28.24, max: 31.86 })).toBe('28.2-31.9 C');
  });

  it('formats rain lap ranges without mutating them', () => {
    const ranges = [{ startLap: 2, endLap: 2 }, { startLap: 9, endLap: 13 }];
    expect(formatAnalysisLapRanges(ranges)).toBe('L2, L9-L13');
    expect(ranges).toEqual([{ startLap: 2, endLap: 2 }, { startLap: 9, endLap: 13 }]);
  });

  it('filters corner speeds to active drivers and computes a two-driver delta', () => {
    const corners = [{
      corner: 'T1',
      distanceM: 240,
      drivers: [
        { driver: 'AAA', entrySpeedKph: 300, minSpeedKph: 122.34, exitSpeedKph: 180 },
        { driver: 'BBB', entrySpeedKph: 298, minSpeedKph: 119.11, exitSpeedKph: 177 },
        { driver: 'CCC', entrySpeedKph: 295, minSpeedKph: 118, exitSpeedKph: 175 },
      ],
    }] as FastF1CornerAnalysis[];
    const active = [
      { driver: 'AAA' },
      { driver: 'BBB' },
    ] as FastF1TelemetryDriver[];

    expect(getCornerSpeedRows(corners, active)).toEqual([{
      key: 'T1-240',
      corner: 'T1',
      distanceM: 240,
      drivers: corners[0].drivers.slice(0, 2),
      minSpeedDelta: 3.2,
    }]);
  });
});
