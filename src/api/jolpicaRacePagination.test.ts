import { describe, expect, it, vi } from 'vitest';
import { fetchPaginatedRaceTable } from './jolpicaRacePagination';

describe('Jolpica race pagination', () => {
  it('follows the actual server limit and merges a race split across pages', async () => {
    const fetchPage = vi.fn(async (endpoint: string) => {
      const offset = Number(new URL(endpoint, 'https://example.com').searchParams.get('offset'));
      return { MRData: { total: '3', limit: '2', offset: String(offset), RaceTable: { Races: [
        { season: '2026', round: '13', QualifyingResults: offset ? [{ position: '3' }] : [{ position: '1' }, { position: '2' }] },
      ] } } };
    });
    const result = await fetchPaginatedRaceTable('/2026/qualifying.json?limit=2000', fetchPage);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
    expect(result[0].QualifyingResults).toHaveLength(3);
    expect(fetchPage.mock.calls[1][0]).toContain('offset=2');
  });

  it('rejects missing rows rather than returning a partial prediction field', async () => {
    await expect(fetchPaginatedRaceTable('/2026.json', async () => ({
      MRData: { total: '22', offset: '0', limit: '100', RaceTable: { Races: [] } },
    }))).rejects.toThrow('incomplete page');
  });
});
