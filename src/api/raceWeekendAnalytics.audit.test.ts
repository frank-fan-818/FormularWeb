import { describe, expect, it } from 'vitest';
import { buildRacePreviewSummary } from './raceWeekendAnalytics';
import { circuitHistoryEditions } from './__fixtures__/circuitHistoryEditions';

describe('circuit history edition audit', () => {
  it.each(circuitHistoryEditions)('$circuitId before $season keeps only completed prior editions', ({ circuitId, season, editions }) => {
    const completed = [...editions, [season, 1], [season + 1, 1]].map(([year, round], index) => ({
      id: index + 1, season: year, round, circuit_id: circuitId,
      race_name: 'Grand Prix', date: `${year}-09-01`,
    }));
    const missingResult = {
      id: 999, season: season - 1, round: 99, circuit_id: circuitId,
      race_name: 'Uncompleted Grand Prix', date: `${season - 1}-12-01`,
    };
    const results = completed.map(race => ({
      race_id: race.id, driver_id: `winner_${race.id}`, constructor_id: 'team', position: 1,
    }));
    const summary = buildRacePreviewSummary({
      season, round: 20, circuitId,
      races: [missingResult, ...completed].reverse(),
      raceResults: results,
      qualifyingResults: [...results, { race_id: 999, driver_id: 'pole_only', constructor_id: 'team', position: 1 }],
      analyticsRows: completed.map(race => ({
        season: race.season, round: race.round,
        payload: { eventName: race.race_name, trackStatusPeriods: race.season >= season ? [{ type: 'SC' }] : [] } as never,
      })),
    });

    expect(summary.recentResults.map(race => [race.season, race.round])).toEqual(editions);
    expect(summary.sampleSize).toBe(editions.length);
    expect(summary.recentResults.every(race => Boolean(race.winnerDriverId))).toBe(true);
    expect(summary.poleWinConversionPct).toBe(editions.length ? 100 : null);
    expect(summary.interruptionSamples.every(sample => sample.season < season)).toBe(true);
    expect(summary.interruptionProbabilities.find(item => item.type === 'SC')).toMatchObject({
      sampleSize: editions.length, triggeredCount: 0,
    });
  });
});
