/**
 * Tests for src/utils/winnerFeatureBuilder.ts
 */
import { describe, it, expect } from 'vitest';
import {
  normalizePosition,
  normalizeRate,
  normalizeLinear,
  normalizeAdvantage,
  buildQualifyingFeatures,
  buildPracticeFeatures,
  buildStandingsFeatures,
  buildCircuitCharacteristicsFeatures,
  buildCircuitHistoryFeatures,
  buildSprintFeatures,
  buildRoundProgressFeature,
  buildSequenceFeatures,
  buildWeatherFeatures,
  buildWinnerFeatureVector,
  buildWinnerCandidates,
  getAvailableFeatureGroups,
  type QualifyingInput,
  type PracticeInput,
  type StandingInput,
  type DriverRecentForm,
  type ConstructorRecentForm,
  type CircuitHistoryInput,
  type WinnerFeatureInput,
} from '@/utils/winnerFeatureBuilder';
import { WINNER_PREDICTION_FEATURES } from '@/utils/raceWinnerPrediction';

// ============================================================================
// Normalization Helpers
// ============================================================================

describe('normalizePosition', () => {
  it('maps 1st to +1', () => {
    expect(normalizePosition(1, 20)).toBeCloseTo(1);
  });

  it('maps last to -1', () => {
    expect(normalizePosition(20, 20)).toBeCloseTo(-1);
  });

  it('maps midfield to 0', () => {
    const mid = normalizePosition(11, 20);
    expect(mid).toBeGreaterThan(-0.1);
    expect(mid).toBeLessThan(0.1);
  });

  it('returns 0 for single entry', () => {
    expect(normalizePosition(1, 1)).toBe(0);
  });
});

describe('normalizeRate', () => {
  it('maps 1.0 to +1', () => {
    expect(normalizeRate(1, 0.5)).toBeCloseTo(1);
  });

  it('maps 0.0 to -1', () => {
    expect(normalizeRate(0, 0.5)).toBeCloseTo(-1);
  });

  it('maps neutral to 0', () => {
    expect(normalizeRate(0.5, 0.5)).toBeCloseTo(0);
  });

  it('handles custom neutral point', () => {
    expect(normalizeRate(0.1, 0.1)).toBeCloseTo(0);
    expect(normalizeRate(0.3, 0.1)).toBeGreaterThan(0);
    expect(normalizeRate(0.05, 0.1)).toBeLessThan(0);
  });
});

describe('normalizeLinear', () => {
  it('maps min to -1, max to +1', () => {
    expect(normalizeLinear(0, 0, 100)).toBeCloseTo(-1);
    expect(normalizeLinear(100, 0, 100)).toBeCloseTo(1);
    expect(normalizeLinear(50, 0, 100)).toBeCloseTo(0);
  });

  it('clamps out-of-range values', () => {
    expect(normalizeLinear(200, 0, 100)).toBe(1);
    expect(normalizeLinear(-50, 0, 100)).toBe(-1);
  });
});

describe('normalizeAdvantage', () => {
  it('returns 0 when all values are identical', () => {
    expect(normalizeAdvantage(5, [5, 5, 5, 5])).toBeCloseTo(0);
  });

  it('returns positive for above-average values', () => {
    const result = normalizeAdvantage(10, [5, 5, 5, 5]);
    expect(result).toBeGreaterThan(0);
  });

  it('returns negative for below-average values', () => {
    const result = normalizeAdvantage(2, [5, 5, 5, 5]);
    expect(result).toBeLessThan(0);
  });

  it('returns 0 for empty field', () => {
    expect(normalizeAdvantage(5, [])).toBe(0);
  });
});

// ============================================================================
// Qualifying Features
// ============================================================================

