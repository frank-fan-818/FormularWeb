import { describe, expect, it } from 'vitest';
import type { DriverStanding, SupabaseDriverDetailRow } from '@/types';
import { mapDriverDetails, resolveDriverProfileIdentity } from './driverDetails';

const standing: DriverStanding = {
  position: '1',
  positionText: '1',
  points: '100',
  wins: '4',
  Driver: {
    driverId: 'max_verstappen',
    permanentNumber: '3',
    code: 'VER',
    url: 'https://example.com/max',
    givenName: 'Max',
    familyName: 'Verstappen',
    dateOfBirth: '1997-09-30',
    nationality: 'Dutch',
  },
  Constructors: [],
};

const databaseDriver: SupabaseDriverDetailRow = {
  driver_id: 'max_verstappen',
  permanent_number: null,
  code: null,
  first_name: null,
  last_name: null,
  date_of_birth: null,
  nationality: null,
  total_wins: 65,
  total_podiums: 120,
  total_pole_positions: 45,
  total_fastest_laps: 35,
  total_race_starts: 220,
};

describe('mapDriverDetails', () => {
  it('keeps valid API identity fields when database fields are null', () => {
    const result = mapDriverDetails('max_verstappen', standing, databaseDriver);

    expect(result).toMatchObject({
      code: 'VER',
      nationality: 'Dutch',
      givenName: 'Max',
      totalWins: 65,
      standing,
    });
    expect(result).not.toHaveProperty('driver_id');
    expect(result).not.toHaveProperty('first_name');
  });

  it('prefers non-empty database identity fields', () => {
    const result = mapDriverDetails('max_verstappen', standing, {
      ...databaseDriver,
      permanent_number: '1',
      code: 'MAX',
      nationality: 'Netherlands',
    });

    expect(result?.permanentNumber).toBe('1');
    expect(result?.code).toBe('MAX');
    expect(result?.nationality).toBe('Netherlands');
  });

  it('returns null when neither source contains a driver', () => {
    expect(mapDriverDetails('missing', null, null)).toBeNull();
  });
});

describe('driver profile identity across current and search archive routes', () => {
  it('restores blank metadata fields from the current standing', () => {
    expect(resolveDriverProfileIdentity({ ...standing.Driver, nationality: '', permanentNumber: '', givenName: '' }, standing.Driver, null))
      .toMatchObject({ nationality: 'Dutch', permanentNumber: '3', givenName: 'Max' });
  });

  it('fills missing historical identity fields from the archive without requiring current-season standings', () => {
    expect(resolveDriverProfileIdentity({ ...standing.Driver, nationality: '', permanentNumber: '' }, null,
      { ...standing.Driver, nationality: 'Netherlands', permanentNumber: '33' }))
      .toMatchObject({ nationality: 'Netherlands', permanentNumber: '33' });
  });

  it('can render an archive profile when the current driver metadata row is unavailable', () => {
    expect(resolveDriverProfileIdentity(null, null, standing.Driver)).toEqual(standing.Driver);
    expect(resolveDriverProfileIdentity(null, null, null)).toBeNull();
  });
});
