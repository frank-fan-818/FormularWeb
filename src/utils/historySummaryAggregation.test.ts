import { describe, expect, it } from 'vitest';
import { buildHistorySummaryPayloads } from './historySummaryAggregation.ts';
import type { ConstructorSeasonHistoryItem, DriverSeasonHistoryItem, HistoryCareerSummary } from '../types/index.ts';

function careerSummaryOf(value: { career_summary: unknown } | undefined): HistoryCareerSummary | undefined {
  return value?.career_summary as HistoryCareerSummary | undefined;
}

function driverSeasonsOf(value: { seasons: unknown } | undefined): DriverSeasonHistoryItem[] {
  return (value?.seasons || []) as DriverSeasonHistoryItem[];
}

function constructorSeasonsOf(value: { seasons: unknown } | undefined): ConstructorSeasonHistoryItem[] {
  return (value?.seasons || []) as ConstructorSeasonHistoryItem[];
}

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

  it('uses official F1DB standings instead of raw race-result sums for drop-score seasons', () => {
    const payloads = buildHistorySummaryPayloads({
      drivers: [
        {
          driver_id: 'ayrton_senna',
          first_name: 'Ayrton',
          last_name: 'Senna',
          code: 'SEN',
          permanent_number: null,
          date_of_birth: '1960-03-21',
          nationality: 'Brazilian',
        },
        {
          driver_id: 'alain_prost',
          first_name: 'Alain',
          last_name: 'Prost',
          code: 'PRO',
          permanent_number: null,
          date_of_birth: '1955-02-24',
          nationality: 'French',
        },
        {
          driver_id: 'niki_lauda',
          first_name: 'Niki',
          last_name: 'Lauda',
          code: null,
          permanent_number: null,
          date_of_birth: '1949-02-22',
          nationality: 'Austrian',
        },
      ],
      constructors: [
        { constructor_id: 'mclaren', name: 'McLaren', nationality: 'British' },
      ],
      races: [
        { id: 198801, season: 1988, round: 1, date: '1988-04-03', time: null },
        { id: 198802, season: 1988, round: 2, date: '1988-05-01', time: null },
        { id: 198401, season: 1984, round: 1, date: '1984-03-25', time: null },
      ],
      raceResults: [
        { race_id: 198801, driver_id: 'ayrton_senna', constructor_id: 'mclaren', position: 1, points: 9 },
        { race_id: 198802, driver_id: 'ayrton_senna', constructor_id: 'mclaren', position: 1, points: 9 },
        { race_id: 198801, driver_id: 'alain_prost', constructor_id: 'mclaren', position: 2, points: 6 },
        { race_id: 198802, driver_id: 'alain_prost', constructor_id: 'mclaren', position: 2, points: 6 },
        { race_id: 198401, driver_id: 'niki_lauda', constructor_id: 'mclaren', position: 1, points: 9 },
      ],
      qualifyingResults: [],
      officialDriverStandings: [
        { season: 1988, driver_id: 'ayrton_senna', position: 1, points: 90 },
        { season: 1988, driver_id: 'alain_prost', position: 2, points: 87 },
        { season: 1984, driver_id: 'niki_lauda', position: 1, points: 72 },
        { season: 1984, driver_id: 'alain_prost', position: 2, points: 71.5 },
      ],
      officialConstructorStandings: [
        { season: 1988, constructor_id: 'mclaren', position: 1, points: 199 },
      ],
    }, '2026-04-22T12:00:00.000Z');

    const senna = payloads.driverSummaries.find((item) => item.driver_id === 'ayrton_senna');
    const prost = payloads.driverSummaries.find((item) => item.driver_id === 'alain_prost');
    const lauda = payloads.driverSummaries.find((item) => item.driver_id === 'niki_lauda');
    const mclaren = payloads.constructorSummaries.find((item) => item.constructor_id === 'mclaren');

    expect(careerSummaryOf(senna)?.championshipCount).toBe(1);
    expect(driverSeasonsOf(senna).find((season) => season.season === '1988')).toMatchObject({
      position: '1',
      points: 90,
    });
    expect(careerSummaryOf(prost)?.championshipCount).toBe(0);
    expect(driverSeasonsOf(prost).find((season) => season.season === '1988')).toMatchObject({
      position: '2',
      points: 87,
    });
    expect(careerSummaryOf(lauda)?.championshipCount).toBe(1);
    expect(driverSeasonsOf(lauda).find((season) => season.season === '1984')).toMatchObject({
      position: '1',
      points: 72,
    });
    expect(driverSeasonsOf(prost).find((season) => season.season === '1984')).toMatchObject({
      position: '2',
      points: 71.5,
    });
    expect(careerSummaryOf(mclaren)?.championshipCount).toBe(2);
    expect(constructorSeasonsOf(mclaren).find((season) => season.season === '1988')).toMatchObject({
      position: '1',
      points: 199,
    });
  });

  it('does not count an unfinished latest season as a world championship', () => {
    const payloads = buildHistorySummaryPayloads({
      drivers: [
        {
          driver_id: 'current_leader',
          first_name: 'Current',
          last_name: 'Leader',
          code: null,
          permanent_number: null,
          date_of_birth: null,
          nationality: 'Test',
        },
      ],
      constructors: [
        { constructor_id: 'current_team', name: 'Current Team', nationality: 'Test' },
      ],
      races: [
        { id: 1, season: 2026, round: 1, date: '2026-03-01', time: null },
        { id: 2, season: 2026, round: 2, date: '2026-12-01', time: null },
      ],
      raceResults: [
        { race_id: 1, driver_id: 'current_leader', constructor_id: 'current_team', position: 1, points: 25 },
      ],
      qualifyingResults: [],
      officialDriverStandings: [
        { season: 2026, driver_id: 'current_leader', position: 1, points: 25 },
      ],
      officialConstructorStandings: [
        { season: 2026, constructor_id: 'current_team', position: 1, points: 25 },
      ],
    }, '2026-04-22T12:00:00.000Z');

    expect(driverSeasonsOf(payloads.driverSummaries[0])[0]).toMatchObject({
      season: '2026',
      position: '1',
      points: 25,
    });
    expect(careerSummaryOf(payloads.driverSummaries[0])?.championshipCount).toBe(0);
    expect(careerSummaryOf(payloads.constructorSummaries[0])?.championshipCount).toBe(0);
  });
});