describe('buildQualifyingFeatures', () => {
  const makeQ = (pos: number): QualifyingInput => ({
    position: pos,
    totalDrivers: 20,
    allPositions: Array.from({ length: 20 }, (_, i) => i + 1),
    q3TimeSeconds: 90 + pos * 0.1,
    allQ3TimesSeconds: Array.from({ length: 10 }, (_, i) => 90 + i * 0.1),
    teamMatePosition: pos === 1 ? 2 : pos === 2 ? 1 : pos + 1,
    teamMateQ3TimeSeconds: 90 + (pos === 1 ? 2 : 1) * 0.15,
  });

  it('pole position gets gridPole=1 and gridAdvantage≈+1', () => {
    const f = buildQualifyingFeatures(makeQ(1));
    expect(f.gridPole).toBe(1);
    expect(f.gridAdvantage).toBeCloseTo(1);
    expect(f.gridFrontRow).toBe(1);
    expect(f.gridTop3).toBe(1);
    expect(f.qualifyingPole).toBe(1);
  });

  it('front row (P2) gets gridFrontRow=1', () => {
    const f = buildQualifyingFeatures(makeQ(2));
    expect(f.gridPole).toBe(0);
    expect(f.gridFrontRow).toBe(1);
    expect(f.gridTop3).toBe(1);
  });

  it('P3 gets gridTop3=1 but not front row', () => {
    const f = buildQualifyingFeatures(makeQ(3));
    expect(f.gridPole).toBe(0);
    expect(f.gridFrontRow).toBe(0);
    expect(f.gridTop3).toBe(1);
  });

  it('last position gets negative gridAdvantage', () => {
    const f = buildQualifyingFeatures(makeQ(20));
    expect(f.gridPole).toBe(0);
    expect(f.gridAdvantage).toBeCloseTo(-1);
    expect(f.gridTop3).toBe(0);
  });

  it('pole model features are set', () => {
    const f = buildQualifyingFeatures(makeQ(1));
    expect(f.poleModelProbability).toBe(1);
    expect(f.poleModelRankAdvantage).toBeCloseTo(1);
    expect(f.poleModelScore).toBeGreaterThan(0);
  });

  it('midfield position has near-zero model probability', () => {
    const f = buildQualifyingFeatures(makeQ(10));
    expect(f.poleModelProbability).toBeGreaterThan(0);
    expect(f.poleModelProbability).toBeLessThan(0.6);
  });

  it('handles missing Q3 times gracefully', () => {
    const q = { ...makeQ(15), q3TimeSeconds: null, allQ3TimesSeconds: undefined, teamMateQ3TimeSeconds: null };
    const f = buildQualifyingFeatures(q);
    expect(f.qualifyingPaceAdvantage).toBe(0);
    expect(f.qualifyingPaceSharpAdvantage).toBe(0);
    expect(f.teamMateQualifyingAdvantage).toBe(0);
  });
});

// ============================================================================
// Practice Features
// ============================================================================

