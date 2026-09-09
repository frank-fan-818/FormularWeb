import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFiaRaceUpgradeSummary, fiaCarUpgradesApi } from '@/api/fiaCarUpgrades';
import type { FiaCarUpgradeRecord, FiaCarUpgradeSummary } from '@/utils/fiaCarUpgrades';

const database = vi.hoisted(() => ({ error: null as Error | null, rows: [] as unknown[], pending: false,
  published: null as Record<string, unknown> | null }));
vi.mock('@/utils/supabase', () => ({
  supabase: { from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, order: () => query, maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => database.pending
        ? new Promise(() => {})
        : Promise.resolve({ data: table === 'fia_race_upgrade_snapshots' ? database.published
          : table === 'fia_car_upgrades' ? database.rows : [], error: database.error }).then(resolve),
    };
    return query;
  } },
}));

describe('FIA published snapshot fallback', () => {
  beforeEach(() => { database.error = null; database.rows = []; database.pending = false; database.published = null; });

  it('uses the atomic automatic publication ahead of older static data, including zero upgrades', async () => {
    database.published = { artifact: { season: 2026, round: 13, grandPrix: 'Italian Grand Prix',
      documentUrl: 'https://www.fia.com/revised.pdf', generatedAt: '2026-09-04T12:00:00Z', source: 'FIA',
      records: [], summaries: [] } };
    const summary = await fiaCarUpgradesApi.getRaceUpgrades(2026, 13);
    expect(summary?.totalDeclaredUpgradeCount).toBe(0);
    expect(summary?.sourceDocuments[0].url).toBe('https://www.fia.com/revised.pdf');
  });

  it('keeps database results as the primary source for earlier races', async () => {
    database.rows = [{ season: 2026, round: 4, team: 'Ferrari', component: 'Floor',
      component_importance: 5, primary_reason: 'Performance' }];
    const summary = await fiaCarUpgradesApi.getRaceUpgrades(2026, 4);
    expect(summary?.teams[0].componentNames).toEqual(['Floor']);
    expect(summary?.totalDeclaredUpgradeCount).toBe(1);
  });

  it('falls back before the UI deadline when the database never settles', async () => {
    vi.useFakeTimers();
    try {
      database.pending = true;
      const request = fiaCarUpgradesApi.getRaceUpgrades(2026, 13);
      await vi.advanceTimersByTimeAsync(5_000);
      expect((await request)?.totalDeclaredUpgradeCount).toBe(26);
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads the official Italian snapshot when the database has no rows', async () => {
    const summary = await fiaCarUpgradesApi.getRaceUpgrades(2026, 13);
    expect(summary?.totalDeclaredUpgradeCount).toBe(26);
    expect(summary?.teams.map(({ team }) => team)).toContain('Cadillac');
    expect(summary?.teams.map(({ team }) => team)).not.toContain('Audi');
    expect(summary?.sourceDocuments[0].url).toContain('fia.com/');
  });

  it('uses the snapshot when database access fails', async () => {
    database.error = new Error('Database offline');
    expect((await fiaCarUpgradesApi.getRaceUpgrades(2026, 13))?.teams.length).toBe(10);
  });

  it('does not substitute another race for an uncovered round', async () => {
    expect(await fiaCarUpgradesApi.getRaceUpgrades(2026, 99)).toBeNull();
  });

  it('preserves a request error when neither source has data', async () => {
    database.error = new Error('Database offline');
    await expect(fiaCarUpgradesApi.getRaceUpgrades(2026, 99)).rejects.toThrow('Database offline');
  });
});

const baseRecord = {
  season: 2026,
  round: 4,
  grandPrix: 'Miami Grand Prix',
  sourceType: 'FIA',
  primaryReason: 'Performance',
  confidence: 0.9,
  componentImportance: 1,
  rawText: 'raw',
} satisfies Omit<FiaCarUpgradeRecord, 'team'>;

describe('FIA car upgrade frontend summaries', () => {
  it('builds a race upgrade summary ordered by declared intensity', () => {
    const summary = buildFiaRaceUpgradeSummary({
      generatedAt: '2026-05-17T00:00:00.000Z',
      source: 'FIA Car Presentation Submissions',
      records: [
        {
          ...baseRecord,
          team: 'McLaren',
          component: 'Floor',
          componentImportance: 5,
          documentTitle: 'Doc 8',
          documentUrl: 'https://example.test/doc.pdf',
        },
        {
          ...baseRecord,
          team: 'Ferrari',
          component: 'Front wing',
          componentImportance: 4,
        },
      ],
      summaries: [
        {
          season: 2026,
          round: 4,
          grandPrix: 'Miami Grand Prix',
          team: 'Ferrari',
          declaredUpgradeCount: 1,
          declaredUpgradeIntensity: 4,
          performanceIntent: 1,
          circuitSpecificIntent: 0,
          reliabilityIntent: 0,
          coolingIntent: 0,
          maxComponentImportance: 4,
        },
        {
          season: 2026,
          round: 4,
          grandPrix: 'Miami Grand Prix',
          team: 'McLaren',
          declaredUpgradeCount: 2,
          declaredUpgradeIntensity: 10,
          performanceIntent: 0.5,
          circuitSpecificIntent: 0.5,
          reliabilityIntent: 0,
          coolingIntent: 0,
          maxComponentImportance: 5,
        },
      ] satisfies FiaCarUpgradeSummary[],
    }, 2026, '4');

    expect(summary).toMatchObject({
      totalDeclaredUpgradeCount: 3,
      totalDeclaredUpgradeIntensity: 14,
    });
    expect(summary?.teams.map((team) => team.team)).toEqual(['McLaren', 'Ferrari']);
    expect(summary?.teams[0].componentNames).toEqual(['Floor']);
    expect(summary?.sourceDocuments).toEqual([{ title: 'Doc 8', url: 'https://example.test/doc.pdf' }]);
  });

  it('returns null when no race upgrade data is available', () => {
    expect(buildFiaRaceUpgradeSummary({
      generatedAt: '2026-05-17T00:00:00.000Z',
      source: 'FIA Car Presentation Submissions',
      records: [],
      summaries: [],
    }, 2026, 99)).toBeNull();
  });
});
