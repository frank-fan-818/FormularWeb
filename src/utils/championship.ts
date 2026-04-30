type ChampionshipSeasonLike = {
  season: string;
  position: string;
};

export function isChampionStanding(season: ChampionshipSeasonLike): boolean {
  return season.position === '1';
}

export function canCountChampionshipSeason(
  season: ChampionshipSeasonLike,
  latestSeason: ChampionshipSeasonLike | null | undefined,
  isLatestSeasonComplete: boolean,
): boolean {
  if (!isChampionStanding(season)) {
    return false;
  }

  return season.season !== latestSeason?.season || isLatestSeasonComplete;
}

export function getCountableChampionshipSeasons<T extends ChampionshipSeasonLike>(
  seasons: T[],
  latestSeason: ChampionshipSeasonLike | null | undefined,
  isLatestSeasonComplete: boolean,
): T[] {
  return seasons.filter((season) => canCountChampionshipSeason(
    season,
    latestSeason,
    isLatestSeasonComplete,
  ));
}
