/**
 * Feature engineering pipeline for F1 race winner prediction.
 *
 * Converts raw F1 data (qualifying, standings, practice, FastF1 analytics, etc.)
 * into the 172-dimensional feature vector consumed by the prediction models in
 * src/utils/raceWinnerPrediction.ts.
 *
 * Design principles:
 * - Each feature group is a pure, independently-testable function
 * - All features normalized to [-1, 1] with 0 = neutral / field average
 * - Missing data defaults to 0, which is the model's no-op value
 */

import {
  WINNER_PREDICTION_FEATURES,
  type WinnerPredictionCandidate,
  type WinnerPredictionFeatureName,
  type WinnerPredictionFeatureVector,
} from '@/utils/raceWinnerPrediction';
import {
  buildRaceWinnerSequenceEmbedding,
  type RaceWinnerSequenceStep,
  type RaceWinnerSequenceEmbedding,
} from '@/utils/raceWinnerSequenceModel';

// ============================================================================
// Input Types
// ============================================================================

export interface QualifyingInput {
  position: number;
  totalDrivers: number;
  q1TimeSeconds?: number | null;
  q2TimeSeconds?: number | null;
  q3TimeSeconds?: number | null;
  /** All drivers' grid positions */
  allPositions: number[];
  allQ3TimesSeconds?: (number | null)[];
  teamMatePosition?: number | null;
  teamMateQ3TimeSeconds?: number | null;
}

export interface PracticeInput {
  fp1TimeSeconds?: number | null;
  fp2TimeSeconds?: number | null;
  fp3TimeSeconds?: number | null;
  lapsCompleted?: number;
  allFpBestTimesSeconds?: (number | null)[];
  allFpLapsCounts?: number[];
  teamMateBestFpTimeSeconds?: number | null;
  constructorBestFpTimeSeconds?: number | null;
}

export interface StandingInput {
  position: number;
  points: number;
  wins: number;
  totalDrivers: number;
}

export interface DriverRecentForm {
  last10Steps: RaceWinnerSequenceStep[];
  finishPositions: number[];
  qualifyingPositions: number[];
  winCount: number;
  podiumCount: number;
  raceCount: number;
  dnfCount: number;
  totalLapsCompleted: number;
  totalLapsPossible: number;
}

export interface ConstructorRecentForm {
  last10Steps: RaceWinnerSequenceStep[];
  finishPositions: number[];
  winCount: number;
  podiumCount: number;
  raceCount: number;
}

export interface CircuitHistoryInput {
  driverWinCount: number;
  driverPodiumCount: number;
  driverTotalRaces: number;
  constructorWinCount: number;
  constructorTotalRaces: number;
  poleWinConversionPct: number | null;
  top3GridWinPct: number | null;
  scRate: number | null;
  vscRate: number | null;
  redFlagRate: number | null;
  overtakeUpsetRate: number | null;
  totalSamples: number;
}

export interface CircuitCharacteristicsInput {
  isStreetCircuit: boolean;
  overtakeDifficulty: number;
  tyreStress: number;
  restartRisk: number;
  qualifyingImportance: number;
}

export interface SprintInput {
  isSprintWeekend: boolean;
  sprintPosition?: number | null;
  sprintQualifyingPosition?: number | null;
  totalSprintDrivers?: number;
}

export interface UpgradeInput {
  declaredUpgradeCount: number;
  declaredUpgradeIntensity: number;
  performanceIntent: number;
  circuitSpecificIntent: number;
  reliabilityIntent: number;
  /** Upgrade intensities for the last 3 races (oldest first). Used to compute momentum. */
  recentUpgradeIntensities?: number[];
  /** Upgrade counts for the last 3 races (oldest first). Used to compute momentum. */
  recentUpgradeCounts?: number[];
}

export interface WeatherInput {
  rainRisk: number;
  airTempC: number | null;
  trackTempC: number | null;
  humidityPct: number | null;
  windSpeedMps: number | null;
}

/**
 * Pre-computed FastF1 analytics form metrics aggregated from historical race data.
 * Each metric is expected in raw form and will be normalized to [-1, 1].
 * The aggregator pipeline loads FastF1 JSON from public/fastf1/{season}/{round}/ per driver/constructor
 * and computes performance in each dimension over recent races.
 */
export interface FastF1AnalyticsMetrics {
  /** Long-run pace advantage (from race lap data, excluding outlier laps) */
  longRunPaceAdvantage?: number;
  /** Tyre degradation management (lap time fall-off over stint) */
  tyreManagementAdvantage?: number;
  /** Average stint length relative to field */
  stintLengthAdvantage?: number;
  /** Pit stop time advantage */
  pitStopAdvantage?: number;
  /** Frequency/quality of fastest laps */
  fastestLapAdvantage?: number;
  /** Speed trap / top speed advantage from telemetry */
  telemetrySpeedAdvantage?: number;
  /** Average grid positions gained at race start */
  gridGainAdvantage?: number;
  /** Performance under chaotic conditions (SC, yellow, incidents) */
  chaosAdvantage?: number;
  /** Performance on race restarts */
  restartProxyAdvantage?: number;
  /** Performance under safety car periods */
  safetyCarAdvantage?: number;
  /** Performance under virtual safety car periods */
  virtualSafetyCarAdvantage?: number;
  /** Performance during red flag periods */
  redFlagAdvantage?: number;
  /** Rate of converting good qualifying into good race finish */
  qualifyingConversionAdvantage?: number;
  /** Pace blend across different tyre compounds */
  tyrePaceBlendAdvantage?: number;
  /** Pace immediately after pit stops */
  postPitPaceAdvantage?: number;
  /** Position gain through strategy (undercuts, overcut, alternate strategies) */
  strategyGainAdvantage?: number;
  /** Pace on restarts */
  restartPaceAdvantage?: number;
  /** Positions gained on restarts */
  restartGainAdvantage?: number;
  /** Positions gained under safety car periods */
  safetyCarGainAdvantage?: number;
  /** Tyre performance on hot track conditions */
  hotTrackTyreAdvantage?: number;
  /** Pace in wet/rain conditions */
  wetTrackPaceAdvantage?: number;
}

export interface FastF1AnalyticsInput {
  driver?: Partial<FastF1AnalyticsMetrics>;
  constructor?: Partial<FastF1AnalyticsMetrics>;
}

export interface WinnerFeatureInput {
  season: number;
  round: number;
  circuitId: string;
  driverId: string;
  constructorId: string;

  qualifying?: QualifyingInput;
  practice?: PracticeInput;
  driverStanding?: StandingInput;
  constructorStanding?: StandingInput;
  driverRecentForm?: DriverRecentForm;
  constructorRecentForm?: ConstructorRecentForm;
  circuitHistory?: CircuitHistoryInput;
  circuitCharacteristics?: CircuitCharacteristicsInput;
  sprint?: SprintInput;
  upgrades?: UpgradeInput;
  weather?: WeatherInput;
  fastf1Analytics?: FastF1AnalyticsInput;
}

