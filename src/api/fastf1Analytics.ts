import type { FastF1RaceAnalytics } from '@/types';

const PUBLIC_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function buildAnalyticsUrl(season: string, round: string, session: string) {
  return `${PUBLIC_BASE}/fastf1/${season}/${round}/${session}.json`;
}

export const fastF1AnalyticsApi = {
  async getRaceAnalytics(
    season: string,
    round: string,
    session = 'R',
    signal?: AbortSignal,
  ): Promise<FastF1RaceAnalytics | null> {
    const response = await fetch(buildAnalyticsUrl(season, round, session), {
      signal,
      cache: 'no-cache',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`FastF1 analytics request failed with ${response.status}`);
    }

    return response.json() as Promise<FastF1RaceAnalytics>;
  },
};
