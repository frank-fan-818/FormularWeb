import {
  mapConstructorHistorySummary,
  mapDriverHistorySummary,
} from '@/api/historySummaries';
import { supabaseApi } from '@/api/supabase';
import type {
  ConstructorHistoryProfile,
  DriverHistoryProfile,
} from '@/types';

async function getDriverSummaryProfile(driverId: string): Promise<DriverHistoryProfile | null> {
  const summary = await supabaseApi.driverHistorySummaries.getById(driverId);
  return mapDriverHistorySummary(summary);
}

async function getConstructorSummaryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  const summary = await supabaseApi.constructorHistorySummaries.getById(constructorId);
  return mapConstructorHistorySummary(summary);
}

async function getDriverHistoryProfile(driverId: string): Promise<DriverHistoryProfile | null> {
  const summaryProfile = await getDriverSummaryProfile(driverId);
  if (summaryProfile) {
    return summaryProfile;
  }

  // Slow fallback: only load the heavy cross-season API path when the summary row is missing.
  const { historyApi } = await import('@/api/ergast');
  return historyApi.getDriverHistoryProfile(driverId);
}

async function getConstructorHistoryProfile(constructorId: string): Promise<ConstructorHistoryProfile | null> {
  const summaryProfile = await getConstructorSummaryProfile(constructorId);
  if (summaryProfile) {
    return summaryProfile;
  }

  // Slow fallback: only load the heavy cross-season API path when the summary row is missing.
  const { historyApi } = await import('@/api/ergast');
  return historyApi.getConstructorHistoryProfile(constructorId);
}

export const historyProfilesApi = {
  getDriverSummaryProfile,
  getConstructorSummaryProfile,
  getDriverHistoryProfile,
  getConstructorHistoryProfile,
};
