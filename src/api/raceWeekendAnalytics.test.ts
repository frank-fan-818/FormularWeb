import { describe, expect, it } from 'vitest';
import {
  buildDriverTelemetrySummary,
  buildInterruptionProbabilities,
  buildInterruptionSamples,
  buildRacePreviewSummary,
} from '@/api/raceWeekendAnalytics';

describe('race weekend analytics', () => {
  it('builds recent circuit results with winners, poles, podiums, and pole conversion', () => {
    const summary = buildRacePreviewSummary({
      season: 2026,
      round: 19,
      circuitId: 'austin',
      races: [
        { id: 1, season: 2025, round: 19, race_name: 'United States Grand Prix', circuit_id: 'austin', date: '2025-10-19' },
        { id: 2, season: 2024, round: 19, race_name: 'United States Grand Prix', circuit_id: 'austin', date: '2024-10-20' },
      ],
      raceResults: [
        { race_id: 1, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1 },
        { race_id: 1, driver_id: 'lando_norris', constructor_id: 'mclaren', position: 2 },
        { race_id: 1, driver_id: 'charles_leclerc', constructor_id: 'ferrari', position: 3 },
        { race_id: 2, driver_id: 'charles_leclerc', constructor_id: 'ferrari', position: 1 },
      ],
      qualifyingResults: [
        { race_id: 1, driver_id: 'max_verstappen', constructor_id: 'red_bull', position: 1 },
        { race_id: 2, driver_id: 'lando_norris', constructor_id: 'mclaren', position: 1 },
      ],
      drivers: [
        { driver_id: 'max_verstappen', first_name: 'Max', last_name: 'Verstappen' },
        { driver_id: 'lando_norris', first_name: 'Lando', last_name: 'Norris' },
        { driver_id: 'charles_leclerc', first_name: 'Charles', last_name: 'Leclerc' },
      ],
      constructors: [
        { constructor_id: 'red_bull', name: 'Red Bull Racing' },
        { constructor_id: 'mclaren', name: 'McLaren' },
        { constructor_id: 'ferrari', name: 'Ferrari' },
      ],
      analyticsRows: [
        { season: 2026, round: 19, payload: { eventName: 'United States Grand Prix', trackStatusPeriods: [{ type: 'SC' }] } as never },
        { season: 2025, round: 19, payload: { eventName: 'United States Grand Prix', trackStatusPeriods: [] } as never },
      ],
    });

    expect(summary.recentResults).toHaveLength(2);
    expect(summary.recentResults[0]).toMatchObject({
      winnerName: 'Max Verstappen',
      poleName: 'Max Verstappen',
      winnerConstructorName: 'Red Bull Racing',
    });
    expect(summary.recentResults[0].podium.map((driver) => driver.driverName)).toEqual([
      'Max Verstappen',
      'Lando Norris',
      'Charles Leclerc',
    ]);
    expect(summary.poleWinConversionPct).toBe(50);
    expect(summary.interruptionProbabilities.find((item) => item.type === 'SC')).toMatchObject({
      sampleSize: 2,
      triggeredCount: 1,
    });
    expect(summary.interruptionSamples.map((sample) => sample.season)).toEqual([2026, 2025]);
  });

  it('marks interruption probabilities as insufficient when FastF1 samples are missing', () => {
    const probabilities = buildInterruptionProbabilities([]);

    expect(probabilities.find((item) => item.type === 'SC')).toMatchObject({
      sampleSize: 0,
      probabilityPct: null,
      status: 'insufficient-data',
    });
  });

  it('calculates interruption probabilities from track status periods', () => {
    const probabilities = buildInterruptionProbabilities([
      { payload: { trackStatusPeriods: [{ type: 'SC' }, { type: 'VSC' }] } as never },
      { payload: { trackStatusPeriods: [{ type: 'YELLOW' }] } as never },
    ]);

    expect(probabilities.find((item) => item.type === 'SC')?.probabilityPct).toBe(50);
    expect(probabilities.find((item) => item.type === 'VSC')?.probabilityPct).toBe(50);
    expect(probabilities.find((item) => item.type === 'YELLOW')?.probabilityPct).toBe(50);
  });

  it('builds visible interruption sample rows by season', () => {
    const samples = buildInterruptionSamples([
      { season: 2024, round: 6, payload: { eventName: 'Miami Grand Prix', trackStatusPeriods: [{ type: 'SC' }, { type: 'YELLOW' }] } as never },
      { season: 2023, round: 5, payload: { eventName: 'Miami Grand Prix', trackStatusPeriods: [] } as never },
      { season: 2025, round: 6, payload: { eventName: 'Miami Grand Prix', trackStatusPeriods: [{ type: 'VSC' }] } as never },
    ]);

    expect(samples.map((sample) => sample.season)).toEqual([2025, 2024, 2023]);
    expect(samples[0]).toMatchObject({
      round: 6,
      raceName: 'Miami Grand Prix',
      statusTypes: ['VSC'],
      statusLabels: ['Virtual Safety Car'],
    });
    expect(samples[2].statusLabels).toEqual([]);
  });

  it('builds telemetry summaries and tolerates empty samples', () => {
    expect(buildDriverTelemetrySummary({
      driver: 'VER',
      team: 'Red Bull Racing',
      lapNumber: 12,
      lapTimeSeconds: 91.123,
      compound: 'MEDIUM',
      samples: [
        { distanceM: 0, timeSeconds: 0, speedKph: 120, rpm: 10000, gear: 3, throttlePct: 100, brake: false, drs: 12 },
        { distanceM: 100, timeSeconds: 4, speedKph: 300, rpm: 12000, gear: 8, throttlePct: 80, brake: true, drs: 0 },
        { distanceM: 200, timeSeconds: 8, speedKph: null, rpm: null, gear: null, throttlePct: null, brake: false, drs: null },
      ],
      positionSamples: [],
    })).toMatchObject({
      maxSpeedKph: 300,
      avgSpeedKph: 210,
      fullThrottlePct: 50,
      avgThrottlePct: 90,
      brakePct: 33.3,
      drsPct: 33.3,
    });

    expect(buildDriverTelemetrySummary({
      driver: 'NOR',
      team: 'McLaren',
      lapNumber: null,
      lapTimeSeconds: null,
      compound: 'UNKNOWN',
      samples: [],
      positionSamples: [],
    })).toMatchObject({
      maxSpeedKph: null,
      avgSpeedKph: null,
      fullThrottlePct: null,
      avgThrottlePct: null,
      brakePct: null,
      drsPct: null,
    });
  });
});
