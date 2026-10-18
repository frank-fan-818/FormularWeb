import { describe, expect, it } from 'vitest';
import type { ScheduledPredictionRace } from './currentRacePrediction';
import {
  buildCurrentRaceFeatureInputs,
  getPredictionPhase,
  hasCompletePredictionField,
  selectPredictionTarget,
} from './currentRacePrediction';
import { buildWinnerFeatureVector } from './winnerFeatureBuilder';

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

  it('excludes future/target results and keeps cross-season form out of current standings', () => {
    const result = { position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' };
    const previous = race(24, { season: 2025, results: [result] });
    const current = race(1, { results: [{ ...result, position: 2, points: 18 }, { ...result, driverId: 'b' }] });
    const target = race(2);
    const future = race(3, { results: [result] });
    const inputs = buildCurrentRaceFeatureInputs(target, [future, current, previous]);
    expect(inputs.find((input) => input.driverId === 'a')?.driverStanding?.points).toBe(18);
    expect(inputs.find((input) => input.driverId === 'a')?.driverRecentForm?.finishPositions).toEqual([1, 2]);
  });

  it('masks target qualifying and sprint results in pre-weekend inputs', () => {
    const results = [{ position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' }];
    const target = race(2, { qualifying: [{ position: 1, driverId: 'new', constructorId: 'y', q1: null, q2: null, q3: '1:20' }], sprintResults: results });
    const inputs = buildCurrentRaceFeatureInputs(target, [race(1, { results })], 'pre_weekend');
    expect(inputs.map((input) => input.driverId)).toEqual(['a']);
    expect(inputs[0].qualifying).toBeUndefined();
    expect(inputs[0].sprint?.sprintPosition).toBeUndefined();
  });

  it('measures retirement reliability against the race distance', () => {
    const results = [
      { position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' },
      { position: 2, driverId: 'b', constructorId: 'y', points: 0, gridPosition: 2, laps: 10, status: 'Engine' },
    ];
    const form = buildCurrentRaceFeatureInputs(race(2), [race(1, { results })])[1].driverRecentForm;
    expect(form?.totalLapsPossible).toBe(50);
    expect(form?.totalLapsCompleted).toBe(10);
  });

  it('uses distinct 3/5/10 race windows and counts constructor meetings once', () => {
    const history = Array.from({ length: 10 }, (_, index) => race(index + 1, { results: [
      { position: index === 9 ? 1 : 4, driverId: 'a', constructorId: 'x', points: 0, gridPosition: 1, laps: 50, status: 'Finished' },
      { position: 5, driverId: 'b', constructorId: 'x', points: 0, gridPosition: 2, laps: 50, status: 'Finished' },
      { position: index === 9 ? 3 : 1, driverId: 'winner', constructorId: 'y', points: 0, gridPosition: 3, laps: 50, status: 'Finished' },
    ] }));
    const input = buildCurrentRaceFeatureInputs(race(11), history)[0];
    expect(input.driverRecentForm?.windows?.short).toMatchObject({ raceCount: 3, winRate: 1 / 3 });
    expect(input.driverRecentForm?.windows?.recent).toMatchObject({ raceCount: 5, winRate: 1 / 5 });
    expect(input.driverRecentForm?.windows?.long).toMatchObject({ raceCount: 10, winRate: 1 / 10 });
    expect(input.constructorRecentForm?.windows?.short).toMatchObject({ raceCount: 3, winRate: 1 / 3 });
    const features = buildWinnerFeatureVector(input);
    expect(features.driverShortRecentWinRate).toBeGreaterThan(features.driverRecentWinRate);
  });

  it('builds circuit history only from prior completed races at this circuit', () => {
    const result = { position: 1, driverId: 'a', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' };
    const history = [race(1, { circuitId: 'same', results: [result] }), race(2, { results: [result] }), race(4, { circuitId: 'same', results: [result] })];
    const input = buildCurrentRaceFeatureInputs(race(3, { circuitId: 'same' }), history)[0];
    expect(input.circuitHistory).toMatchObject({ driverWinCount: 1, driverTotalRaces: 1, constructorTotalRaces: 1, totalSamples: 1, poleWinConversionPct: 100 });
    expect(input.circuitHistory?.scRate).toBeNull();
  });

  it('uses only complete confirmed observations available at the prediction cutoff', () => {
    const entries = Array.from({ length: 16 }, (_, index) => ({ driverId: `d${index}`, constructorId: 'x' }));
    const observations = [{ observedAt: '2026-09-11T00:00:00Z', source: 'openf1', entries }];
    const target = race(2, { preRaceObservations: observations });
    const history = [race(1, { results: [{ position: 1, driverId: 'old', constructorId: 'x', points: 25, gridPosition: 1, laps: 50, status: 'Finished' }] })];
    expect(buildCurrentRaceFeatureInputs(target, history, 'pre_weekend', { asOf: '2026-09-11T12:00:00Z' })[0].driverId).toBe('d0');
    expect(buildCurrentRaceFeatureInputs(target, history, 'pre_weekend', { asOf: '2026-09-10T12:00:00Z' })[0].driverId).toBe('old');
    expect(buildCurrentRaceFeatureInputs({ ...target, preRaceObservations: [{ ...observations[0], entries: entries.slice(0, 3) }] }, history, 'pre_weekend', { asOf: '2026-09-11T12:00:00Z' })[0].driverId).toBe('old');
  });

  it('keeps a confirmed penalty/pit-lane grid separate from qualifying position', () => {
    const entries = Array.from({ length: 16 }, (_, index) => ({ driverId: `d${index}`, constructorId: 'x', gridPosition: index === 0 ? 0 : index }));
    const target = race(2, { qualifying: entries.map((entry, index) => ({ ...entry, position: index + 1, q1: null, q2: null, q3: '1:20' })),
      preRaceObservations: [{ observedAt: '2026-09-11T00:00:00Z', source: 'openf1', entries }] });
    const input = buildCurrentRaceFeatureInputs(target, [], 'post_quali', { asOf: '2026-09-11T12:00:00Z' })[0];
    const features = buildWinnerFeatureVector(input);
    expect(features.qualifyingPole).toBe(1);
    expect(features.gridPole).toBe(0);
    expect(features.gridAdvantage).toBe(-1);
  });

  it('keeps missing recent history neutral rather than treating a rookie as a known non-winner', () => {
    const qualifying = Array.from({ length: 16 }, (_, index) => ({ position: index + 1, driverId: `d${index}`, constructorId: `c${index}`, q1: null, q2: null, q3: '1:20' }));
    const input = buildCurrentRaceFeatureInputs(race(2, { qualifying }), [], 'post_quali')[0];
    const features = buildWinnerFeatureVector(input);
    expect(features.driverShortRecentWinRate).toBe(0);
    expect(features.driverRecentWinRate).toBe(0);
    expect(features.constructorLongRecentWinRate).toBe(0);
    expect(features.driverRecentReliability).toBe(0);
  });
});
