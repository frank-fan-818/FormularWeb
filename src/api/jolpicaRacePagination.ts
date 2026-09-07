type RaceRecord = Record<string, unknown>;
interface RacePage {
  MRData?: { total?: string; limit?: string; offset?: string; RaceTable?: { Races?: RaceRecord[] } };
}

// Limits apply to result rows, so a race can straddle two pages.
export async function fetchPaginatedRaceTable(
  endpoint: string,
  fetchPage: (endpoint: string) => Promise<RacePage>,
): Promise<RaceRecord[]> {
  const url = new URL(endpoint, 'https://api.jolpi.ca');
  const races = new Map<string, RaceRecord>();
  let offset = 0;
  while (true) {
    url.searchParams.set('offset', String(offset));
    const { MRData: page } = await fetchPage(`${url.pathname}${url.search}`);
    const total = Number(page?.total);
    const limit = Number(page?.limit);
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(limit) || limit <= 0
      || Number(page?.offset) !== offset) throw new Error('Invalid Jolpica pagination metadata');
    const entries = page?.RaceTable?.Races || [];
    if (!entries.length && offset < total) throw new Error('Jolpica returned an incomplete page');
    for (const entry of entries) {
      const key = `${entry.season}-${entry.round}`;
      const previous = races.get(key);
      const merged = { ...previous, ...entry };
      for (const field of ['Results', 'QualifyingResults', 'SprintResults', 'SprintQualifyingResults']) {
        if (previous && Array.isArray(previous[field]) && Array.isArray(entry[field])) {
          merged[field] = [...previous[field], ...entry[field]];
        }
      }
      races.set(key, merged);
    }
    offset += limit;
    if (offset >= total) return [...races.values()];
  }
}
