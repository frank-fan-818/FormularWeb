import { describe, expect, it } from 'vitest';
import type { ScheduledPredictionRace } from './currentRacePrediction';
import {
  buildCurrentRaceFeatureInputs,
  getPredictionPhase,
  hasCompletePredictionField,
  selectPredictionTarget,
} from './currentRacePrediction';

function race(round: number, overrides: Partial<ScheduledPredictionRace> = {}): ScheduledPredictionRace {
  return {
    season: 2026,
    round,
    raceName: `Race ${round}`,
    circuitId: `circuit-${round}`,
    raceStartAt: `2026-09-${String(round + 10).padStart(2, '0')}T12:00:00.000Z`,
    isSprintWeekend: false,
    results: [], qualifying: [], sprintResults: [], sprintQualifying: [],
    ...overrides,
  };
}

describe('current race prediction preparation', () => {
  it('selects the nearest future race without a winner', () => {
    const target = selectPredictionTarget([
      race(1, { results: [{ position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' }] }),
      race(3), race(2),
    ], Date.parse('2026-09-01T00:00:00.000Z'));
    expect(target?.round).toBe(2);
  });

  it('uses qualifying availability to choose the final phase', () => {
    expect(getPredictionPhase(race(2))).toBe('pre_weekend');
    expect(getPredictionPhase(race(2, { qualifying: [
      { position: 1, driverId: 'a', constructorId: 'x', q1: null, q2: null, q3: '1:20.000' },
      { position: 2, driverId: 'b', constructorId: 'y', q1: null, q2: null, q3: '1:20.200' },
    ] }))).toBe('post_quali');
  });

  it('refuses to publish a partial entry field', () => {
    expect(hasCompletePredictionField(12)).toBe(false);
    expect(hasCompletePredictionField(15)).toBe(true);
  });

  it('builds entrants and standings from the latest completed races', () => {
    const completed = race(1, { results: [
      { position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 2, laps: 50, status: 'Finished' },
      { position: 2, driverId: 'b', constructorId: 'y', points: 18, gridPosition: 1, laps: 50, status: 'Finished' },
    ] });
    const inputs = buildCurrentRaceFeatureInputs(race(2), [completed]);
    expect(inputs.map((input) => input.driverId)).toEqual(['a', 'b']);
    expect(inputs[0].driverStanding).toMatchObject({ position: 1, points: 25, wins: 1 });
    expect(inputs[1].driverRecentForm?.finishPositions).toEqual([2]);
  });
});