describe('buildPracticeFeatures', () => {
  const makeP = (bestTime = 90): PracticeInput => ({
    fp1TimeSeconds: bestTime + 0.5,
    fp2TimeSeconds: bestTime,
    fp3TimeSeconds: bestTime + 0.2,
    lapsCompleted: 25,
    allFpBestTimesSeconds: [90, 90.1, 90.2, 90.3, 90.4],
    allFpLapsCounts: [25, 20, 22, 18, 21],
    teamMateBestFpTimeSeconds: bestTime + 0.1,
    constructorBestFpTimeSeconds: bestTime,
  });

  it('driver with best FP time gets positive advantage', () => {
    const f = buildPracticeFeatures(makeP(90));
    expect(f.fpBestAdvantage).toBeGreaterThan(0);
    expect(f.fpBestGapAdvantage).toBeGreaterThanOrEqual(1);
    expect(f.fpConstructorAdvantage).toBeGreaterThanOrEqual(0);
  });

  it('slow driver gets negative FP advantage', () => {
    // Driver's best time (94s) is 4s slower than field best (90s)
    const p: PracticeInput = {
      fp1TimeSeconds: 94.5,
      fp2TimeSeconds: 94,
      fp3TimeSeconds: 94.3,
      lapsCompleted: 20,
      allFpBestTimesSeconds: [90, 90.1, 90.2, 94, 90.4],
      allFpLapsCounts: [25, 20, 22, 18, 21],
    };
    const f = buildPracticeFeatures(p);
    expect(f.fpBestAdvantage).toBeLessThan(0);
  });

  it('returns 0 for missing FP data', () => {
    const f = buildPracticeFeatures({
      fp1TimeSeconds: null,
      fp2TimeSeconds: null,
      fp3TimeSeconds: null,
    });
    expect(f.fp1Advantage).toBe(0);
    expect(f.fp2Advantage).toBe(0);
    expect(f.fp3Advantage).toBe(0);
    expect(f.fpBestAdvantage).toBe(0);
  });

  it('team mate advantage is positive when faster than team mate', () => {
    const f = buildPracticeFeatures(makeP(90));
    // driverBest = 90, mateBest = 90.1 → driver is faster
    expect(f.fpTeamMateAdvantage).toBeGreaterThan(0);
  });
});

// ============================================================================
// Standings Features
// ============================================================================

describe('buildStandingsFeatures', () => {
  const makeStanding = (pos: number, points: number, wins: number): StandingInput => ({
    position: pos,
    points,
    wins,
    totalDrivers: 20,
  });

  it('championship leader gets positive advantage', () => {
    const f = buildStandingsFeatures(makeStanding(1, 300, 8), makeStanding(1, 400, 10));
    expect(f.driverStandingAdvantage).toBeCloseTo(1);
    expect(f.driverSeasonWinRate).toBeGreaterThan(0);
  });

  it('backmarker gets negative advantage', () => {
    const f = buildStandingsFeatures(makeStanding(20, 5, 0), makeStanding(10, 50, 0));
    expect(f.driverStandingAdvantage).toBeCloseTo(-1);
    expect(f.driverSeasonWinRate).toBeLessThan(0);
  });

  it('midfield gets near-zero', () => {
    const f = buildStandingsFeatures(makeStanding(10, 50, 1), makeStanding(5, 100, 2));
    expect(f.driverStandingAdvantage).toBeGreaterThan(-0.2);
    expect(f.driverStandingAdvantage).toBeLessThan(0.2);
  });

  it('constructor standings are independent', () => {
    const f = buildStandingsFeatures(makeStanding(1, 300, 8), makeStanding(5, 150, 2));
    expect(f.driverStandingAdvantage).toBeCloseTo(1);
    expect(f.constructorStandingAdvantage).toBeGreaterThan(0);
  });
});

// ============================================================================
// Circuit Characteristics Features
// ============================================================================

describe('buildCircuitCharacteristicsFeatures', () => {
  it('street circuit returns 1', () => {
    const f = buildCircuitCharacteristicsFeatures({
      isStreetCircuit: true,
      overtakeDifficulty: 0.8,
      tyreStress: 0.6,
      restartRisk: 0.3,
      qualifyingImportance: 0.9,
    });
    expect(f.circuitStreetTrack).toBe(1);
    expect(f.circuitLowOvertake).toBe(1);
    expect(f.circuitQualifyingImportance).toBeGreaterThan(0);
  });

  it('non-street, easy overtake circuit returns -1 for those features', () => {
    const f = buildCircuitCharacteristicsFeatures({
      isStreetCircuit: false,
      overtakeDifficulty: 0.2,
      tyreStress: 0.3,
      restartRisk: 0.1,
      qualifyingImportance: 0.3,
    });
    expect(f.circuitStreetTrack).toBe(0);
    expect(f.circuitLowOvertake).toBe(-1);
    expect(f.circuitQualifyingImportance).toBeLessThan(0);
  });
});

// ============================================================================
// Circuit History Features
// ============================================================================