// ============================================================================
// Normalization Helpers
// ============================================================================

/** Clamp value to [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rank-based normalization: 1st → +1, last → -1, linear in between.
 * Handles ties by treating the provided position directly.
 */
export function normalizePosition(position: number, total: number): number {
  if (total <= 1) return 0;
  return clamp(1 - (2 * (position - 1)) / (total - 1), -1, 1);
}

/**
 * Rate in [0, 1] → [-1, 1] centered at neutral midpoint.
 * neutral=0.5: rate 1.0 → +1, rate 0.0 → -1, rate 0.5 → 0.
 */
export function normalizeRate(rate: number, neutral = 0.5): number {
  if (rate >= neutral) {
    return clamp((rate - neutral) / (1 - neutral), 0, 1);
  }
  return clamp((rate - neutral) / neutral, -1, 0);
}

/**
 * Linear mapping from [min, max] → [-1, 1].
 */
export function normalizeLinear(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((2 * (value - min)) / (max - min) - 1, -1, 1);
}

/**
 * Z-score style advantage: (value - fieldMean) / fieldStd, clamped to [-3, 3],
 * then scaled to [-1, 1].
 */
export function normalizeAdvantage(
  value: number,
  fieldValues: number[],
): number {
  if (fieldValues.length === 0) return 0;
  const mean = fieldValues.reduce((s, v) => s + v, 0) / fieldValues.length;
  const variance =
    fieldValues.reduce((s, v) => s + (v - mean) ** 2, 0) / fieldValues.length;
  const std = Math.sqrt(variance) || 1;
  const z = (value - mean) / std;
  return clamp(z / 3, -1, 1);
}


// ============================================================================
// Tier 1: Qualifying / Grid Features (13 features)
// ============================================================================

export function buildQualifyingFeatures(
  q: QualifyingInput,
): Partial<WinnerPredictionFeatureVector> {
  const pos = q.position;
  const total = q.totalDrivers;

  const gridAdvantage = normalizePosition(pos, total);
  const gridPole = pos === 1 ? 1 : 0;
  const gridFrontRow = pos <= 2 ? 1 : 0;
  const gridTop3 = pos <= 3 ? 1 : 0;

  // Pole model proxy: simplified version using grid position as pseudo-probability
  const poleModelProbability = pos === 1 ? 1 : pos <= 3 ? 0.6 : Math.max(0, 1 - (pos - 1) / total);
  const poleModelRankAdvantage = normalizePosition(pos, total);
  const poleModelScore = pos === 1 ? 2 : pos <= 3 ? 1 : normalizePosition(pos, total);

  // Qualifying pace
  const qualifyingAdvantage = normalizePosition(pos, total);
  const qualifyingPole = gridPole;
  const qualifyingFrontRow = gridFrontRow;

  // Pace advantage from Q3 time gap
  let qualifyingPaceAdvantage = 0;
  let qualifyingPaceSharpAdvantage = 0;
  let teamMateQualifyingAdvantage = 0;

  if (q.allQ3TimesSeconds && q.allQ3TimesSeconds.length > 0) {
    const q3Time = q.q3TimeSeconds ?? null;
    const validQ3 = q.allQ3TimesSeconds.filter((t): t is number => t != null);
    if (q3Time != null && validQ3.length > 0) {
      const bestQ3 = Math.min(...validQ3);
      const gap = q3Time - bestQ3;
      qualifyingPaceAdvantage = clamp(1 - gap / 2, -1, 1); // 2s gap → -1
      qualifyingPaceSharpAdvantage = gap < 0.1 ? 1 : gap < 0.3 ? 0.5 : 0;
    }
  }

  if (q.teamMatePosition != null && q.teamMateQ3TimeSeconds != null && q.q3TimeSeconds != null) {
    const mateGap = q.q3TimeSeconds - q.teamMateQ3TimeSeconds;
    teamMateQualifyingAdvantage = clamp(mateGap / 0.5, -1, 1) * -1; // negative gap = faster = positive
  }

  return {
    gridAdvantage, gridPole, gridFrontRow, gridTop3,
    poleModelProbability, poleModelRankAdvantage, poleModelScore,
    qualifyingAdvantage, qualifyingPole, qualifyingFrontRow,
    qualifyingPaceAdvantage, qualifyingPaceSharpAdvantage,
    teamMateQualifyingAdvantage,
  };
}

// ============================================================================
// Tier 2: Practice Features (9 features)
// ============================================================================

export function buildPracticeFeatures(
  p: PracticeInput,
): Partial<WinnerPredictionFeatureVector> {
  const feats: Partial<WinnerPredictionFeatureVector> = {};

  // Individual FP advantages
  const bestTimes = p.allFpBestTimesSeconds?.filter((t): t is number => t != null);
  const bestOverall = bestTimes && bestTimes.length > 0 ? Math.min(...bestTimes) : null;

  for (const [key, time] of [
    ['fp1Advantage', p.fp1TimeSeconds],
    ['fp2Advantage', p.fp2TimeSeconds],
    ['fp3Advantage', p.fp3TimeSeconds],
  ] as const) {
    feats[key] = time != null && bestOverall != null
      ? clamp(1 - (time - bestOverall) / 2, -1, 1)
      : 0;
  }

  // Best and average FP advantage
  const driverBest = [p.fp1TimeSeconds, p.fp2TimeSeconds, p.fp3TimeSeconds]
    .filter((t): t is number => t != null);
  const driverBestTime = driverBest.length > 0 ? Math.min(...driverBest) : null;

  feats.fpBestAdvantage = driverBestTime != null && bestOverall != null
    ? clamp(1 - (driverBestTime - bestOverall) / 2, -1, 1)
    : 0;

  feats.fpAverageAdvantage = driverBestTime != null && bestTimes && bestTimes.length > 0
    ? normalizeAdvantage(driverBestTime, bestTimes) * -1
    : 0;

  feats.fpBestGapAdvantage = driverBestTime != null && bestOverall != null
    ? clamp(1 - (driverBestTime - bestOverall) / 0.5, -1, 1)
    : 0;

  // Laps share
  const totalLaps = (p.allFpLapsCounts ?? []).reduce((s, c) => s + c, 0);
  feats.fpLapsShare = totalLaps > 0 && p.lapsCompleted != null
    ? normalizeRate(p.lapsCompleted / Math.max(totalLaps / (p.allFpLapsCounts?.length || 1), 1), 1 / (p.allFpLapsCounts?.length || 20))
    : 0;

  // Team mate and constructor FP advantages
  feats.fpTeamMateAdvantage = p.teamMateBestFpTimeSeconds != null && driverBestTime != null
    ? clamp((p.teamMateBestFpTimeSeconds - driverBestTime) / 0.5, -1, 1)
    : 0;

  feats.fpConstructorAdvantage = p.constructorBestFpTimeSeconds != null && driverBestTime != null
    ? clamp((p.constructorBestFpTimeSeconds - driverBestTime) / 0.5, -1, 1)
    : 0;

  return feats;
}

