type RaceScheduleLike = {
  date: string;
  time?: string;
};

function toRaceStartTimestamp(race: RaceScheduleLike): number | null {
  if (!race.date) {
    return null;
  }

  const time = race.time && race.time.trim() ? race.time.trim() : '23:59:59Z';
  const normalizedTime = time.endsWith('Z') ? time : `${time}Z`;
  const timestamp = Date.parse(`${race.date}T${normalizedTime}`);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isSeasonComplete(races: RaceScheduleLike[], now = Date.now()): boolean {
  if (races.length === 0) {
    return false;
  }

  return races.every((race) => {
    const timestamp = toRaceStartTimestamp(race);
    return timestamp !== null && timestamp <= now;
  });
}