describe('buildCircuitHistoryFeatures', () => {
  const makeHistory = (overrides: Partial<CircuitHistoryInput> = {}): CircuitHistoryInput => ({
    driverWinCount: 2,
    driverPodiumCount: 5,
    driverTotalRaces: 10,
    constructorWinCount: 4,
    constructorTotalRaces: 10,
    poleWinConversionPct: 40,
    top3GridWinPct: 30,
    scRate: 0.4,
    vscRate: 0.15,
    redFlagRate: 0.05,
    overtakeUpsetRate: 0.2,
    totalSamples: 20,
    ...overrides,
  });

  it('driver with wins at circuit gets positive rates', () => {
    const f = buildCircuitHistoryFeatures(makeHistory());
    expect(f.sameCircuitDriverWinRate).toBeGreaterThan(0);
    expect(f.sameCircuitDriverPodiumRate).toBeGreaterThan(0);
    expect(f.sameCircuitConstructorWinRate).toBeGreaterThan(0);
  });

  it('zero races at circuit returns 0 for all features', () => {
    const f = buildCircuitHistoryFeatures(makeHistory({
      driverTotalRaces: 0,
      constructorTotalRaces: 0,
      driverWinCount: 0,
      driverPodiumCount: 0,
      constructorWinCount: 0,
    }));
    expect(f.sameCircuitDriverWinRate).toBe(0);
    expect(f.sameCircuitDriverPodiumRate).toBe(0);
    expect(f.sameCircuitConstructorWinRate).toBe(0);
  });
});

// ============================================================================
// Sprint Features
// ============================================================================

describe('buildSprintFeatures', () => {
  it('non-sprint weekend returns 0 for all sprint features', () => {
    const f = buildSprintFeatures({ isSprintWeekend: false });
    expect(f.sprintWeekend).toBe(0);
    expect(f.sprintFinishAdvantage).toBe(0);
    expect(f.sprintQualifyingAdvantage).toBe(0);
  });

  it('sprint winner gets positive advantage', () => {
    const f = buildSprintFeatures({
      isSprintWeekend: true,
      sprintPosition: 1,
      sprintQualifyingPosition: 1,
      totalSprintDrivers: 20,
    });
    expect(f.sprintWeekend).toBe(1);
    expect(f.sprintFinishAdvantage).toBeCloseTo(1);
    expect(f.sprintQualifyingAdvantage).toBeCloseTo(1);
  });

  it('last sprint finish gets negative advantage', () => {
    const f = buildSprintFeatures({
      isSprintWeekend: true,
      sprintPosition: 20,
      sprintQualifyingPosition: 15,
      totalSprintDrivers: 20,
    });
    expect(f.sprintWeekend).toBe(1);
    expect(f.sprintFinishAdvantage).toBeCloseTo(-1);
    expect(f.sprintQualifyingAdvantage).toBeLessThan(0);
  });
});

// ============================================================================
// Round Progress Feature
// ============================================================================

describe('buildRoundProgressFeature', () => {
  it('round 1 returns -1 (early season)', () => {
    const f = buildRoundProgressFeature(1, 24);
    expect(f.raceRoundProgress).toBeCloseTo(-1);
  });

  it('round 24 returns +1 (late season)', () => {
    const f = buildRoundProgressFeature(24, 24);
    expect(f.raceRoundProgress).toBeCloseTo(1);
  });

  it('mid-season returns near 0', () => {
    const f = buildRoundProgressFeature(12, 24);
    expect(f.raceRoundProgress).toBeGreaterThan(-0.1);
    expect(f.raceRoundProgress).toBeLessThan(0.1);
  });
});

// ============================================================================
// Sequence / Momentum Features
// ============================================================================