// ============================================================================
// Tier 1: Standings Features (6 features)
// ============================================================================

export function buildStandingsFeatures(
  d: StandingInput,
  c: StandingInput,
): Partial<WinnerPredictionFeatureVector> {
  return {
    driverStandingAdvantage: normalizePosition(d.position, d.totalDrivers),
    driverStandingPointsShare: d.totalDrivers > 0
      ? clamp((d.points / Math.max(d.totalDrivers, 1) - 10) / 50, -1, 1)
      : 0,
    constructorStandingAdvantage: normalizePosition(c.position, c.totalDrivers),
    constructorStandingPointsShare: c.totalDrivers > 0
      ? clamp((c.points / Math.max(c.totalDrivers, 1) - 10) / 50, -1, 1)
      : 0,
    driverSeasonWinRate: d.totalDrivers > 0
      ? normalizeRate(d.wins / Math.max(d.totalDrivers, 1), 0.1)
      : 0,
    constructorSeasonWinRate: c.totalDrivers > 0
      ? normalizeRate(c.wins / Math.max(c.totalDrivers, 1), 0.1)
      : 0,
  };
}

// ============================================================================
// Tier 1: Circuit Characteristics Features (6 features)
// ============================================================================

export function buildCircuitCharacteristicsFeatures(
  cc: CircuitCharacteristicsInput,
): Partial<WinnerPredictionFeatureVector> {
  return {
    circuitStreetTrack: cc.isStreetCircuit ? 1 : 0,
    circuitLowOvertake: cc.overtakeDifficulty > 0.7 ? 1 : cc.overtakeDifficulty > 0.4 ? normalizeRate(cc.overtakeDifficulty, 0.5) : -1,
    circuitTyreStress: normalizeRate(cc.tyreStress, 0.5),
    circuitRestartRisk: normalizeRate(cc.restartRisk, 0.3),
    circuitQualifyingImportance: normalizeRate(cc.qualifyingImportance, 0.5),
  };
}

// ============================================================================
// Tier 1: Circuit History Features (10 features)
// ============================================================================

export function buildCircuitHistoryFeatures(
  ch: CircuitHistoryInput,
): Partial<WinnerPredictionFeatureVector> {
  const dr = ch.driverTotalRaces;
  const cr = ch.constructorTotalRaces;

  return {
    sameCircuitDriverWinRate: dr > 0 ? normalizeRate(ch.driverWinCount / dr, 0.05) : 0,
    sameCircuitDriverPodiumRate: dr > 0 ? normalizeRate(ch.driverPodiumCount / dr, 0.2) : 0,
    sameCircuitConstructorWinRate: cr > 0 ? normalizeRate(ch.constructorWinCount / cr, 0.05) : 0,
    sameCircuitPoleWinRate: ch.poleWinConversionPct != null
      ? normalizeRate(ch.poleWinConversionPct / 100, 0.3)
      : 0,
    sameCircuitTop3GridWinRate: ch.top3GridWinPct != null
      ? normalizeRate(ch.top3GridWinPct / 100, 0.2)
      : 0,
    sameCircuitChaosRate: ch.totalSamples > 0 ? normalizeRate(
      ((ch.scRate ?? 0) + (ch.vscRate ?? 0) + (ch.redFlagRate ?? 0)) / 3, 0.3,
    ) : 0,
    sameCircuitSafetyCarRate: ch.scRate != null ? normalizeRate(ch.scRate, 0.3) : 0,
    sameCircuitVirtualSafetyCarRate: ch.vscRate != null ? normalizeRate(ch.vscRate, 0.15) : 0,
    sameCircuitRedFlagRate: ch.redFlagRate != null ? normalizeRate(ch.redFlagRate, 0.1) : 0,
    sameCircuitOvertakeUpsetRate: ch.overtakeUpsetRate != null
      ? normalizeRate(ch.overtakeUpsetRate, 0.2)
      : 0,
  };
}

// ============================================================================
// Tier 1: Sprint Features (3 features)
// ============================================================================

export function buildSprintFeatures(
  s: SprintInput,
): Partial<WinnerPredictionFeatureVector> {
  const sprintWeekend = s.isSprintWeekend ? 1 : 0;

  let sprintFinishAdvantage = 0;
  if (s.sprintPosition != null && s.totalSprintDrivers && s.totalSprintDrivers > 1) {
    sprintFinishAdvantage = normalizePosition(s.sprintPosition, s.totalSprintDrivers);
  }

  let sprintQualifyingAdvantage = 0;
  if (s.sprintQualifyingPosition != null && s.totalSprintDrivers && s.totalSprintDrivers > 1) {
    sprintQualifyingAdvantage = normalizePosition(s.sprintQualifyingPosition, s.totalSprintDrivers);
  }

  return { sprintWeekend, sprintFinishAdvantage, sprintQualifyingAdvantage };
}

// ============================================================================
// Tier 1: Round Progress Feature (1 feature)
// ============================================================================

export function buildRoundProgressFeature(
  round: number,
  totalRounds: number,
): Partial<WinnerPredictionFeatureVector> {
  return {
    raceRoundProgress: totalRounds > 1
      ? clamp((2 * (round - 1)) / (totalRounds - 1) - 1, -1, 1)
      : 0,
  };
}

// ============================================================================
// Tier 3: Sequence / Momentum Features (24 features)
// ============================================================================

export function computeTrend(values: number[], windowSize = 5): number {
  if (values.length < 2) return 0;
  const recent = values.slice(-windowSize);
  if (recent.length < 2) return 0;
  // Simple linear trend: compare first half vs second half
  const mid = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, mid);
  const secondHalf = recent.slice(mid);
  const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length || 1;
  const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length || 1;
  const maxVal = Math.max(...recent.filter((v) => v > 0), 1);
  return clamp((secondAvg - firstAvg) / maxVal, -1, 1);
}

