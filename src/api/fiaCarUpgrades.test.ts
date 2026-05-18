import { describe, expect, it } from 'vitest';
import { buildFiaRaceUpgradeSummary } from '@/api/fiaCarUpgrades';
import type { FiaCarUpgradeRecord, FiaCarUpgradeSummary } from '@/utils/fiaCarUpgrades';

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
