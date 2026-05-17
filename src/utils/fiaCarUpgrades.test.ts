import { describe, expect, it } from 'vitest';
import {
  getUpgradeComponentImportance,
  parseFiaCarPresentationText,
  summarizeFiaCarUpgrades,
} from './fiaCarUpgrades';

describe('FIA car upgrade parsing', () => {
  it('parses team blocks from extracted FIA text', () => {
    const parsed = parseFiaCarPresentationText(
      `
      Car Presentation Submissions

      McLaren
      Car number: 4, 81
      Primary reason: Performance
      Area: Floor
      Geometric differences: revised floor edge geometry.
      Description: new floor fences to improve load.

      Ferrari
      Car number: 16
      Primary reason: Circuit specific
      Area: Rear Wing
      Description: lower downforce rear wing for the circuit.
      `,
      { season: 2026, round: 6, grandPrix: 'Miami Grand Prix', documentUrl: 'https://www.fia.com/example.pdf' },
    );

    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toMatchObject({
      team: 'McLaren',
      carNumber: '4, 81',
      primaryReason: 'Performance',
      component: 'Floor',
      componentImportance: 5,
    });
    expect(parsed.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          team: 'Ferrari',
          declaredUpgradeIntensity: 4,
          circuitSpecificIntent: 1,
        }),
      ]),
    );
  });

  it('parses pipe-delimited rows from manually exported tables', () => {
    const parsed = parseFiaCarPresentationText(
      'Mercedes | 63, 12 | Reliability | Cooling | revised cooling louvres',
      { season: 2026, round: 7 },
    );

    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      team: 'Mercedes',
      primaryReason: 'Reliability',
      component: 'Cooling',
      componentImportance: 2,
    });
  });

  it('splits numbered FIA team tables into component-level records', () => {
    const parsed = parseFiaCarPresentationText(
      `
      McLaren
      Updated component
      Primary reason for update
      1 Front Corner Performance - Flow Conditioning Revised front corner furniture
      The front corner furniture has been revised.
      2 Cooling Louvres Circuit specific - Cooling Range Sidepod Louvre
      A sidepod louvre option is available.
      3 Floor Body Performance - Local Load New floor geometry
      A completely new floor geometry.
      `,
      { season: 2026, round: 6, grandPrix: 'Miami Grand Prix' },
    );

    expect(parsed.records).toHaveLength(3);
    expect(parsed.records.map((record) => record.area)).toEqual([
      'Front Corner',
      'Cooling Louvres',
      'Floor Body',
    ]);
    expect(parsed.summaries[0]).toMatchObject({
      team: 'McLaren',
      declaredUpgradeCount: 3,
    });
    expect(parsed.summaries[0].declaredUpgradeIntensity).toBeGreaterThan(3);
  });

  it('summarizes intensity by team and event', () => {
    const parsed = parseFiaCarPresentationText(
      `
      Williams
      Primary reason: Performance
      Area: Front wing
      Description: revised front wing flap.

      Williams
      Primary reason: Cooling
      Area: Cooling
      Description: extra cooling outlet.
      `,
      { season: 2026, round: 8 },
    );

    expect(summarizeFiaCarUpgrades(parsed.records)[0]).toMatchObject({
      team: 'Williams',
      declaredUpgradeCount: 2,
      declaredUpgradeIntensity: 6,
      performanceIntent: 0.5,
      coolingIntent: 0.5,
    });
  });

  it('uses higher weights for floor upgrades than minor aero pieces', () => {
    expect(getUpgradeComponentImportance('Floor', 'new edge wing')).toBeGreaterThan(
      getUpgradeComponentImportance('Mirror', 'small mirror stay update'),
    );
  });
});