export function buildSequenceFeatures(
  sequence: RaceWinnerSequenceEmbedding,
  driverForm: DriverRecentForm,
  constructorForm: ConstructorRecentForm,
): Partial<WinnerPredictionFeatureVector> {
  // Driver sequence embeddings
  const driverMomentum = sequence.momentum * 2 - 1;      // [0,1] → [-1,1]
  const driverConsistency = sequence.consistency * 2 - 1;
  const driverUpside = sequence.upside * 2 - 1;

  // Constructor sequence: build embedding from constructor form
  const constructorEmbedding = buildRaceWinnerSequenceEmbedding(constructorForm.last10Steps);
  const constructorMomentum = constructorEmbedding.momentum * 2 - 1;
  const constructorConsistency = constructorEmbedding.consistency * 2 - 1;
  const constructorUpside = constructorEmbedding.upside * 2 - 1;

  // Driver form stats
  const dr = driverForm.raceCount;
  const recentFinishAvg = driverForm.finishPositions.length > 0
    ? driverForm.finishPositions.reduce((s, p) => s + p, 0) / driverForm.finishPositions.length
    : 20;

  // Trends (positive = improving = lower finish position)
  const finishTrend = -computeTrend(driverForm.finishPositions.map((p) => 1 / Math.max(p, 1)));
  const qualifyingTrend = -computeTrend(driverForm.qualifyingPositions.map((p) => 1 / Math.max(p, 1)));
  const winTrend = computeTrend(
    driverForm.finishPositions.map((p) => (p === 1 ? 1 : 0)),
  );
  const podiumTrend = computeTrend(
    driverForm.finishPositions.map((p) => (p <= 3 ? 1 : 0)),
  );

  // Constructor trends
  const cFinishAvg = constructorForm.finishPositions.length > 0
    ? constructorForm.finishPositions.reduce((s, p) => s + p, 0) / constructorForm.finishPositions.length
    : 20;
  const cFinishTrend = -computeTrend(constructorForm.finishPositions.map((p) => 1 / Math.max(p, 1)));
  const cQualifyingTrend = 0; // Not available from constructor form input
  const cWinTrend = computeTrend(
    constructorForm.finishPositions.map((p) => (p === 1 ? 1 : 0)),
  );
  const cPodiumTrend = computeTrend(
    constructorForm.finishPositions.map((p) => (p <= 3 ? 1 : 0)),
  );

  // Reliability
  const driverReliability = driverForm.totalLapsPossible > 0
    ? driverForm.totalLapsCompleted / driverForm.totalLapsPossible
    : 1;
  const constructorReliability = 0.95; // Default assume reliable

  return {
    // Driver momentum
    driverShortRecentWinRate: dr > 0 ? normalizeRate(driverForm.winCount / dr, 0.1) : 0,
    driverSequenceMomentum: driverMomentum,
    driverSequenceConsistency: driverConsistency,
    driverSequenceUpside: driverUpside,
    driverFinishTrend: finishTrend,
    driverQualifyingTrend: qualifyingTrend,
    driverWinTrend: winTrend,
    driverPodiumTrend: podiumTrend,
    driverRecentFinishForm: normalizePosition(
      Math.round(recentFinishAvg),
      20,
    ),
    driverRecentPodiumRate: dr > 0 ? normalizeRate(driverForm.podiumCount / dr, 0.3) : 0,
    driverRecentWinRate: dr > 0 ? normalizeRate(driverForm.winCount / dr, 0.1) : 0,
    driverLongRecentWinRate: dr > 0 ? normalizeRate(driverForm.winCount / dr, 0.05) : 0,

    // Constructor momentum
    constructorShortRecentWinRate: constructorForm.raceCount > 0
      ? normalizeRate(constructorForm.winCount / constructorForm.raceCount, 0.1)
      : 0,
    constructorSequenceMomentum: constructorMomentum,
    constructorSequenceConsistency: constructorConsistency,
    constructorSequenceUpside: constructorUpside,
    constructorFinishTrend: cFinishTrend,
    constructorQualifyingTrend: cQualifyingTrend,
    constructorWinTrend: cWinTrend,
    constructorPodiumTrend: cPodiumTrend,
    constructorRecentFinishForm: normalizePosition(Math.round(cFinishAvg), 20),
    constructorRecentPodiumRate: constructorForm.raceCount > 0
      ? normalizeRate(constructorForm.podiumCount / constructorForm.raceCount, 0.3)
      : 0,
    constructorRecentWinRate: constructorForm.raceCount > 0
      ? normalizeRate(constructorForm.winCount / constructorForm.raceCount, 0.1)
      : 0,
    constructorLongRecentWinRate: constructorForm.raceCount > 0
      ? normalizeRate(constructorForm.winCount / constructorForm.raceCount, 0.05)
      : 0,

    // Reliability
    driverRecentReliability: normalizeRate(driverReliability, 0.9),
    constructorRecentReliability: normalizeRate(constructorReliability, 0.9),
  };
}

// ============================================================================
// Tier 4: Upgrade Features (13 features)
// ============================================================================

export function buildUpgradeFeatures(
  upgrades?: UpgradeInput,
  isStreetCircuit?: boolean,
): Partial<WinnerPredictionFeatureVector> {
  if (!upgrades) {
    // No upgrade data available — all neutral (0)
    return {};
  }

  const { declaredUpgradeCount, declaredUpgradeIntensity } = upgrades;
  const hasUpgrades = declaredUpgradeCount > 0;

  // --- Direct mappings from declared FIA data ---
  const constructorUpgradeProxy = hasUpgrades
    ? normalizeRate(Math.min(declaredUpgradeCount, 5) / 5, 0.15)
    : -1;

  const constructorDeclaredUpgradeIntensityVal = normalizeLinear(
    declaredUpgradeIntensity, 0, 35,
  );
  const constructorDeclaredUpgradeCountVal = normalizeLinear(
    declaredUpgradeCount, 0, 10,
  );
  const constructorPerformanceUpgradeIntentVal = normalizeRate(
    upgrades.performanceIntent, 0.3,
  );
  const constructorCircuitSpecificUpgradeIntentVal = normalizeRate(
    upgrades.circuitSpecificIntent, 0.2,
  );
  const constructorReliabilityUpgradeIntentVal = normalizeRate(
    upgrades.reliabilityIntent, 0.2,
  );

  // --- Derived features ---

  // How well the declared upgrades fit this specific track
  const declaredUpgradeTrackFit = normalizeRate(
    upgrades.circuitSpecificIntent * 0.6 + upgrades.performanceIntent * 0.4,
    0.3,
  );

  // Constructor upgrade momentum: trend over last 3 races
  let declaredUpgradeConstructorMomentumVal = 0;
  const recentI = upgrades.recentUpgradeIntensities;
  if (recentI && recentI.length >= 2) {
    const mid = Math.floor(recentI.length / 2);
    const firstAvg = recentI.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const secondAvg = recentI.slice(mid).reduce((s, v) => s + v, 0) / (recentI.length - mid);
    declaredUpgradeConstructorMomentumVal = clamp((secondAvg - firstAvg) / 20, -1, 1);
  }

  // Track type interaction: circuit-specific upgrades on street tracks are a good fit
  let declaredUpgradeTrackTypeInteractionVal = 0;
  if (isStreetCircuit !== undefined) {
    declaredUpgradeTrackTypeInteractionVal = clamp(
      upgrades.circuitSpecificIntent * (isStreetCircuit ? 1 : -1) * 2,
      -1, 1,
    );
  }

  return {
    constructorUpgradeProxy,
    constructorDeclaredUpgradeIntensity: constructorDeclaredUpgradeIntensityVal,
    constructorDeclaredUpgradeCount: constructorDeclaredUpgradeCountVal,
    constructorPerformanceUpgradeIntent: constructorPerformanceUpgradeIntentVal,
    constructorCircuitSpecificUpgradeIntent: constructorCircuitSpecificUpgradeIntentVal,
    constructorReliabilityUpgradeIntent: constructorReliabilityUpgradeIntentVal,
    declaredUpgradeTrackFit,
    declaredUpgradeConstructorMomentum: declaredUpgradeConstructorMomentumVal,
    declaredUpgradeDriverAdaptation: 0, // TODO: needs driver-team change data (did the driver switch teams recently?)
    declaredUpgradePracticeValidation: 0, // TODO: needs practice pace correlation with upgrade packages
    declaredUpgradeLongRunValidation: 0, // TODO: needs long-run pace data from practice sessions
    declaredUpgradeTrackTypeInteraction: declaredUpgradeTrackTypeInteractionVal,
    driverUpgradeAdaptationProxy: 0, // TODO: needs driver tenure with current constructor (race count)
  };
}

