const FIRST_FORMULA_ONE_SEASON = 1950;
const MAX_SUPPORTED_SEASON = 2100;

export function getRaceSeasonFromSearch(search: string, fallbackSeason: string): string {
  const requestedSeason = new URLSearchParams(search).get('season');
  if (!requestedSeason || !/^\d{4}$/.test(requestedSeason)) return fallbackSeason;

  const numericSeason = Number(requestedSeason);
  return numericSeason >= FIRST_FORMULA_ONE_SEASON && numericSeason <= MAX_SUPPORTED_SEASON
    ? requestedSeason
    : fallbackSeason;
}

export function buildRaceSeasonLocation(
  pathname: string,
  search: string,
  nextSeason: string,
): string | null {
  const supportedSeason = getRaceSeasonFromSearch(
    `?season=${encodeURIComponent(nextSeason)}`,
    '',
  );
  if (!supportedSeason) return null;

  const searchParams = new URLSearchParams(search);
  searchParams.set('season', supportedSeason);
  return `${pathname}?${searchParams.toString()}`;
}
