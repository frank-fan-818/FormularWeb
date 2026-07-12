import { describe, expect, it } from 'vitest';
import { buildPredictionSeasonSnapshot, mergePredictionRaceSources } from './currentSeasonPredictionData';

const driver = (driverId: string) => ({ driverId });
const constructor = (constructorId: string) => ({ constructorId });

describe('buildPredictionSeasonSnapshot', () => {
  it('keeps completed races, joins sessions, and normalizes identifiers', () => {
    const snapshot = buildPredictionSeasonSnapshot(2026, {
      schedule: [
        { season: '2026', round: '1', raceName: 'Australian Grand Prix', Circuit: { circuitId: 'albert_park' } },
        { season: '2026', round: '2', raceName: 'Chinese Grand Prix', Circuit: { circuitId: 'shanghai' } },
      ],
      resultRaces: [{
        season: '2026', round: '1',
        Results: [{ position: '1', points: '25', grid: '2', laps: '58', status: 'Finished', Driver: driver('max_verstappen'), Constructor: constructor('red_bull') }],
      }],
      qualifyingRaces: [{
        season: '2026', round: '1',
        QualifyingResults: [{ position: '1', Driver: driver('lando_norris'), Constructor: constructor('mclaren'), Q1: '1:20.000', Q2: '1:19.000', Q3: '1:18.000' }],
      }],
      sprintRaces: [{
        season: '2026', round: '1',
        SprintResults: [{ position: '1', points: '8', grid: '1', laps: '20', status: 'Finished', Driver: driver('max_verstappen'), Constructor: constructor('red_bull') }],
      }],
      sprintQualifyingRaces: [],
    });

    expect(snapshot.races).toHaveLength(1);
    expect(snapshot.races[0]).toMatchObject({ round: 1, circuitId: 'albert-park', isSprintWeekend: true });
    expect(snapshot.races[0].results[0]).toMatchObject({ driverId: 'max-verstappen', constructorId: 'red-bull', gridPosition: 2 });
    expect(snapshot.races[0].qualifying[0].driverId).toBe('lando-norris');
  });

  it('excludes a round until a classified winner exists', () => {
    const snapshot = buildPredictionSeasonSnapshot(2026, {
      schedule: [{ season: '2026', round: '3', raceName: 'Japanese Grand Prix', Circuit: { circuitId: 'suzuka' } }],
      resultRaces: [{ season: '2026', round: '3', Results: [] }],
      qualifyingRaces: [], sprintRaces: [], sprintQualifyingRaces: [],
    });
    expect(snapshot.races).toEqual([]);
  });
});

describe('mergePredictionRaceSources', () => {
  it('replaces the same season and round without duplicating it', () => {
    const base = [{ season: 2026, round: 1, source: 'f1db' }, { season: 2025, round: 24, source: 'f1db' }];
    const live = [{ season: 2026, round: 1, source: 'jolpica' }];
    expect(mergePredictionRaceSources(base, live)).toEqual([
      { season: 2025, round: 24, source: 'f1db' },
      { season: 2026, round: 1, source: 'jolpica' },
    ]);
  });
});