// ============================================================================
// Tier 4: Weather Features (20 features — partial: rain/heat/temp only)
// ============================================================================

export function buildWeatherFeatures(
  w?: WeatherInput,
): Partial<WinnerPredictionFeatureVector> {
  const feats: Partial<WinnerPredictionFeatureVector> = {};

  if (!w) {
    return feats;
  }

  feats.weatherRainRisk = normalizeRate(w.rainRisk, 0.2);
  feats.weatherCoolTrack = w.trackTempC != null ? (w.trackTempC < 25 ? 1 : w.trackTempC < 30 ? 0 : -1) : 0;
  feats.weatherHotTrack = w.trackTempC != null ? (w.trackTempC > 40 ? 1 : w.trackTempC > 35 ? 0 : -1) : 0;
  feats.weatherHumidity = w.humidityPct != null ? normalizeRate(w.humidityPct / 100, 0.5) : 0;
  feats.weatherWind = w.windSpeedMps != null ? normalizeLinear(w.windSpeedMps, 0, 15) : 0;
  feats.weatherTrackAirDelta = w.trackTempC != null && w.airTempC != null
    ? clamp((w.trackTempC - w.airTempC - 10) / 15, -1, 1)
    : 0;

  return feats;
}

// ============================================================================
// Tier 4: FastF1 Analytics Features (42 features — stubs)
// ============================================================================

const FASTF1_FEATURE_NAMES: WinnerPredictionFeatureName[] = [
  'driverLongRunPaceForm',
  'constructorLongRunPaceForm',
  'driverTyreManagementForm',
  'constructorTyreManagementForm',
  'driverStintLengthForm',
  'constructorStintLengthForm',
  'driverPitStopForm',
  'constructorPitStopForm',
  'driverFastestLapForm',
  'constructorFastestLapForm',
  'driverTelemetrySpeedForm',
  'constructorTelemetrySpeedForm',
  'driverGridGainForm',
  'constructorGridGainForm',
  'driverChaosForm',
  'constructorChaosForm',
  'driverRestartProxyForm',
  'constructorRestartProxyForm',
  'driverSafetyCarForm',
  'constructorSafetyCarForm',
  'driverVirtualSafetyCarForm',
  'constructorVirtualSafetyCarForm',
  'driverRedFlagForm',
  'constructorRedFlagForm',
  'driverQualifyingConversionForm',
  'constructorQualifyingConversionForm',
  'driverTyrePaceBlend',
  'constructorTyrePaceBlend',
  'driverPostPitPaceForm',
  'constructorPostPitPaceForm',
  'driverStrategyGainForm',
  'constructorStrategyGainForm',
  'driverRestartPaceForm',
  'constructorRestartPaceForm',
  'driverRestartGainForm',
  'constructorRestartGainForm',
  'driverSafetyCarGainForm',
  'constructorSafetyCarGainForm',
  'driverHotTrackTyreForm',
  'constructorHotTrackTyreForm',
  'driverWetTrackPaceForm',
  'constructorWetTrackPaceForm',
];

export function buildFastF1Features(
  analytics?: FastF1AnalyticsInput,
): Partial<WinnerPredictionFeatureVector> {
  if (!analytics) {
    return Object.fromEntries(FASTF1_FEATURE_NAMES.map((f) => [f, 0]));
  }

  const d = analytics.driver || {};
  const c = analytics.constructor || {};

  return {
    // Long-run pace
    driverLongRunPaceForm: clamp(d.longRunPaceAdvantage ?? 0, -1, 1),
    constructorLongRunPaceForm: clamp(c.longRunPaceAdvantage ?? 0, -1, 1),
    // Tyre management
    driverTyreManagementForm: clamp(d.tyreManagementAdvantage ?? 0, -1, 1),
    constructorTyreManagementForm: clamp(c.tyreManagementAdvantage ?? 0, -1, 1),
    // Stint length
    driverStintLengthForm: clamp(d.stintLengthAdvantage ?? 0, -1, 1),
    constructorStintLengthForm: clamp(c.stintLengthAdvantage ?? 0, -1, 1),
    // Pit stop
    driverPitStopForm: clamp(d.pitStopAdvantage ?? 0, -1, 1),
    constructorPitStopForm: clamp(c.pitStopAdvantage ?? 0, -1, 1),
    // Fastest lap
    driverFastestLapForm: clamp(d.fastestLapAdvantage ?? 0, -1, 1),
    constructorFastestLapForm: clamp(c.fastestLapAdvantage ?? 0, -1, 1),
    // Telemetry speed
    driverTelemetrySpeedForm: clamp(d.telemetrySpeedAdvantage ?? 0, -1, 1),
    constructorTelemetrySpeedForm: clamp(c.telemetrySpeedAdvantage ?? 0, -1, 1),
    // Grid gain
    driverGridGainForm: clamp(d.gridGainAdvantage ?? 0, -1, 1),
    constructorGridGainForm: clamp(c.gridGainAdvantage ?? 0, -1, 1),
    // Chaos
    driverChaosForm: clamp(d.chaosAdvantage ?? 0, -1, 1),
    constructorChaosForm: clamp(c.chaosAdvantage ?? 0, -1, 1),
    // Restart proxy
    driverRestartProxyForm: clamp(d.restartProxyAdvantage ?? 0, -1, 1),
    constructorRestartProxyForm: clamp(c.restartProxyAdvantage ?? 0, -1, 1),
    // Safety car
    driverSafetyCarForm: clamp(d.safetyCarAdvantage ?? 0, -1, 1),
    constructorSafetyCarForm: clamp(c.safetyCarAdvantage ?? 0, -1, 1),
    // Virtual safety car
    driverVirtualSafetyCarForm: clamp(d.virtualSafetyCarAdvantage ?? 0, -1, 1),
    constructorVirtualSafetyCarForm: clamp(c.virtualSafetyCarAdvantage ?? 0, -1, 1),
    // Red flag
    driverRedFlagForm: clamp(d.redFlagAdvantage ?? 0, -1, 1),
    constructorRedFlagForm: clamp(c.redFlagAdvantage ?? 0, -1, 1),
    // Qualifying conversion
    driverQualifyingConversionForm: clamp(d.qualifyingConversionAdvantage ?? 0, -1, 1),
    constructorQualifyingConversionForm: clamp(c.qualifyingConversionAdvantage ?? 0, -1, 1),
    // Tyre pace blend
    driverTyrePaceBlend: clamp(d.tyrePaceBlendAdvantage ?? 0, -1, 1),
    constructorTyrePaceBlend: clamp(c.tyrePaceBlendAdvantage ?? 0, -1, 1),
    // Post-pit pace
    driverPostPitPaceForm: clamp(d.postPitPaceAdvantage ?? 0, -1, 1),
    constructorPostPitPaceForm: clamp(c.postPitPaceAdvantage ?? 0, -1, 1),
    // Strategy gain
    driverStrategyGainForm: clamp(d.strategyGainAdvantage ?? 0, -1, 1),
    constructorStrategyGainForm: clamp(c.strategyGainAdvantage ?? 0, -1, 1),
    // Restart pace
    driverRestartPaceForm: clamp(d.restartPaceAdvantage ?? 0, -1, 1),
    constructorRestartPaceForm: clamp(c.restartPaceAdvantage ?? 0, -1, 1),
    // Restart gain
    driverRestartGainForm: clamp(d.restartGainAdvantage ?? 0, -1, 1),
    constructorRestartGainForm: clamp(c.restartGainAdvantage ?? 0, -1, 1),
    // Safety car gain
    driverSafetyCarGainForm: clamp(d.safetyCarGainAdvantage ?? 0, -1, 1),
    constructorSafetyCarGainForm: clamp(c.safetyCarGainAdvantage ?? 0, -1, 1),
    // Hot track tyre
    driverHotTrackTyreForm: clamp(d.hotTrackTyreAdvantage ?? 0, -1, 1),
    constructorHotTrackTyreForm: clamp(c.hotTrackTyreAdvantage ?? 0, -1, 1),
    // Wet track pace
    driverWetTrackPaceForm: clamp(d.wetTrackPaceAdvantage ?? 0, -1, 1),
    constructorWetTrackPaceForm: clamp(c.wetTrackPaceAdvantage ?? 0, -1, 1),
  };
}

