import type {
  DriverDetails,
  DriverStanding,
  SupabaseDriverDetailRow,
} from '@/types';

function firstText(...values: Array<string | null | undefined>): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() || '';
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
