import { describe, expect, it } from 'vitest';
import {
  getDriverIdCandidates,
  mapConstructorSeasonHistory,
  mapDriverSeasonHistory,
  type ConstructorCareerStandingList,
  type DriverCareerStandingList,
} from '@/api/ergast';
import type { Constructor, ConstructorStanding, Driver, DriverStanding } from '@/types';

const driver: Driver = {
  driverId: 'max_verstappen',
  permanentNumber: '1',
  code: 'VER',
  url: '#',
  givenName: 'Max',
  familyName: 'Verstappen',
  dateOfBirth: '1997-09-30',
  nationality: 'Dutch',
};

const constructor: Constructor = {
  constructorId: 'red_bull',
  url: '#',
  name: 'Red Bull',
  nationality: 'Austrian',
};

function driverStanding(overrides: Partial<DriverStanding> = {}): DriverStanding {
  return {
    position: '1',
    positionText: '1',
    points: '575',
    wins: '19',
    Driver: driver,
    Constructors: [constructor],
    ...overrides,
  };
}

function constructorStanding(overrides: Partial<ConstructorStanding> = {}): ConstructorStanding {
  return {
    position: '1',
    positionText: '1',
    points: '860',
    wins: '21',
    Constructor: constructor,
    ...overrides,
  };
}

describe('ergast history helpers', () => {
  it('builds driver id candidates from ids and family names', () => {
    expect(getDriverIdCandidates('pietro_fittipaldi', { familyName: 'Fittipaldi' })).toEqual([
      'pietro_fittipaldi',
      'fittipaldi',
    ]);

    expect(getDriverIdCandidates('juan_manuel_fangio', { familyName: 'Fangio Jr' }))
      .toContain('fangio');
  });

  it('maps driver season history in descending season order', () => {
    const standingsLists: DriverCareerStandingList[] = [
      {
        season: '2021',
        round: '',
        DriverStandings: [driverStanding({ position: '1', points: '395.5', wins: '10' })],
        ConstructorStandings: [],
      },
      {
        season: '2023',
        round: '',
        DriverStandings: [driverStanding()],
        ConstructorStandings: [],
      },
    ];

    expect(mapDriverSeasonHistory(standingsLists)).toEqual([
      {
        season: '2023',
        position: '1',
        points: 575,
        wins: 19,
        constructorName: 'Red Bull',
        constructorId: 'red_bull',
      },
      {
        season: '2021',
        position: '1',
        points: 395.5,
        wins: 10,
        constructorName: 'Red Bull',
        constructorId: 'red_bull',
      },
    ]);
  });

  it('maps constructor season history in descending season order', () => {
    const standingsLists: ConstructorCareerStandingList[] = [
      {
        season: '2022',
        round: '',
        DriverStandings: [],
        ConstructorStandings: [constructorStanding({ points: '759', wins: '17' })],
      },
      {
        season: '2023',
        round: '',
        DriverStandings: [],
        ConstructorStandings: [constructorStanding()],
      },
    ];

    expect(mapConstructorSeasonHistory(standingsLists)).toEqual([
      { season: '2023', position: '1', points: 860, wins: 21 },
      { season: '2022', position: '1', points: 759, wins: 17 },
    ]);
  });
});