// ============================================================================
// Tier 4: Interaction Features (27 features — stubs)
// ============================================================================

export const INTERACTION_FEATURE_NAMES: WinnerPredictionFeatureName[] = [
  'gridPoleCircuitInteraction',
  'gridFrontRowCircuitInteraction',
  'gridTop3CircuitInteraction',
  'driverCircuitFamiliarityInteraction',
  'constructorCircuitFamiliarityInteraction',
  'chaosRacecraftInteraction',
  'restartRacecraftInteraction',
  'safetyCarRacecraftInteraction',
  'redFlagRacecraftInteraction',
  'tyreStressPaceInteraction',
  'postPitStrategyInteraction',
  'restartPaceInteraction',
  'weatherTyreInteraction',
  'upgradeTrendInteraction',
  'upgradePracticeInteraction',
  'upgradeRacePaceInteraction',
  'upgradeTrackFitInteraction',
  'trackTypeFamiliarityInteraction',
  'qualifyingConversionInteraction',
  'constructorQualifyingInteraction',
  'driverTeamMateInteraction',
  'driverTrendSeasonInteraction',
  'constructorTrendStrengthInteraction',
  'driverSimilarWeatherForm',
  'constructorSimilarWeatherForm',
  'driverRainWeatherForm',
  'constructorRainWeatherForm',
  'driverHotTrackForm',
  'constructorHotTrackForm',
  'driverCoolTrackForm',
  'constructorCoolTrackForm',
  'driverWindWeatherReliability',
  'constructorWindWeatherReliability',
  'rainDriverInteraction',
  'rainConstructorInteraction',
  'hotTrackConstructorInteraction',
  'coolTrackDriverInteraction',
  'windReliabilityInteraction',
];

