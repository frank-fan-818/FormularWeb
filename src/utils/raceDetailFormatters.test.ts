import { describe, expect, it } from 'vitest';
import {
  escapeTooltipText,
  formatNumber,
  formatPodium,
  formatProbability,
  formatSeconds,
  formatSignedNumber,
  formatSignedSeconds,
  formatSpeed,
  formatTemperature,
  formatWindSpeed,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import type { RecentGrandPrixResult } from '@/types';

describe('raceDetailFormatters', () => {
  it('escapes tooltip HTML-sensitive text', () => {
    expect(escapeTooltipText(`Max <VER> & "Checo"`)).toBe('Max &lt;VER&gt; &amp; &quot;Checo&quot;');
    expect(escapeTooltipText(null)).toBe('');
  });

  it('formats lap and session values consistently', () => {
    expect(formatSeconds(81.2345)).toBe('1:21.234');
    expect(formatSeconds(Number.NaN)).toBe('-');
    expect(formatNumber(12.345, 2)).toBe('12.35');
    expect(formatTemperature(31.25)).toBe('31.3 C');
    expect(formatWindSpeed(5.234)).toBe('5.2 m/s');
    expect(formatSpeed(314.159)).toBe('314.2 km/h');
    expect(formatProbability(null)).toBe('-');
    expect(formatProbability(37.5)).toBe('38%');
  });

  it('formats signed deltas and tone classes', () => {
    expect(formatSignedNumber(1.25, 1)).toBe('+1.3');
    expect(formatSignedNumber(-1.25, 1)).toBe('-1.3');
    expect(formatSignedSeconds(0)).toBe('0.000s');
    expect(formatSignedSeconds(-0.3214)).toBe('-0.321s');
    expect(getGapToneClassName(null)).toBe('is-even');
    expect(getGapToneClassName(-0.1)).toBe('is-faster');
    expect(getGapToneClassName(0.1)).toBe('is-slower');
  });

  it('formats recent podium summaries', () => {
    const result: RecentGrandPrixResult = {
      raceId: 1,
      season: 2025,
      round: 1,
      raceName: 'Australian Grand Prix',
      circuitId: 'albert_park',
      date: '2025-03-16',
      winnerDriverId: 'norris',
      winnerName: 'Lando Norris',
      winnerConstructorId: 'mclaren',
      winnerConstructorName: 'McLaren',
      poleDriverId: null,
      poleName: null,
      podium: [
        { position: 1, driverId: 'norris', driverName: 'Lando Norris', constructorId: 'mclaren', constructorName: 'McLaren' },
        { position: 2, driverId: 'verstappen', driverName: 'Max Verstappen', constructorId: 'red_bull', constructorName: 'Red Bull' },
      ],
    };

    expect(formatPodium(result)).toBe('P1 Lando Norris / P2 Max Verstappen');
    expect(formatPodium({ ...result, podium: [] })).toBe('-');
  });
});