describe('buildSequenceFeatures', () => {
  const makeDriverForm = (): DriverRecentForm => ({
    last10Steps: [{
      finishAdvantage: 0.7,
      qualifyingAdvantage: 0.6,
      podium: 1,
      win: 0,
      reliability: 1,
    }],
    finishPositions: [2, 1, 3, 5, 1, 4, 2, 1, 2, 3],
    qualifyingPositions: [1, 2, 1, 3, 2, 1, 2, 1, 1, 2],
    winCount: 3,
    podiumCount: 8,
    raceCount: 10,
    dnfCount: 0,
    totalLapsCompleted: 550,
    totalLapsPossible: 560,
  });

  const makeConstructorForm = (): ConstructorRecentForm => ({
    last10Steps: [{
      finishAdvantage: 0.6,
      qualifyingAdvantage: 0.5,
      podium: 1,
      win: 1,
      reliability: 1,
    }],
    finishPositions: [1, 2, 1, 3],
    winCount: 2,
    podiumCount: 4,
    raceCount: 4,
  });

  it('returns driver momentum features', () => {
    const seq = { momentum: 0.7, consistency: 0.6, upside: 0.5 };
    const f = buildSequenceFeatures(seq, makeDriverForm(), makeConstructorForm());
    expect(f.driverSequenceMomentum).toBeGreaterThan(0);
    expect(f.driverSequenceConsistency).toBeGreaterThan(0);
    expect(f.driverSequenceUpside).toBeCloseTo(0);
  });

  it('returns driver win/podium rates', () => {
    const seq = { momentum: 0.5, consistency: 0.5, upside: 0.5 };
    const f = buildSequenceFeatures(seq, makeDriverForm(), makeConstructorForm());
    expect(f.driverRecentWinRate).toBeGreaterThan(0);
    expect(f.driverRecentPodiumRate).toBeGreaterThan(0);
  });

  it('returns constructor sequence features', () => {
    const seq = { momentum: 0.5, consistency: 0.5, upside: 0.5 };
    const f = buildSequenceFeatures(seq, makeDriverForm(), makeConstructorForm());
    expect(f.constructorSequenceMomentum).toBeDefined();
    expect(f.constructorRecentWinRate).toBeDefined();
  });

  it('0-win recent form gets negative win rates', () => {
    const seq = { momentum: 0.3, consistency: 0.4, upside: 0.3 };
    const form: DriverRecentForm = {
      last10Steps: [{ finishAdvantage: 0.3, qualifyingAdvantage: 0.3, podium: 0, win: 0, reliability: 1 }],
      finishPositions: [10, 12, 8, 15, 11],
      qualifyingPositions: [8, 10, 7, 12, 9],
      winCount: 0,
      podiumCount: 0,
      raceCount: 10,
      dnfCount: 1,
      totalLapsCompleted: 500,
      totalLapsPossible: 560,
    };
    const f = buildSequenceFeatures(seq, form, makeConstructorForm());
    expect(f.driverRecentWinRate).toBeLessThan(0);
    expect(f.driverRecentPodiumRate).toBeLessThan(0);
  });
});

// ============================================================================
// Weather Features
// ============================================================================

