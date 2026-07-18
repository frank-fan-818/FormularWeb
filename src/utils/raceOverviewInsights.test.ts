import { describe, expect, it } from 'vitest';
import type { QualifyingResult, Result } from '@/types';
import { buildRaceOverviewInsights } from './raceOverviewInsights';

function result(
  code: string,
  position: number,
  grid: number,
  status = 'Finished',
  fastestLap?: string,
): Result {
  return {
    number: String(position),
    position: String(position),
    positionText: String(position),
    points: '0',
    grid: String(grid),
    laps: '57',
    status,
    Driver: {
      driverId: code.toLowerCase(),
      permanentNumber: '',
      code,
      url: '',
      givenName: code,
      familyName: 'Driver',
      dateOfBirth: '',
      nationality: '',
    },
    Constructor: {
      constructorId: `${code.toLowerCase()}-team`,
      url: '',
      name: `${code} Team`,
      nationality: '',
    },
    ...(fastestLap ? {
      FastestLap: {
        rank: '1',
        lap: '42',
        Time: { time: fastestLap },
        AverageSpeed: { units: 'kph', speed: '220' },
      },
    } : {}),
  };
}

function qualifyingResult(code: string, position: number): QualifyingResult {
  const raceResult = result(code, position, position);
  return {
    number: raceResult.number,
    position: String(position),
    Driver: raceResult.Driver,
    Constructor: raceResult.Constructor,
    Q1: '1:20.000',
  };
}

describe('buildRaceOverviewInsights', () => {
  it('builds podium, movement, fastest lap, pole, and retirement insights', () => {
    const insights = buildRaceOverviewInsights(
      [
        result('WIN', 1, 3, 'Finished', '1:21.100'),
        result('P2', 2, 1, 'Finished', '1:20.999'),
        result('P3', 3, 10),
        result('DNF', 18, 2, 'Engine'),
      ],
      [qualifyingResult('P2', 1), qualifyingResult('WIN', 2)],
      null,
    );

    expect(insights.podium.map((item) => item.Driver.code)).toEqual(['WIN', 'P2', 'P3']);
    expect(insights.winner?.Driver.code).toBe('WIN');
    expect(insights.pole?.Driver.code).toBe('P2');
    expect(insights.fastestLap?.result.Driver.code).toBe('P2');
    expect(insights.biggestGain).toMatchObject({ places: 7 });
    expect(insights.biggestLoss).toMatchObject({ places: 16 });
    expect(insights.retirements.map((item) => item.Driver.code)).toEqual(['DNF']);
    expect(insights.totalLaps).toBe(57);
  });

  it('treats lapped finishers as classified and handles an empty weekend', () => {
    const classified = result('LAP', 10, 11, '+1 Lap');
    const lapped = result('BACK', 11, 12, 'Lapped');
    const insights = buildRaceOverviewInsights([classified, lapped], [], null);

    expect(insights.retirements).toEqual([]);
    expect(insights.winner).toBeNull();
    expect(insights.podium).toEqual([]);
  });
});
