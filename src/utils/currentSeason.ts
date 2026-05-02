const FIRST_SUPPORTED_LIVE_SEASON = 2025;
const ACTIVE_SEASON_CACHE_DURATION_MS = 60 * 1000;
const HISTORICAL_SEASON_CACHE_DURATION_MS = 60 * 60 * 1000;

export function getDefaultCurrentSeason(now = new Date()): string {
  return String(Math.max(FIRST_SUPPORTED_LIVE_SEASON, now.getFullYear()));
}

export function isActiveSeason(season: string | number, now = new Date()): boolean {
  return String(season) === getDefaultCurrentSeason(now);
}

export function getSeasonCacheDuration(season: string | number, now = new Date()): number {
  return isActiveSeason(season, now)
    ? ACTIVE_SEASON_CACHE_DURATION_MS
    : HISTORICAL_SEASON_CACHE_DURATION_MS;
}
