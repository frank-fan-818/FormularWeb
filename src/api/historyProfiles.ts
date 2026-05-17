import {
  mapConstructorHistorySummary,
  mapDriverHistorySummary,
} from '@/api/historySummaries';
import { supabaseApi } from '@/api/supabase';
import { seasonApi } from '@/api/ergast';
import type {
  ConstructorStanding,
  ConstructorHistoryProfile,
  DriverStanding,
  DriverHistoryProfile,
} from '@/types';

const driverHistoryProfileCache = new Map<string, DriverHistoryProfile | null>();
const constructorHistoryProfileCache = new Map<string, ConstructorHistoryProfile | null>();
const driverHistoryProfileInFlight = new Map<string, Promise<DriverHistoryProfile | null>>();
const constructorHistoryProfileInFlight = new Map<string, Promise<ConstructorHistoryProfile | null>>();

type DriverNationalityRow = {
  nationality?: string | null;
};

type ConstructorNationalityRow = {
  nationality?: string | null;
};

function normalizeOptionalText(value: string | null | undefined): string {
  const normalized = (value || '').trim();
  if (!normalized || normalized === '-' || normalized.toLowerCase() === 'unknown' || normalized.toLowerCase() === 'n/a') {
    return '';
  }

  return normalized;
}

function normalizeNameToken(value: string | null | undefined): string {
  return normalizeOptionalText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeIdentifierToken(value: string | null | undefined): string {
  return normalizeNameToken(value).replace(/\s+/g, '_');
}

function findDriverStandingMatch(standings: DriverStanding[], profile: DriverHistoryProfile): DriverStanding | null {
  const driverId = normalizeIdentifierToken(profile.driverId);
  const givenName = normalizeNameToken(profile.givenName);
  const familyName = normalizeNameToken(profile.familyName);

  return standings.find((standing) => {
    if (normalizeIdentifierToken(standing.Driver.driverId) === driverId) {
      return true;
    }

    return normalizeNameToken(standing.Driver.givenName) === givenName
      && normalizeNameToken(standing.Driver.familyName) === familyName;
  }) || null;
}

function findConstructorStandingMatch(
  standings: ConstructorStanding[],
  profile: ConstructorHistoryProfile,
): ConstructorStanding | null {
  const constructorId = normalizeIdentifierToken(profile.constructorId);
  const constructorName = normalizeNameToken(profile.name);

  return standings.find((standing) => {
    if (normalizeIdentifierToken(standing.Constructor.constructorId) === constructorId) {
      return true;
    }

    return normalizeNameToken(standing.Constructor.name) === constructorName;
  }) || null;
}

async function resolveDriverNationalityFromStandings(profile: DriverHistoryProfile): Promise<string> {
  const latestSeason = profile.seasons[0]?.season;
  if (!latestSeason) {
    return '';
  }

  try {
    const standings = await seasonApi.getDriverStandings(latestSeason);
    const match = findDriverStandingMatch(standings, profile);
    return normalizeOptionalText(match?.Driver?.nationality);
  } catch {
    return '';
  }
}

async function resolveConstructorNationalityFromStandings(profile: ConstructorHistoryProfile): Promise<string> {
  const latestSeason = profile.seasons[0]?.season;
  if (!latestSeason) {
    return '';
  }

  try {
    const standings = await seasonApi.getConstructorStandings(latestSeason);
    const match = findConstructorStandingMatch(standings, profile);
    return normalizeOptionalText(match?.Constructor?.nationality);
  } catch {
    return '';
  }
}

async function getDriverSummaryProfile(driverId: string): Promise<DriverHistoryProfile | null> {
  const summary = await supabaseApi.driverHistorySummaries.getById(driverId);
  const profile = mapDriverHistorySummary(summary);

  if (!profile) {
    return profile;
  }

  const summaryNationality = normalizeOptionalText(profile.nationality);
  if (summaryNationality) {
    return {
      ...profile,
      nationality: summaryNationality,
    };
  }

  const driver = await supabaseApi.drivers.getById<DriverNationalityRow>(driverId);
  const baseNationality = normalizeOptionalText(driver?.nationality);
  if (baseNationality) {
    return {
      ...profile,
      nationality: baseNationality,
    };
  }

  const fallbackNationality = await resolveDriverNationalityFromStandings(profile);
  if (!fallbackNationality) {
    return profile;
  }

  return {
    ...profile,
    nationality: fallbackNationality,
  };
}

async function getConstructorSummaryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  const summary = await supabaseApi.constructorHistorySummaries.getById(constructorId);
  const profile = mapConstructorHistorySummary(summary);

  if (!profile) {
    return profile;
  }

  const summaryNationality = normalizeOptionalText(profile.nationality);
  if (summaryNationality) {
    return {
      ...profile,
      nationality: summaryNationality,
    };
  }

  const constructor = await supabaseApi.constructors.getById<ConstructorNationalityRow>(constructorId);
  const baseNationality = normalizeOptionalText(constructor?.nationality);
  if (baseNationality) {
    return {
      ...profile,
      nationality: baseNationality,
    };
  }

  const fallbackNationality = await resolveConstructorNationalityFromStandings(profile);
  if (!fallbackNationality) {
    return profile;
  }

  return {
    ...profile,
    nationality: fallbackNationality,
  };
}

async function getDriverHistoryProfile(driverId: string): Promise<DriverHistoryProfile | null> {
  if (driverHistoryProfileCache.has(driverId)) {
    return driverHistoryProfileCache.get(driverId) ?? null;
  }

  const inFlight = driverHistoryProfileInFlight.get(driverId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const summaryProfile = await getDriverSummaryProfile(driverId);
    if (summaryProfile) {
      return summaryProfile;
    }

    // Slow fallback: only load the heavy cross-season API path when the summary row is missing.
    const { historyApi } = await import('@/api/ergast');
    return historyApi.getDriverHistoryProfile(driverId);
  })()
    .then((profile) => {
      driverHistoryProfileCache.set(driverId, profile);
      return profile;
    })
    .finally(() => {
      driverHistoryProfileInFlight.delete(driverId);
    });

  driverHistoryProfileInFlight.set(driverId, request);
  return request;
}

async function getConstructorHistoryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  if (constructorHistoryProfileCache.has(constructorId)) {
    return constructorHistoryProfileCache.get(constructorId) ?? null;
  }

  const inFlight = constructorHistoryProfileInFlight.get(constructorId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const summaryProfile = await getConstructorSummaryProfile(constructorId);
    if (summaryProfile) {
      return summaryProfile;
    }

    // Slow fallback: only load the heavy cross-season API path when the summary row is missing.
    const { historyApi } = await import('@/api/ergast');
    return historyApi.getConstructorHistoryProfile(constructorId);
  })()
    .then((profile) => {
      constructorHistoryProfileCache.set(constructorId, profile);
      return profile;
    })
    .finally(() => {
      constructorHistoryProfileInFlight.delete(constructorId);
    });

  constructorHistoryProfileInFlight.set(constructorId, request);
  return request;
}

export const historyProfilesApi = {
  getDriverSummaryProfile,
  getConstructorSummaryProfile,
  getDriverHistoryProfile,
  getConstructorHistoryProfile,
};