export function buildInteractionFeatures(
  input: WinnerFeatureInput,
): Partial<WinnerPredictionFeatureVector> {
  const q = input.qualifying;
  const cc = input.circuitCharacteristics;
  const ch = input.circuitHistory;
  const ds = input.driverStanding;
  const cs = input.constructorStanding;
  const df = input.driverRecentForm;
  const cf = input.constructorRecentForm;
  const w = input.weather;
  const p = input.practice;
  const up = input.upgrades;
  const street = cc?.isStreetCircuit;

  // ======================================================================
  // Compute intermediate normalized feature values from raw input
  // ======================================================================

  // -- Grid / Qualifying --
  const gridPole = q?.position === 1 ? 1 : 0;
  const gridFrontRow = q?.position != null && q.position <= 2 ? 1 : 0;
  const gridTop3 = q?.position != null && q.position <= 3 ? 1 : 0;
  const qualifyingAdvantage = q
    ? normalizePosition(q.position, q.totalDrivers)
    : 0;
  let qualifyingPaceAdvantage = 0;
  if (q?.allQ3TimesSeconds && q.allQ3TimesSeconds.length > 0) {
    const q3Time = q.q3TimeSeconds ?? null;
    const validQ3 = q.allQ3TimesSeconds.filter((t): t is number => t != null);
    if (q3Time != null && validQ3.length > 0) {
      qualifyingPaceAdvantage = clamp(1 - (q3Time - Math.min(...validQ3)) / 2, -1, 1);
    }
  }
  let teamMateQualifyingAdvantage = 0;
  if (q?.teamMatePosition != null && q.teamMateQ3TimeSeconds != null && q.q3TimeSeconds != null) {
    teamMateQualifyingAdvantage = clamp((q.teamMateQ3TimeSeconds - q.q3TimeSeconds) / 0.5, -1, 1);
  }

  // -- Circuit Characteristics --
  const circuitLowOvertake = cc
    ? cc.overtakeDifficulty > 0.7
      ? 1
      : cc.overtakeDifficulty > 0.4
        ? normalizeRate(cc.overtakeDifficulty, 0.5)
        : -1
    : 0;
  const circuitQualifyingImportance = cc
    ? normalizeRate(cc.qualifyingImportance, 0.5)
    : 0;
  const circuitTyreStress = cc
    ? normalizeRate(cc.tyreStress, 0.5)
    : 0;
  const circuitStreetTrack = street ? 1 : 0;

  // -- Circuit History --
  const sameCircuitDriverWinRate = ch?.driverTotalRaces && ch.driverTotalRaces > 0
    ? normalizeRate(ch.driverWinCount / ch.driverTotalRaces, 0.05)
    : 0;
  const sameCircuitConstructorWinRate = ch?.constructorTotalRaces && ch.constructorTotalRaces > 0
    ? normalizeRate(ch.constructorWinCount / ch.constructorTotalRaces, 0.05)
    : 0;
  const sameCircuitPoleWinRate = ch?.poleWinConversionPct != null
    ? normalizeRate(ch.poleWinConversionPct / 100, 0.3)
    : 0;

  // -- Standings --
  const driverStandingAdvantage = ds
    ? normalizePosition(ds.position, ds.totalDrivers)
    : 0;
  const constructorStandingAdvantage = cs
    ? normalizePosition(cs.position, cs.totalDrivers)
    : 0;

  // -- Recent Form --
  const driverShortRecentWinRate = df && df.raceCount > 0
    ? normalizeRate(df.winCount / df.raceCount, 0.1)
    : 0;
  const constructorShortRecentWinRate = cf && cf.raceCount > 0
    ? normalizeRate(cf.winCount / cf.raceCount, 0.1)
    : 0;

  let driverSeqMomentum = 0;
  if (df?.last10Steps && df.last10Steps.length > 0) {
    const embed = buildRaceWinnerSequenceEmbedding(df.last10Steps);
    driverSeqMomentum = embed.momentum * 2 - 1;
  }
  let constructorSeqMomentum = 0;
  if (cf?.last10Steps && cf.last10Steps.length > 0) {
    const embed = buildRaceWinnerSequenceEmbedding(cf.last10Steps);
    constructorSeqMomentum = embed.momentum * 2 - 1;
  }

  let driverFinishTrend = 0;
  if (df?.finishPositions && df.finishPositions.length >= 2) {
    const trendInput = df.finishPositions.map((p) => 1 / Math.max(p, 1));
    driverFinishTrend = -computeTrend(trendInput);
  }

  let constructorFinishTrend = 0;
  if (cf?.finishPositions && cf.finishPositions.length >= 2) {
    const trendInput = cf.finishPositions.map((p) => 1 / Math.max(p, 1));
    constructorFinishTrend = -computeTrend(trendInput);
  }

  const driverRecentReliability = df && df.totalLapsPossible > 0
    ? normalizeRate(df.totalLapsCompleted / df.totalLapsPossible, 0.9)
    : 0;
  const constructorRecentReliability = normalizeRate(0.95, 0.9);

  // -- Practice --
  const bestTimes = p?.allFpBestTimesSeconds?.filter((t): t is number => t != null);
  const bestOverall = bestTimes && bestTimes.length > 0 ? Math.min(...bestTimes) : null;
  const driverTimes = [p?.fp1TimeSeconds, p?.fp2TimeSeconds, p?.fp3TimeSeconds]
    .filter((t): t is number => t != null);
  const driverBestTime = driverTimes.length > 0 ? Math.min(...driverTimes) : null;
  const fpBestAdvantage = driverBestTime != null && bestOverall != null
    ? clamp(1 - (driverBestTime - bestOverall) / 2, -1, 1)
    : 0;

  // -- Weather --
  const weatherRainRisk = w
    ? normalizeRate(w.rainRisk, 0.2)
    : 0;
  const weatherWind = w?.windSpeedMps != null
    ? normalizeLinear(w.windSpeedMps, 0, 15)
    : 0;
  const weatherHotTrack = w?.trackTempC != null
    ? (w.trackTempC > 40 ? 1 : w.trackTempC > 35 ? 0 : -1)
    : 0;
  const weatherCoolTrack = w?.trackTempC != null
    ? (w.trackTempC < 25 ? 1 : w.trackTempC < 30 ? 0 : -1)
    : 0;

  // -- Upgrades --
  const hasUpgrades = up != null && up.declaredUpgradeCount > 0;
  const upgradeProxy = hasUpgrades
    ? normalizeRate(Math.min(up.declaredUpgradeCount, 5) / 5, 0.15)
    : -1;
  const upgradeIntensity = up
    ? normalizeLinear(up.declaredUpgradeIntensity, 0, 35)
    : 0;
  const upgradeCount = up
    ? normalizeLinear(up.declaredUpgradeCount, 0, 10)
    : 0;
  const circuitSpecificIntent = up
    ? normalizeRate(up.circuitSpecificIntent, 0.2)
    : 0;

  // -- Round --
  const raceRoundProgress = normalizeLinear(input.round, 1, 24);

  // ======================================================================
  // Product helpers for two [-1,1] values (product is also in [-1,1])
  // ======================================================================
  const prod = (a: number, b: number): number => clamp(a * b, -1, 1);

  // ======================================================================
  // Build interaction features (24 computable + 14 TODOs)
  // ======================================================================
  return {
    // --- Grid x Circuit (all non-stub) ---
    gridPoleCircuitInteraction: prod(gridPole, circuitLowOvertake),
    gridFrontRowCircuitInteraction: prod(gridFrontRow, circuitQualifyingImportance),
    gridTop3CircuitInteraction: prod(gridTop3, circuitQualifyingImportance),

    // --- Familiarity x Form (all non-stub) ---
    driverCircuitFamiliarityInteraction: prod(
      sameCircuitDriverWinRate,
      driverShortRecentWinRate,
    ),
    constructorCircuitFamiliarityInteraction: prod(
      sameCircuitConstructorWinRate,
      constructorShortRecentWinRate,
    ),

    // --- Racecraft needs FastF1 driverChaosForm etc. (all stubs) ---
    chaosRacecraftInteraction: 0, // TODO: needs driverChaosForm from FastF1 analytics
    restartRacecraftInteraction: 0, // TODO: needs driverRestartProxyForm from FastF1 analytics
    safetyCarRacecraftInteraction: 0, // TODO: needs driverSafetyCarForm from FastF1 analytics
    redFlagRacecraftInteraction: 0, // TODO: needs driverRedFlagForm from FastF1 analytics

    // --- Tyre stress x Pace (non-stub) ---
    tyreStressPaceInteraction: prod(circuitTyreStress, qualifyingPaceAdvantage),

    // --- Strategy / restart needs FastF1 data (all stubs) ---
    postPitStrategyInteraction: 0, // TODO: needs driverPostPitPaceForm from FastF1 analytics
    restartPaceInteraction: 0, // TODO: needs driverRestartPaceForm from FastF1 analytics

    // --- Weather x Tyre (non-stub) ---
    weatherTyreInteraction: prod(weatherRainRisk, circuitTyreStress),

    // --- Upgrade x Form (all non-stub once upgrades are filled) ---
    upgradeTrendInteraction: prod(upgradeIntensity, constructorSeqMomentum),
    upgradePracticeInteraction: prod(upgradeCount, fpBestAdvantage),
    upgradeRacePaceInteraction: prod(upgradeProxy, qualifyingAdvantage),
    upgradeTrackFitInteraction: prod(circuitSpecificIntent, circuitStreetTrack),

    // --- Track type x Familiarity (non-stub) ---
    trackTypeFamiliarityInteraction: prod(circuitStreetTrack, sameCircuitDriverWinRate),

    // --- Qualifying x History (non-stub) ---
    qualifyingConversionInteraction: prod(qualifyingAdvantage, sameCircuitPoleWinRate),

    // --- Constructor x Qualifying (non-stub) ---
    constructorQualifyingInteraction: prod(constructorStandingAdvantage, qualifyingAdvantage),

    // --- Team mate x Driver standing (non-stub) ---
    driverTeamMateInteraction: prod(teamMateQualifyingAdvantage, driverStandingAdvantage),

    // --- Trends x Season (non-stub) ---
    driverTrendSeasonInteraction: prod(driverFinishTrend, raceRoundProgress),
    constructorTrendStrengthInteraction: prod(constructorFinishTrend, constructorStandingAdvantage),

    // --- Weather-form features need FastF1 aggregation pipeline (all stubs) ---
    driverSimilarWeatherForm: 0, // TODO: needs driver form in similar weather from FastF1 analytics
    constructorSimilarWeatherForm: 0, // TODO: needs constructor form in similar weather from FastF1 analytics
    driverRainWeatherForm: 0, // TODO: needs driver wet-pace form from FastF1 analytics
    constructorRainWeatherForm: 0, // TODO: needs constructor wet-pace form from FastF1 analytics
    driverHotTrackForm: 0, // TODO: needs driver hot-track tyre form from FastF1 analytics
    constructorHotTrackForm: 0, // TODO: needs constructor hot-track tyre form from FastF1 analytics
    driverCoolTrackForm: 0, // TODO: needs driver cool-track tyre form from FastF1 analytics
    constructorCoolTrackForm: 0, // TODO: needs constructor cool-track tyre form from FastF1 analytics

    // --- Weather x Reliability (all non-stub) ---
    driverWindWeatherReliability: prod(weatherWind, driverRecentReliability),
    constructorWindWeatherReliability: prod(weatherWind, constructorRecentReliability),
    rainDriverInteraction: prod(weatherRainRisk, driverRecentReliability),
    rainConstructorInteraction: prod(weatherRainRisk, constructorRecentReliability),
    hotTrackConstructorInteraction: prod(weatherHotTrack, constructorSeqMomentum),
    coolTrackDriverInteraction: prod(weatherCoolTrack, driverSeqMomentum),
    windReliabilityInteraction: prod(weatherWind, driverRecentReliability),
  };
}

