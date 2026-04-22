import { describe, expect, it } from 'vitest';
import {
  mapConstructorHistorySummary,
  mapDriverHistorySummary,
} from '@/api/historySummaries';

describe('history summary mapping', () => {
  it('maps a driver summary row into the existing profile shape', () => {
    const profile = mapDriverHistorySummary({
      driver_id: 'max_verstappen',
      permanent_number: '1',
      code: 'VER',
      url: null,
      given_name: 'Max',
      family_name: 'Verstappen',
      date_of_birth: '1997-09-30',
      nationality: 'Dutch',
      recent_constructor_name: 'Red Bull',
      recent_constructor_id: 'red_bull',
      career_summary: {
        raceCount: 210,
        poleCount: 40,
        winCount: 63,
        podiumCount: 112,
        championshipCount: 4,
        totalPoints: 3021.5,
      },
      best_race_finish: {
        position: '1',
        seasons: ['2016', '2017', '2018'],
      },
      seasons: [
        { season: '2023', position: '1', points: 575, wins: 19, constructorName: 'Red Bull', constructorId: 'red_bull' },
        { season: '2022', position: '1', points: 454, wins: 15, constructorName: 'Red Bull', constructorId: 'red_bull' },
      ],
      updated_at: null,
    });

    expect(profile).toMatchObject({
      driverId: 'max_verstappen',
      givenName: 'Max',
      familyName: 'Verstappen',
      recentConstructorName: 'Red Bull',
    });
    expect(profile?.careerSummary.winCount).toBe(63);
    expect(profile?.bestRaceFinish?.position).toBe('1');
    expect(profile?.seasons[0].season).toBe('2023');
  });

  it('maps a constructor summary row into the existing profile shape', () => {
    const profile = mapConstructorHistorySummary({
      constructor_id: 'ferrari',
      url: null,
      name: 'Ferrari',
      nationality: 'Italian',
      career_summary: {
        raceCount: 1100,
        poleCount: 253,
        winCount: 247,
        podiumCount: 829,
        championshipCount: 16,
        totalPoints: 9501.5,
      },
      best_race_finish: {
        position: '1',
        seasons: ['1951', '1952'],
      },
      seasons: [
        { season: '2024', position: '2', points: 652, wins: 5 },
        { season: '2023', position: '3', points: 406, wins: 1 },
      ],
      updated_at: null,
    });

    expect(profile).toMatchObject({
      constructorId: 'ferrari',
      name: 'Ferrari',
      nationality: 'Italian',
    });
    expect(profile?.careerSummary.championshipCount).toBe(16);
    expect(profile?.seasons[0].season).toBe('2024');
  });

  it('rejects invalid summary rows so callers can fallback safely', () => {
    expect(mapDriverHistorySummary(null)).toBeNull();
    expect(mapDriverHistorySummary({
      driver_id: 'broken',
      permanent_number: null,
      code: null,
      url: null,
      given_name: null,
      family_name: null,
      date_of_birth: null,
      nationality: null,
      recent_constructor_name: null,
      recent_constructor_id: null,
      career_summary: null,
      best_race_finish: null,
      seasons: null,
      updated_at: null,
    })).toBeNull();
    expect(mapConstructorHistorySummary({
      constructor_id: 'broken',
      url: null,
      name: null,
      nationality: null,
      career_summary: null,
      best_race_finish: null,
      seasons: null,
      updated_at: null,
    })).toBeNull();
  });
});
