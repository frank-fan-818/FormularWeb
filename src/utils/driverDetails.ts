import type {
  Driver,
  DriverDetails,
  DriverStanding,
  SupabaseDriverDetailRow,
} from '@/types';

function firstText(...values: Array<string | null | undefined>): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() || '';
}

export function resolveDriverProfileIdentity(
  primary: Driver | null,
  standing: Driver | null,
  archive: Driver | null,
): Driver | null {
  if (!primary && !standing && !archive) return null;
  return {
    driverId: firstText(primary?.driverId, standing?.driverId, archive?.driverId),
    givenName: firstText(primary?.givenName, standing?.givenName, archive?.givenName),
    familyName: firstText(primary?.familyName, standing?.familyName, archive?.familyName),
    permanentNumber: firstText(primary?.permanentNumber, standing?.permanentNumber, archive?.permanentNumber),
    code: firstText(primary?.code, standing?.code, archive?.code),
    nationality: firstText(primary?.nationality, standing?.nationality, archive?.nationality),
    dateOfBirth: firstText(primary?.dateOfBirth, standing?.dateOfBirth, archive?.dateOfBirth),
    url: firstText(primary?.url, standing?.url, archive?.url),
  };
}

export function mapDriverDetails(
  requestedDriverId: string,
  standing: DriverStanding | null,
  databaseDriver: SupabaseDriverDetailRow | null,
): DriverDetails | null {
  if (!standing && !databaseDriver) return null;

  const apiDriver = standing?.Driver;
  return {
    driverId: firstText(databaseDriver?.driver_id, apiDriver?.driverId, requestedDriverId),
    permanentNumber: firstText(databaseDriver?.permanent_number, apiDriver?.permanentNumber),
    code: firstText(databaseDriver?.code, apiDriver?.code),
    url: firstText(apiDriver?.url, '#'),
    givenName: firstText(databaseDriver?.first_name, apiDriver?.givenName),
    familyName: firstText(databaseDriver?.last_name, apiDriver?.familyName),
    dateOfBirth: firstText(databaseDriver?.date_of_birth, apiDriver?.dateOfBirth),
    nationality: firstText(databaseDriver?.nationality, apiDriver?.nationality),
    totalWins: databaseDriver?.total_wins ?? 0,
    totalPodiums: databaseDriver?.total_podiums ?? 0,
    totalPolePositions: databaseDriver?.total_pole_positions ?? 0,
    totalFastestLaps: databaseDriver?.total_fastest_laps ?? 0,
    totalRaceStarts: databaseDriver?.total_race_starts ?? 0,
    standing,
  };
}