// ============================================================================
// Main Orchestrator
// ============================================================================

function mergeFeatures(
  ...sources: Partial<WinnerPredictionFeatureVector>[]
): WinnerPredictionFeatureVector {
  const result: Record<string, number> = Object.fromEntries(
    WINNER_PREDICTION_FEATURES.map((f) => [f, 0]),
  );
  for (const feat of WINNER_PREDICTION_FEATURES) {
    for (const source of sources) {
      if (feat in source && source[feat] != null) {
        result[feat] = clamp(source[feat]!, -1, 1);
        break;
      }
    }
  }
  return result as WinnerPredictionFeatureVector;
}

/**
 * Build a complete 174-dimension feature vector from available data.
 * Missing data groups default all their features to 0 (the model's neutral value).
 */
export function buildWinnerFeatureVector(
  input: WinnerFeatureInput,
): WinnerPredictionFeatureVector {
  const sources: Partial<WinnerPredictionFeatureVector>[] = [];

  // Tier 1: Always-available features
  sources.push(
    input.qualifying
      ? buildQualifyingFeatures(input.qualifying)
      : buildQualifyingFeatures({ position: 10, totalDrivers: 20, allPositions: Array.from({ length: 20 }, (_, i) => i + 1) }),
  );

  sources.push(
    input.driverStanding && input.constructorStanding
      ? buildStandingsFeatures(input.driverStanding, input.constructorStanding)
      : {},
  );

  sources.push(
    input.circuitHistory
      ? buildCircuitHistoryFeatures(input.circuitHistory)
      : {},
  );

  sources.push(
    input.circuitCharacteristics
      ? buildCircuitCharacteristicsFeatures(input.circuitCharacteristics)
      : {},
  );

  sources.push(
    input.sprint
      ? buildSprintFeatures(input.sprint)
      : {},
  );

  sources.push(
    buildRoundProgressFeature(input.round, 24),
  );

  // Tier 2: Practice
  sources.push(
    input.practice
      ? buildPracticeFeatures(input.practice)
      : {},
  );

  // Tier 3: Sequence / Momentum
  if (input.driverRecentForm && input.constructorRecentForm) {
    const seq = buildRaceWinnerSequenceEmbedding(input.driverRecentForm.last10Steps);
    sources.push(buildSequenceFeatures(seq, input.driverRecentForm, input.constructorRecentForm));
  } else {
    // Neutral sequence embedding for missing data
    const neutralEmbedding: RaceWinnerSequenceEmbedding = { momentum: 0.5, consistency: 0.5, upside: 0.5 };
    const emptyForm: DriverRecentForm = {
      last10Steps: [], finishPositions: [], qualifyingPositions: [],
      winCount: 0, podiumCount: 0, raceCount: 1, dnfCount: 0,
      totalLapsCompleted: 1, totalLapsPossible: 1,
    };
    const emptyCForm: ConstructorRecentForm = {
      last10Steps: [], finishPositions: [],
      winCount: 0, podiumCount: 0, raceCount: 1,
    };
    sources.push(buildSequenceFeatures(neutralEmbedding, emptyForm, emptyCForm));
  }

  // Tier 4: Upgrades
  sources.push(buildUpgradeFeatures(input.upgrades, input.circuitCharacteristics?.isStreetCircuit));

  // Tier 4: Weather
  sources.push(buildWeatherFeatures(input.weather));

  // Tier 4: FastF1
  sources.push(buildFastF1Features(input.fastf1Analytics));

  // Tier 4: Interactions
  sources.push(buildInteractionFeatures(input));

  return mergeFeatures(...sources);
}

// ============================================================================
// Convenience: Build Candidates for a Race
// ============================================================================

/**
 * Build WinnerPredictionCandidate[] for all drivers in a race.
 * During training, pass knownWinnerDriverId to mark the actual winner.
 * During inference, omit knownWinnerDriverId.
 */
export function buildWinnerCandidates(
  raceKey: string,
  driverInputs: WinnerFeatureInput[],
  knownWinnerDriverId?: string,
): WinnerPredictionCandidate[] {
  return driverInputs.map((input) => ({
    raceKey,
    driverId: input.driverId,
    constructorId: input.constructorId,
    winner: knownWinnerDriverId != null
      ? input.driverId === knownWinnerDriverId
      : false,
    features: buildWinnerFeatureVector(input),
  }));
}

// ============================================================================
// Diagnostic
// ============================================================================

export interface AvailableFeatureGroups {
  grid: boolean;
  practice: boolean;
  standings: boolean;
  sequence: boolean;
  circuitHistory: boolean;
  circuitCharacteristics: boolean;
  sprint: boolean;
  upgrades: boolean;
  weather: boolean;
  fastF1: boolean;
}

export function getAvailableFeatureGroups(
  input: WinnerFeatureInput,
): AvailableFeatureGroups {
  return {
    grid: input.qualifying != null,
    practice: input.practice != null,
    standings: input.driverStanding != null && input.constructorStanding != null,
    sequence: input.driverRecentForm != null && input.constructorRecentForm != null,
    circuitHistory: input.circuitHistory != null,
    circuitCharacteristics: input.circuitCharacteristics != null,
    sprint: (input.sprint?.isSprintWeekend ?? false) && input.sprint != null,
    upgrades: input.upgrades != null,
    weather: input.weather != null,
    fastF1: input.fastf1Analytics != null,
  };
}