describe('buildWeatherFeatures', () => {
  it('rain risk above neutral returns positive', () => {
    const f = buildWeatherFeatures({ rainRisk: 0.8, airTempC: 25, trackTempC: 35, humidityPct: 60, windSpeedMps: 5 });
    expect(f.weatherRainRisk).toBeGreaterThan(0);
  });

  it('cool track returns positive', () => {
    const f = buildWeatherFeatures({ rainRisk: 0, airTempC: 18, trackTempC: 20, humidityPct: 40, windSpeedMps: 2 });
    expect(f.weatherCoolTrack).toBe(1);
    expect(f.weatherHotTrack).toBe(-1);
  });

  it('hot track returns positive', () => {
    const f = buildWeatherFeatures({ rainRisk: 0, airTempC: 30, trackTempC: 42, humidityPct: 30, windSpeedMps: 3 });
    expect(f.weatherHotTrack).toBe(1);
    expect(f.weatherCoolTrack).toBe(-1);
  });

  it('returns empty for undefined input', () => {
    const f = buildWeatherFeatures();
    // All should be 0 (undefined in the partial, which means 0 when merged)
    expect(Object.values(f).length).toBe(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('buildWinnerFeatureVector', () => {
  const makeFullInput = (overrides: Partial<WinnerFeatureInput> = {}): WinnerFeatureInput => ({
    season: 2024,
    round: 10,
    circuitId: 'silverstone',
    driverId: 'max_verstappen',
    constructorId: 'red_bull',
    qualifying: {
      position: 1,
      totalDrivers: 20,
      allPositions: Array.from({ length: 20 }, (_, i) => i + 1),
      allQ3TimesSeconds: Array.from({ length: 10 }, (_, i) => 90 + i * 0.1),
      q3TimeSeconds: 90,
      teamMatePosition: 3,
      teamMateQ3TimeSeconds: 90.3,
    },
    practice: {
      fp1TimeSeconds: 89.5,
      fp2TimeSeconds: 89.2,
      fp3TimeSeconds: 89.4,
      lapsCompleted: 25,
      allFpBestTimesSeconds: [89.2, 89.3, 89.5, 89.6, 89.8],
      allFpLapsCounts: [25, 20, 22, 18, 21],
      teamMateBestFpTimeSeconds: 89.3,
      constructorBestFpTimeSeconds: 89.2,
    },
    driverStanding: { position: 1, points: 255, wins: 7, totalDrivers: 20 },
    constructorStanding: { position: 1, points: 400, wins: 9, totalDrivers: 10 },
    driverRecentForm: {
      last10Steps: [{ finishAdvantage: 0.8, qualifyingAdvantage: 0.7, podium: 1, win: 1, reliability: 1 }],
      finishPositions: [1, 1, 2, 1, 3, 1, 1, 2, 1, 1],
      qualifyingPositions: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1],
      winCount: 7, podiumCount: 10, raceCount: 10,
      dnfCount: 0, totalLapsCompleted: 560, totalLapsPossible: 560,
    },
    constructorRecentForm: {
      last10Steps: [{ finishAdvantage: 0.7, qualifyingAdvantage: 0.6, podium: 1, win: 1, reliability: 1 }],
      finishPositions: [1, 1, 1, 1, 2],
      winCount: 4, podiumCount: 5, raceCount: 5,
    },
    circuitHistory: {
      driverWinCount: 2, driverPodiumCount: 4, driverTotalRaces: 6,
      constructorWinCount: 5, constructorTotalRaces: 10,
      poleWinConversionPct: 33, top3GridWinPct: 25,
      scRate: 0.3, vscRate: 0.1, redFlagRate: 0.05,
      overtakeUpsetRate: 0.2, totalSamples: 15,
    },
    circuitCharacteristics: {
      isStreetCircuit: false, overtakeDifficulty: 0.4,
      tyreStress: 0.5, restartRisk: 0.2, qualifyingImportance: 0.6,
    },
    sprint: { isSprintWeekend: false },
    ...overrides,
  });

  it('returns exactly 174 feature keys', () => {
    const vector = buildWinnerFeatureVector(makeFullInput());
    const keys = Object.keys(vector);
    expect(keys.length).toBe(WINNER_PREDICTION_FEATURES.length);
  });

  it('all feature names match the WINNER_PREDICTION_FEATURES array', () => {
    const vector = buildWinnerFeatureVector(makeFullInput());
    const keys = new Set(Object.keys(vector));
    for (const feat of WINNER_PREDICTION_FEATURES) {
      expect(keys.has(feat)).toBe(true);
    }
  });

  it('all values are in [-1, 1] range', () => {
    const vector = buildWinnerFeatureVector(makeFullInput());
    for (const [key, value] of Object.entries(vector)) {
      expect(value, `Feature ${key} out of range: ${value}`).toBeGreaterThanOrEqual(-1);
      expect(value, `Feature ${key} out of range: ${value}`).toBeLessThanOrEqual(1);
    }
  });

  it('pole position has positive grid features', () => {
    const vector = buildWinnerFeatureVector(makeFullInput());
    expect(vector.gridPole).toBe(1);
    expect(vector.gridAdvantage).toBeGreaterThan(0);
  });

  it('championship leader has positive standings features', () => {
    const vector = buildWinnerFeatureVector(makeFullInput());
    expect(vector.driverStandingAdvantage).toBeCloseTo(1);
  });

  it('missing qualifying uses default neutral values', () => {
    const input = makeFullInput({ qualifying: undefined });
    const vector = buildWinnerFeatureVector(input);
    // Should still have all 174 keys
    expect(Object.keys(vector).length).toBe(WINNER_PREDICTION_FEATURES.length);
  });

  it('missing sequence data uses neutral embedding', () => {
    const input = makeFullInput({ driverRecentForm: undefined, constructorRecentForm: undefined });
    const vector = buildWinnerFeatureVector(input);
    expect(Object.keys(vector).length).toBe(WINNER_PREDICTION_FEATURES.length);
    // Sequence features should be near-neutral
    expect(Math.abs(vector.driverSequenceMomentum)).toBeLessThan(0.2);
  });
});

// ============================================================================
// buildWinnerCandidates
// ============================================================================

describe('buildWinnerCandidates', () => {
  const makeInput = (driverId: string, constructorId: string, gridPos: number): WinnerFeatureInput => ({
    season: 2024, round: 5, circuitId: 'monza',
    driverId, constructorId,
    qualifying: {
      position: gridPos,
      totalDrivers: 20,
      allPositions: Array.from({ length: 20 }, (_, i) => i + 1),
    },
    driverStanding: { position: gridPos, points: 100, wins: 2, totalDrivers: 20 },
    constructorStanding: { position: 3, points: 150, wins: 3, totalDrivers: 10 },
    driverRecentForm: {
      last10Steps: [{ finishAdvantage: 0.5, qualifyingAdvantage: 0.5, podium: 1, win: 0, reliability: 1 }],
      finishPositions: [3, 2, 4, 1, 3],
      qualifyingPositions: [2, 1, 3, 1, 2],
      winCount: 1, podiumCount: 3, raceCount: 5,
      dnfCount: 0, totalLapsCompleted: 280, totalLapsPossible: 280,
    },
    constructorRecentForm: {
      last10Steps: [{ finishAdvantage: 0.5, qualifyingAdvantage: 0.5, podium: 1, win: 1, reliability: 1 }],
      finishPositions: [1, 2, 3],
      winCount: 1, podiumCount: 3, raceCount: 3,
    },
  });

  it('builds one candidate per driver', () => {
    const inputs = [
      makeInput('max_verstappen', 'red_bull', 1),
      makeInput('charles_leclerc', 'ferrari', 2),
      makeInput('lewis_hamilton', 'mercedes', 3),
    ];
    const candidates = buildWinnerCandidates('2024-05', inputs);
    expect(candidates.length).toBe(3);
    expect(candidates[0].raceKey).toBe('2024-05');
    expect(candidates[0].driverId).toBe('max_verstappen');
  });

  it('marks winner when knownWinnerDriverId matches', () => {
    const inputs = [
      makeInput('max_verstappen', 'red_bull', 1),
      makeInput('charles_leclerc', 'ferrari', 2),
    ];
    const candidates = buildWinnerCandidates('2024-05', inputs, 'max_verstappen');
    expect(candidates[0].winner).toBe(true);
    expect(candidates[1].winner).toBe(false);
  });

  it('no candidate is winner when knownWinnerDriverId is undefined', () => {
    const inputs = [
      makeInput('max_verstappen', 'red_bull', 1),
      makeInput('charles_leclerc', 'ferrari', 2),
    ];
    const candidates = buildWinnerCandidates('2024-05', inputs);
    expect(candidates[0].winner).toBe(false);
    expect(candidates[1].winner).toBe(false);
  });

  it('creates features for each candidate', () => {
    const inputs = [
      makeInput('max_verstappen', 'red_bull', 1),
    ];
    const candidates = buildWinnerCandidates('2024-05', inputs);
    expect(Object.keys(candidates[0].features).length).toBe(WINNER_PREDICTION_FEATURES.length);
  });
});

// ============================================================================
// getAvailableFeatureGroups
// ============================================================================

describe('getAvailableFeatureGroups', () => {
  it('reports all groups available when input is complete', () => {
    const input: WinnerFeatureInput = {
      season: 2024, round: 5, circuitId: 'monza',
      driverId: 'max_verstappen', constructorId: 'red_bull',
      qualifying: { position: 1, totalDrivers: 20, allPositions: [1, 2, 3] },
      practice: { fp1TimeSeconds: 90 },
      driverStanding: { position: 1, points: 200, wins: 5, totalDrivers: 20 },
      constructorStanding: { position: 1, points: 300, wins: 6, totalDrivers: 10 },
      driverRecentForm: {
        last10Steps: [], finishPositions: [], qualifyingPositions: [],
        winCount: 0, podiumCount: 0, raceCount: 1, dnfCount: 0,
        totalLapsCompleted: 50, totalLapsPossible: 50,
      },
      constructorRecentForm: {
        last10Steps: [], finishPositions: [],
        winCount: 0, podiumCount: 0, raceCount: 1,
      },
      circuitHistory: {
        driverWinCount: 0, driverPodiumCount: 0, driverTotalRaces: 1,
        constructorWinCount: 0, constructorTotalRaces: 1,
        poleWinConversionPct: null, top3GridWinPct: null,
        scRate: null, vscRate: null, redFlagRate: null,
        overtakeUpsetRate: null, totalSamples: 1,
      },
      circuitCharacteristics: {
        isStreetCircuit: false, overtakeDifficulty: 0.5,
        tyreStress: 0.5, restartRisk: 0.2, qualifyingImportance: 0.5,
      },
      sprint: { isSprintWeekend: true },
      upgrades: { declaredUpgradeCount: 3, declaredUpgradeIntensity: 5, performanceIntent: 0.6, circuitSpecificIntent: 0.3, reliabilityIntent: 0.1 },
      weather: { rainRisk: 0.1, airTempC: 25, trackTempC: 35, humidityPct: 50, windSpeedMps: 3 },
    };
    const groups = getAvailableFeatureGroups(input);
    expect(groups.grid).toBe(true);
    expect(groups.practice).toBe(true);
    expect(groups.standings).toBe(true);
    expect(groups.sequence).toBe(true);
    expect(groups.circuitHistory).toBe(true);
    expect(groups.circuitCharacteristics).toBe(true);
    expect(groups.sprint).toBe(true);
    expect(groups.upgrades).toBe(true);
    expect(groups.weather).toBe(true);
  });

  it('reports fastF1 as always false', () => {
    const groups = getAvailableFeatureGroups({
      season: 2024, round: 5, circuitId: 'monza',
      driverId: 'max_verstappen', constructorId: 'red_bull',
      qualifying: { position: 1, totalDrivers: 20, allPositions: [1, 2, 3] },
    });
    expect(groups.fastF1).toBe(false);
  });

  it('reports false for missing groups', () => {
    const groups = getAvailableFeatureGroups({
      season: 2024, round: 5, circuitId: 'monza',
      driverId: 'max_verstappen', constructorId: 'red_bull',
    });
    expect(groups.grid).toBe(false);
    expect(groups.practice).toBe(false);
    expect(groups.standings).toBe(false);
    expect(groups.sequence).toBe(false);
  });
});
