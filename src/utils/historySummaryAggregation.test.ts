import { describe, expect, it } from 'vitest';
import { buildHistorySummaryPayloads } from './historySummaryAggregation.ts';

describe('historySummaryAggregation', () => {
  it('builds driver and constructor summaries from Supabase source tables', () => {
    const payloads = buildHistorySummaryPayloads({
      drivers: [
        {
          driver_id: 'max_verstappen',
          first_name: 'Max',
          last_name: 'Verstappen',
          code: 'VER',
          permanent_number: '1',
          date_of_birth: '1997-09-30',
          nationality: 'Dutch',
        },
        {
          driver_id: 'charles_leclerc',
          first_name: 'Charles',
          last_name: 'Leclerc',
          code: 'LEC',
          permanent_number: '16',
          date_of_birth: '1997-10-16',
          nationality: 'Monacan',
        },
      ],
      constructors: [
        {
          constructor_id: 'red_bull',
          name: 'Red Bull',
          nationality: 'Austrian',
        },
        {
          constructor_id: 'ferrari',
          name: 'Ferrari',
          nationality: 'Italian',
        },
      ],
      races: [
        { id: 1, season: 2024, round: 1, date: '2024-03-02', time: null },
        { id: 2, season: 2024, round: 2, date: '2024-03-09', time: null },
        { id: 3, season: 2023, round: 22, date: '2023-11-26', time: null },
      ],
      raceResults: [
        { race_id: 1, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1, points: 25 },
        { race_id: 1, driver_id: 'charles_leclerc', constructor_id: 'ferrari', position: 2, points: 18 },
        { race_id: 2, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 2, points: 18 },
        { race_id: 2, driver_id: 'charles_leclerc', constructor_id: 'ferrari', position: 1, points: 15 },
        { race_id: 3, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1, points: 25 },
      ],
      qualifyingResults: [
        { race_id: 1, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1 },
        { race_id: 2, driver_id: 'charles_leclerc', constructor_id: 'ferrari', position: 1 },
        { race_id: 3, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1 },
      ],
    }, '2026-04-22T12:00:00.000Z');

    const max = payloads.driverSummaries.find((item) => item.driver_id === 'max_verstappen');
    const ferrari = payloads.constructorSummaries.find((item) => item.constructor_id === 'ferrari');

    expect(max).toMatchObject({
      recent_constructor_id: 'red_bull',
      career_summary: {
        raceCount: 3,
        poleCount: 2,
        winCount: 2,
        podiumCount: 3,
        championshipCount: 2,
        totalPoints: 68,
      },
    });
    expect(max?.best_race_finish).toEqual({
      position: '1',
      seasons: ['2023', '2024'],
    });
    expect(max?.seasons).toEqual([
      {
        season: '2024',
        position: '1',
        points: 43,
        wins: 1,
        constructorName: 'Red Bull',
        constructorId: 'red_bull',
      },
      {
        season: '2023',
        position: '1',
        points: 25,
        wins: 1,
        constructorName: 'Red Bull',
        constructorId: 'red_bull',
      },
    ]);

    expect(ferrari).toMatchObject({
      career_summary: {
        raceCount: 2,
        poleCount: 1,
        winCount: 1,
        podiumCount: 2,
        championshipCount: 0,
        totalPoints: 33,
      },
      best_race_finish: {
        position: '1',
        seasons: ['2024'],
      },
      seasons: [
        {
          season: '2024',
          position: '2',
          points: 33,
          wins: 1,
        },
      ],
    });
  });

  it('keeps empty summaries for entities without race history so history pages can skip fallback', () => {
    const payloads = buildHistorySummaryPayloads({
      drivers: [
        {
          driver_id: 'reserve_driver',
          first_name: 'Reserve',
          last_name: 'Driver',
          code: null,
          permanent_number: null,
          date_of_birth: null,
          nationality: 'Test',
        },
      ],
      constructors: [
        {
          constructor_id: 'new_team',
          name: 'New Team',
          nationality: 'Test',
        },
      ],
      races: [],
      raceResults: [],
      qualifyingResults: [],
    }, '2026-04-22T12:00:00.000Z');

    expect(payloads.driverSummaries[0]).toMatchObject({
      driver_id: 'reserve_driver',
      career_summary: {
        raceCount: 0,
        poleCount: 0,
        winCount: 0,
        podiumCount: 0,
        championshipCount: 0,
        totalPoints: 0,
      },
      best_race_finish: null,
      seasons: [],
    });

    expect(payloads.constructorSummaries[0]).toMatchObject({
      constructor_id: 'new_team',
      career_summary: {
        raceCount: 0,
        poleCount: 0,
        winCount: 0,
        podiumCount: 0,
        championshipCount: 0,
        totalPoints: 0,
      },
      best_race_finish: null,
      seasons: [],
    });
  });
});
