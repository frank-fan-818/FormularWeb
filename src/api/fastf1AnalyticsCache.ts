import type { FastF1RaceAnalytics } from '@/types';

export const analyticsCache = new Map<string, { expiresAt: number; data: FastF1RaceAnalytics | null }>();
export const analyticsRequests = new Map<string, Promise<FastF1RaceAnalytics | null>>();
export let cacheGeneration = 0;

export function clearFastF1AnalyticsCache(): void {
  cacheGeneration += 1;
  analyticsCache.clear();
  analyticsRequests.clear();
}
