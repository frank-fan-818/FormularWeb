/**
 * Compare prediction accuracy with vs without FastF1 features on 2025 data.
 *
 * Usage: npx tsx scripts/eval-fastf1-features.ts
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  WINNER_PREDICTION_FEATURES,
  evaluateWinnerPredictions,
  trainWinnerPredictionModel,
  type WinnerPredictionCandidate,
} from '../src/utils/raceWinnerPrediction.ts';
import {
  trainNonlinearWinnerPredictionModel,
  scoreNonlinearWinnerCandidate,
  type NonlinearWinnerPredictionModel,
} from '../src/utils/raceWinnerNonlinearPrediction.ts';
import { buildRaceWinnerSequenceEmbedding } from '../src/utils/raceWinnerSequenceModel.ts';

// ============================================================================
// Config
// ============================================================================

const DATA_ROOT = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons');
const FASTF1_ROOT = path.join(process.cwd(), 'public', 'fastf1');

// Domain-driven engineered features (beyond base 172)
const ENGINEERED_FEATURES = [
  'trait_NonPoleWinRate',       // Win rate when gridPos > 1 (2022-2024)
  'trait_RaceVsQualiDelta',     // avg(racePos - qualiPos), positive = race better
  'trait_WetPerformance',       // avg finish position in wet races
  'trait_StreetVsPermanent',    // street circuit win rate / permanent win rate
  'trait_LateSeasonSprint',     // last 6 vs first 6 race win rate ratio
  'trait_TopTeamPerformance',   // avg finish vs top-3 constructors
  'trait_Lap1Gain',             // avg positions gained on lap 1
  'trait_TyreManagement',       // avg laps per stint from FastF1
] as const;

const ALL_FEATURES = [...WINNER_PREDICTION_FEATURES, ...ENGINEERED_FEATURES] as const;
console.log(`Feature count: ${WINNER_PREDICTION_FEATURES.length} base + ${ENGINEERED_FEATURES.length} traits = ${ALL_FEATURES.length} total`);

// ============================================================================
// Driver Fixed Traits (computed once from 2022-2024, stable across races)
// ============================================================================

interface DriverTraits {
  nonPoleWinRate: number;
  raceVsQualiDelta: number;
  wetPerformance: number;
  streetVsPermanent: number;
  lateSeasonSprint: number;
  topTeamPerformance: number;
  lap1Gain: number;
  tyreManagement: number;
}

type DriverTraitKey = keyof DriverTraits;
const TRAIT_DEFAULTS: DriverTraits = {
  nonPoleWinRate: 0, raceVsQualiDelta: 0, wetPerformance: 0,
  streetVsPermanent: 0, lateSeasonSprint: 0, topTeamPerformance: 0,
  lap1Gain: 0, tyreManagement: 0,
};

const driverTraitsCache = new Map<string, DriverTraits>();

function computeDriverTraits() {
  // Process 2022-2024 races (sorted chronologically)
  const historyRaces = [...loadSeason(2022), ...loadSeason(2023), ...loadSeason(2024)]
    .sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);

  // Per-driver accumulators
  const acc = new Map<string, {
    totalRaces: number; nonPoleRaces: number; nonPoleWins: number;
    racePositions: number[]; qualiPositions: number[];
    wetRaces: number[]; streetRaces: number[]; permanentRaces: number[];
    streetWins: number; permanentWins: number;
    earlyRaces: number[]; lateRaces: number[];
    earlyWins: number; lateWins: number;
    vsTop3Positions: number[]; lap1Gains: number[];
    pitLaps: number[]; pitStops: number;
  }>();

  // Initialize
  for (const race of historyRaces) {
    for (const result of race.results) {
      if (!acc.has(result.driverId)) {
        acc.set(result.driverId, {
          totalRaces: 0, nonPoleRaces: 0, nonPoleWins: 0,
          racePositions: [], qualiPositions: [],
          wetRaces: [], streetRaces: [], permanentRaces: [],
          streetWins: 0, permanentWins: 0,
          earlyRaces: [], lateRaces: [],
          earlyWins: 0, lateWins: 0,
          vsTop3Positions: [], lap1Gains: [],
          pitLaps: [], pitStops: 0,
        });
      }
    }
  }

  // Collect data
  const streetCircuits = new Set(['monaco', 'baku', 'singapore', 'jeddah', 'miami', 'las_vegas', 'albert_park', 'montreal']);
  const top3Constructors = new Set<string>();

  for (const race of historyRaces) {
    // Find top 3 constructors for this race (by standings)
    const cs = race.constructorStandings.slice(0, 3).map((s) => s.constructorId);
    top3Constructors.clear();
    cs.forEach((c) => top3Constructors.add(c));

    const fastf1 = loadFastF1(race.season, race.round);
    const isWet = (fastf1?.weather?.summary?.rainPointCount ?? 0) > 10;
    const isStreet = streetCircuits.has(race.circuitId);
    const isLateSeason = race.round > (race.season === 2024 ? 18 : 16); // ~last 6 races

    for (const result of race.results) {
      const d = acc.get(result.driverId)!;
      const pos = num(result.position) || 20;
      const gridPos = num(result.gridPosition) || pos;
      const winner = pos === 1;

      d.totalRaces++;
      d.racePositions.push(pos);
      d.qualiPositions.push(gridPos);

      if (gridPos > 1) { d.nonPoleRaces++; if (winner) d.nonPoleWins++; }
      if (isWet) d.wetRaces.push(pos);
      if (isStreet) { d.streetRaces.push(pos); if (winner) d.streetWins++; }
      else { d.permanentRaces.push(pos); if (winner) d.permanentWins++; }
      if (isLateSeason) { d.lateRaces.push(pos); if (winner) d.lateWins++; }
      else { d.earlyRaces.push(pos); if (winner) d.earlyWins++; }
      if (top3Constructors.has(result.constructorId)) d.vsTop3Positions.push(pos);
      d.lap1Gains.push(gridPos - pos); // simplified: grid→finish as proxy for lap1

      // Tyre management: collect pit stop data from FastF1
      if (fastf1) {
        const strategy = fastf1.tyreStrategies?.find(
          (t) => t.driverId === result.driverId || t.driver === result.driverId,
        );
        if (strategy) {
          for (const stint of strategy.stints) {
            d.pitLaps.push(stint.lapCount ?? stint.endLap - stint.startLap);
            d.pitStops++;
          }
        }
      }
    }
  }

  // Compute traits
  for (const [driverId, d] of acc) {
    if (d.totalRaces < 5) { driverTraitsCache.set(driverId, TRAIT_DEFAULTS); continue; }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 20;
    const winRate = (wins: number, races: number) => races > 0 ? wins / races : 0;

    driverTraitsCache.set(driverId, {
      nonPoleWinRate: d.nonPoleRaces > 0 ? clamp(d.nonPoleWins / d.nonPoleRaces * 5 - 1) : 0,
      raceVsQualiDelta: clamp((avg(d.racePositions) - avg(d.qualiPositions)) / 5 * -1), // negative = gained
      wetPerformance: d.wetRaces.length > 0 ? ns(Math.round(avg(d.wetRaces)), 20) : 0,
      streetVsPermanent: clamp(
        (winRate(d.streetWins, d.streetRaces.length) - winRate(d.permanentWins, d.permanentRaces.length)) * 3,
      ),
      lateSeasonSprint: clamp((winRate(d.lateWins, d.lateRaces.length) - winRate(d.earlyWins, d.earlyRaces.length)) * 3),
      topTeamPerformance: d.vsTop3Positions.length > 0 ? ns(Math.round(avg(d.vsTop3Positions)), 20) : 0,
      lap1Gain: d.lap1Gains.length > 0 ? clamp(avg(d.lap1Gains) / 5 * -1) : 0,
      tyreManagement: d.pitStops > 0 ? clamp(avg(d.pitLaps) / 30 - 1) : 0, // 30 laps/stint → 0, 50+ → +1
    });
  }

  // Log top traits
  console.log('\n=== Top Driver Traits ===');
  const topDrivers = [...driverTraitsCache.entries()]
    .filter(([, t]) => t.nonPoleWinRate !== 0 || t.raceVsQualiDelta !== 0)
    .sort(([, a], [, b]) => b.nonPoleWinRate - a.nonPoleWinRate)
    .slice(0, 8);
  for (const [did, t] of topDrivers) {
    console.log(`  ${did.padEnd(20)} nonPoleWin=${t.nonPoleWinRate.toFixed(2)} raceVsQ=${t.raceVsQualiDelta.toFixed(2)} wet=${t.wetPerformance.toFixed(2)} lap1=${t.lap1Gain.toFixed(2)}`);
  }
}

// Build extended feature list (172 base + interaction features)
const TRAIN_RACES = 18; // Train on first 18 races of 2025

// ============================================================================
// YAML helpers
// ============================================================================

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}
function readYaml<T>(filePath: string): T | null {
  try { return YAML.parse(readFileSync(filePath, 'utf8')) as T; } catch { return null; }
}
function timeToSeconds(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  return parseFloat(time) || null;
}

// ============================================================================
// Load f1db YAML data
// ============================================================================

interface ResultYaml { position?: number | string | null; driverId: string; constructorId: string; points?: number | string | null; gridPosition?: number | string | null; laps?: number | string | null; reasonRetired?: string | null; }
interface QualifyingYaml { position?: number | string | null; driverId: string; constructorId: string; q1?: string | null; q2?: string | null; q3?: string | null; }
interface PracticeYaml { position?: number | string | null; driverId: string; constructorId: string; time?: string | null; laps?: number | string | null; }
interface StandingYaml { position?: number | string | null; driverId: string; constructorId: string; points?: number | string | null; wins?: number | string | null; }

interface RaceData {
  season: number; round: number; circuitId: string;
  results: ResultYaml[]; qualifying: QualifyingYaml[];
  fp1: PracticeYaml[]; fp2: PracticeYaml[]; fp3: PracticeYaml[];
  sprintResults: ResultYaml[]; sprintQualifying: QualifyingYaml[];
  driverStandings: StandingYaml[]; constructorStandings: StandingYaml[];
}

function loadSeason(season: number): RaceData[] {
  const seasonDir = path.join(DATA_ROOT, String(season));
  if (!existsSync(seasonDir)) return [];
  const racesDir = path.join(seasonDir, 'races');
  const raceDirs = readdirSync(racesDir).filter((d) => /^\d{2}-/.test(d));
  const races: RaceData[] = [];
  for (const dir of raceDirs) {
    const rp = path.join(racesDir, dir);
    const raceYaml = readYaml<{ round: number; circuitId: string }>(path.join(rp, 'race.yml'));
    if (!raceYaml) continue;
    races.push({
      season, round: raceYaml.round, circuitId: raceYaml.circuitId,
      results: readYaml<ResultYaml[]>(path.join(rp, 'race-results.yml')) ?? [],
      qualifying: readYaml<QualifyingYaml[]>(path.join(rp, 'qualifying-results.yml')) ?? [],
      fp1: readYaml<PracticeYaml[]>(path.join(rp, 'free-practice-1-results.yml')) ?? [],
      fp2: readYaml<PracticeYaml[]>(path.join(rp, 'free-practice-2-results.yml')) ?? [],
      fp3: readYaml<PracticeYaml[]>(path.join(rp, 'free-practice-3-results.yml')) ?? [],
      sprintResults: readYaml<ResultYaml[]>(path.join(rp, 'sprint-results.yml')) ?? [],
      sprintQualifying: (readYaml<QualifyingYaml[]>(path.join(rp, 'sprint-qualifying-results.yml'))
        ?? readYaml<QualifyingYaml[]>(path.join(rp, 'sprint-shootout-results.yml'))
        ?? []),
      driverStandings: readYaml<StandingYaml[]>(path.join(rp, 'driver-standings.yml')) ?? [],
      constructorStandings: readYaml<StandingYaml[]>(path.join(rp, 'constructor-standings.yml')) ?? [],
    });
  }
  return races.sort((a, b) => a.round - b.round);
}

// ============================================================================
// Load FastF1 JSON
// ============================================================================

interface FastF1SessionResult { driver: string; driverId: string; team: string; position: number; gridPosition: number; timeSeconds: number; status: string; points: number; laps: number; }
interface FastF1LapPoint { lapNumber: number; lapTimeSeconds: number; compound: string; stint: number; position: number; freshTyre: boolean; tyreLife: number; }
interface FastF1DriverLapSeries { driver: string; team: string; laps: FastF1LapPoint[]; }
interface FastF1TrackStatusPeriod { type: string; label: string; startLap: number; endLap: number; }
interface FastF1TelemetryDriver { driver: string; team: string; maxSpeedKph: number; avgSpeedKph: number; fullThrottlePct: number; avgThrottlePct: number; brakePct: number; drsPct: number; }
interface FastF1StrategyStint { stint: number; compound: string; startLap: number; endLap: number; lapCount: number; freshTyre: boolean; tyreLife: number; }
interface FastF1DriverStrategy { driver: string; team: string; racePosition: number; stints: FastF1StrategyStint[]; }
interface FastF1WeatherSummary { airTempC?: { average?: number }; trackTempC?: { average?: number }; humidityPct?: { average?: number }; rainPointCount?: number; maxWindSpeedMps?: number; }

interface FastF1RacePayload {
  sessionResults: FastF1SessionResult[];
  lapTimeSeries: FastF1DriverLapSeries[];
  trackStatusPeriods: FastF1TrackStatusPeriod[];
  telemetrySummary: FastF1TelemetryDriver[];
  tyreStrategies: FastF1DriverStrategy[];
  weather: { summary?: FastF1WeatherSummary };
  fastestLap?: { driver: string; lapNumber: number; lapTimeSeconds: number };
}

function loadFastF1(season: number, round: number): FastF1RacePayload | null {
  const filePath = path.join(FASTF1_ROOT, String(season), String(round), 'R.json');
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, 'utf8')) as FastF1RacePayload; } catch { return null; }
}

// ============================================================================
// FastF1 Rolling History (past races only — no data leakage)
// ============================================================================

interface FastF1DriverMetrics {
  longRunPace: number;
  tyreConsistency: number;
  gridGain: number;
  maxSpeedKph: number;
  qualifyingConversion: number;
  stintCount: number;
  fastestLap: number;
}

interface FastF1HistoryEntry { season: number; round: number; metrics: FastF1DriverMetrics; }

const driverFastF1History = new Map<string, FastF1HistoryEntry[]>();

// Map FastF1 short IDs to f1db kebab-case IDs
function buildFastF1ToF1dbMap(f1: FastF1RacePayload, f1dbResults: ResultYaml[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of f1.sessionResults) {
    const fastF1Id = r.driverId;
    if (f1dbResults.some((rr) => rr.driverId === fastF1Id)) { map.set(fastF1Id, fastF1Id); continue; }
    const lastName = r.lastName?.toLowerCase() || '';
    const fullName = `${r.firstName?.toLowerCase() || ''}-${lastName}`;
    for (const rr of f1dbResults) {
      if (rr.driverId === fullName || rr.driverId.includes(lastName)) { map.set(fastF1Id, rr.driverId); break; }
    }
  }
  return map;
}

// Extract raw FastF1 metrics for a single driver
function extractRawMetrics(f1: FastF1RacePayload, fastF1Id: string): FastF1DriverMetrics | null {
  const result = f1.sessionResults.find((r) => r.driverId === fastF1Id || r.driver === fastF1Id);
  if (!result) return null;
  const laps = f1.lapTimeSeries?.find((l) => l.driverId === fastF1Id || l.driver === fastF1Id);
  const telemetry = f1.telemetrySummary?.find((t) => t.driverId === fastF1Id || t.driver === fastF1Id);
  const strategy = f1.tyreStrategies?.find((t) => t.driverId === fastF1Id || t.driver === fastF1Id);

  let longRunPace = 0;
  if (laps) {
    const valid = laps.laps?.filter((l) => l.lapTimeSeconds > 0 && l.lapTimeSeconds < 200) ?? [];
    if (valid.length > 0) longRunPace = valid.reduce((s, l) => s + l.lapTimeSeconds, 0) / valid.length;
  }

  let tyreConsistency = 0;
  if (laps) {
    const valid = laps.laps?.filter((l) => l.lapTimeSeconds > 0 && l.lapTimeSeconds < 200) ?? [];
    if (valid.length > 1) {
      const avg = valid.reduce((s, l) => s + l.lapTimeSeconds, 0) / valid.length;
      tyreConsistency = Math.sqrt(valid.reduce((s, l) => s + (l.lapTimeSeconds - avg) ** 2, 0) / valid.length) / avg;
    }
  }

  return {
    longRunPace,
    tyreConsistency,
    gridGain: (num(result.gridPosition) || 0) - (num(result.position) || 0),
    maxSpeedKph: telemetry?.maxSpeedKph ?? 0,
    qualifyingConversion: (num(result.gridPosition) || 0) - (num(result.position) || 0),
    stintCount: strategy?.stints?.length ?? 1,
    fastestLap: f1.fastestLap?.driver === fastF1Id || f1.fastestLap?.driver === result.driver ? 1 : 0,
  };
}

// Compute team-relative metrics: driver - teamMate
// Positive = driver outperformed team mate
function makeRelative(driver: FastF1DriverMetrics, mate: FastF1DriverMetrics): FastF1DriverMetrics {
  const rel = (d: number, m: number) => m !== 0 ? clamp((d - m) / (Math.abs(m) + 0.001) * 2) : 0;
  const relDiff = (d: number, m: number) => clamp((d - m) / 5); // simple diff, clamped
  return {
    longRunPace: -rel(driver.longRunPace, mate.longRunPace), // negative = faster (invert for "higher=better")
    tyreConsistency: -rel(driver.tyreConsistency, mate.tyreConsistency), // lower CV = more consistent
    gridGain: relDiff(driver.gridGain, mate.gridGain),
    maxSpeedKph: rel(driver.maxSpeedKph, mate.maxSpeedKph),
    qualifyingConversion: relDiff(driver.qualifyingConversion, mate.qualifyingConversion),
    stintCount: relDiff(driver.stintCount, mate.stintCount),
    fastestLap: clamp(driver.fastestLap - mate.fastestLap + 0.5), // +0.5 if driver got FL and mate didn't
  };
}

function getDriverFastF1Rolling(driverId: string, maxRaces = 5): FastF1DriverMetrics | null {
  const history = driverFastF1History.get(driverId);
  if (!history || history.length === 0) return null;
  const recent = history.slice(-maxRaces);
  const n = recent.length;
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / n;
  return {
    longRunPace: avg(recent.map((r) => r.metrics.longRunPace)),
    tyreConsistency: avg(recent.map((r) => r.metrics.tyreConsistency)),
    gridGain: avg(recent.map((r) => r.metrics.gridGain)),
    maxSpeedKph: avg(recent.map((r) => r.metrics.maxSpeedKph)),
    qualifyingConversion: avg(recent.map((r) => r.metrics.qualifyingConversion)),
    stintCount: avg(recent.map((r) => r.metrics.stintCount)),
    fastestLap: avg(recent.map((r) => r.metrics.fastestLap)),
  };
}

// ============================================================================
// Feature Engineering
// ============================================================================

interface DriverHistoryEntry { finishPosition: number; gridPosition: number; winner: boolean; podium: boolean; dnf: boolean; lapsCompleted: number; totalLaps: number; }

// Normalization
function ns(p: number, t: number): number { return t > 1 ? 1 - (2 * (p - 1)) / (t - 1) : 0; }
function nrate(r: number, neu: number): number { return r >= neu ? Math.min(1, (r - neu) / (1 - neu)) : Math.max(-1, (r - neu) / neu); }
function clamp(v: number): number { return Math.max(-1, Math.min(1, v)); }
function zscore(v: number, vals: number[]): number {
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / vals.length) || 1;
  return clamp((v - avg) / (std * 3));
}

const CIRCUIT_PROFILES: Record<string, { isStreetCircuit: boolean; overtakeDifficulty: number; tyreStress: number; restartRisk: number; qualifyingImportance: number }> = {
  monaco: { isStreetCircuit: true, overtakeDifficulty: 0.95, tyreStress: 0.3, restartRisk: 0.4, qualifyingImportance: 0.95 },
  baku: { isStreetCircuit: true, overtakeDifficulty: 0.7, tyreStress: 0.4, restartRisk: 0.5, qualifyingImportance: 0.8 },
  singapore: { isStreetCircuit: true, overtakeDifficulty: 0.85, tyreStress: 0.6, restartRisk: 0.6, qualifyingImportance: 0.85 },
  jeddah: { isStreetCircuit: true, overtakeDifficulty: 0.65, tyreStress: 0.5, restartRisk: 0.4, qualifyingImportance: 0.7 },
  miami: { isStreetCircuit: true, overtakeDifficulty: 0.6, tyreStress: 0.5, restartRisk: 0.3, qualifyingImportance: 0.6 },
  las_vegas: { isStreetCircuit: true, overtakeDifficulty: 0.55, tyreStress: 0.4, restartRisk: 0.3, qualifyingImportance: 0.55 },
  albert_park: { isStreetCircuit: true, overtakeDifficulty: 0.7, tyreStress: 0.5, restartRisk: 0.4, qualifyingImportance: 0.75 },
  montreal: { isStreetCircuit: true, overtakeDifficulty: 0.65, tyreStress: 0.35, restartRisk: 0.5, qualifyingImportance: 0.7 },
};
const DEFAULT_CIRCUIT = { isStreetCircuit: false, overtakeDifficulty: 0.5, tyreStress: 0.5, restartRisk: 0.3, qualifyingImportance: 0.5 };

function buildFeatures(
  race: RaceData,
  result: ResultYaml,
  driverHistory: DriverHistoryEntry[],
  constructorHistory: DriverHistoryEntry[],
  fastf1: FastF1RacePayload | null,
  includeFastF1: boolean,
  f1ToF1db?: Map<string, string>,
): Record<string, number> {
  const driverId = result.driverId;
  const constructorId = result.constructorId;
  const pos = num(result.position) || 20;
  const gridPos = num(result.gridPosition) || pos;
  const totalDrivers = race.results.length;
  const feats: Record<string, number> = {};

  // ---- Qualifying ----
  const qResult = race.qualifying.find((q) => q.driverId === driverId);
  const allQ3Times = race.qualifying.map((q) => timeToSeconds(q.q3)).filter((t): t is number => t != null);
  const teamMate = race.results.find((r) => r.constructorId === constructorId && r.driverId !== driverId);
  const teamMateQ = teamMate ? race.qualifying.find((q) => q.driverId === teamMate.driverId) : null;
  const qPos = qResult ? (num(qResult.position) || gridPos) : gridPos;

  feats.gridAdvantage = ns(gridPos, totalDrivers);
  feats.gridPole = gridPos === 1 ? 1 : 0;
  feats.gridFrontRow = gridPos <= 2 ? 1 : 0;
  feats.gridTop3 = gridPos <= 3 ? 1 : 0;
  feats.poleModelProbability = gridPos === 1 ? 1 : gridPos <= 3 ? 0.6 : Math.max(0, 1 - (gridPos - 1) / totalDrivers);
  feats.poleModelRankAdvantage = ns(gridPos, totalDrivers);
  feats.poleModelScore = gridPos === 1 ? 2 : gridPos <= 3 ? 1 : ns(gridPos, totalDrivers);
  feats.qualifyingAdvantage = ns(qPos, totalDrivers);
  feats.qualifyingPole = qPos === 1 ? 1 : 0;
  feats.qualifyingFrontRow = qPos <= 2 ? 1 : 0;

  if (allQ3Times.length > 0 && qResult?.q3) {
    const q3t = timeToSeconds(qResult.q3);
    const best = Math.min(...allQ3Times);
    if (q3t != null) {
      const gap = q3t - best;
      feats.qualifyingPaceAdvantage = clamp(1 - gap / 2);
      feats.qualifyingPaceSharpAdvantage = gap < 0.1 ? 1 : gap < 0.3 ? 0.5 : 0;
    }
  }
  if (teamMateQ?.q3 && qResult?.q3) {
    const mateT = timeToSeconds(teamMateQ.q3);
    const myT = timeToSeconds(qResult.q3);
    if (mateT != null && myT != null) feats.teamMateQualifyingAdvantage = clamp((mateT - myT) / 0.5);
  }

  // ---- Standings ----
  const ds = race.driverStandings.find((s) => s.driverId === driverId);
  const cs = race.constructorStandings.find((s) => s.constructorId === constructorId);
  const dPos = ds ? (num(ds.position) || totalDrivers) : totalDrivers;
  const cPts = num(cs?.points) || 0;

  feats.driverStandingAdvantage = ns(dPos, totalDrivers);
  feats.driverStandingPointsShare = clamp((num(ds?.points || 0) / totalDrivers - 10) / 50);
  feats.constructorStandingAdvantage = ns(cs ? (num(cs.position) || 10) : 10, 10);
  feats.constructorStandingPointsShare = clamp((cPts / 10 - 10) / 50);
  feats.driverSeasonWinRate = totalDrivers > 0 ? nrate(num(ds?.wins || 0) / totalDrivers, 0.1) : 0;
  feats.constructorSeasonWinRate = 10 > 0 ? nrate(num(cs?.wins || 0) / 10, 0.1) : 0;

  // ---- Practice ----
  const fp1R = race.fp1.find((r) => r.driverId === driverId);
  const fp2R = race.fp2.find((r) => r.driverId === driverId);
  const fp3R = race.fp3.find((r) => r.driverId === driverId);
  const allFpBest = race.fp2.map((r) => timeToSeconds(r.time)).filter((t): t is number => t != null);
  const driverBestFp = [timeToSeconds(fp1R?.time), timeToSeconds(fp2R?.time), timeToSeconds(fp3R?.time)].filter((t): t is number => t != null);
  const myBest = driverBestFp.length > 0 ? Math.min(...driverBestFp) : null;
  const fieldBest = allFpBest.length > 0 ? Math.min(...allFpBest) : null;

  if (fieldBest != null) {
    feats.fp1Advantage = timeToSeconds(fp1R?.time) != null ? clamp(1 - (timeToSeconds(fp1R.time)! - fieldBest) / 2) : 0;
    feats.fp2Advantage = timeToSeconds(fp2R?.time) != null ? clamp(1 - (timeToSeconds(fp2R.time)! - fieldBest) / 2) : 0;
    feats.fp3Advantage = timeToSeconds(fp3R?.time) != null ? clamp(1 - (timeToSeconds(fp3R.time)! - fieldBest) / 2) : 0;
    feats.fpBestAdvantage = myBest != null ? clamp(1 - (myBest - fieldBest) / 2) : 0;
    feats.fpBestGapAdvantage = myBest != null ? clamp(1 - (myBest - fieldBest) / 0.5) : 0;
  }
  if (allFpBest.length > 0 && myBest != null) {
    feats.fpAverageAdvantage = zscore(myBest * -1, allFpBest.map((t) => t * -1));
  }
  const teamMateFp = teamMate ? race.fp2.find((r) => r.driverId === teamMate.driverId) : null;
  if (teamMateFp && myBest != null && timeToSeconds(teamMateFp.time) != null) {
    feats.fpTeamMateAdvantage = clamp((timeToSeconds(teamMateFp.time)! - myBest) / 0.5);
  }

  // ---- Sprint ----
  const sprintResult = race.sprintResults.find((r) => r.driverId === driverId);
  const sprintQResult = race.sprintQualifying.find((r) => r.driverId === driverId);
  feats.sprintWeekend = race.sprintResults.length > 0 ? 1 : 0;
  if (sprintResult && race.sprintResults.length > 1) {
    feats.sprintFinishAdvantage = ns(num(sprintResult.position) || 20, race.sprintResults.length);
  }
  if (sprintQResult && race.sprintQualifying.length > 1) {
    feats.sprintQualifyingAdvantage = ns(num(sprintQResult.position) || 20, race.sprintQualifying.length);
  }

  // ---- Round progress ----
  feats.raceRoundProgress = (2 * (race.round - 1)) / 23 - 1;

  // ---- Circuit characteristics ----
  const cc = CIRCUIT_PROFILES[race.circuitId] ?? DEFAULT_CIRCUIT;
  feats.circuitStreetTrack = cc.isStreetCircuit ? 1 : 0;
  feats.circuitLowOvertake = cc.overtakeDifficulty > 0.7 ? 1 : cc.overtakeDifficulty > 0.4 ? nrate(cc.overtakeDifficulty, 0.5) : -1;
  feats.circuitTyreStress = nrate(cc.tyreStress, 0.5);
  feats.circuitRestartRisk = nrate(cc.restartRisk, 0.3);
  feats.circuitQualifyingImportance = nrate(cc.qualifyingImportance, 0.5);

  // ---- Sequence features ----
  const recentDriver = driverHistory.slice(-10);
  const recentConstructor = constructorHistory.slice(-10);
  if (recentDriver.length > 0) {
    const steps = recentDriver.map((r) => ({
      finishAdvantage: r.winner ? 1 : r.podium ? 0.6 : Math.max(0, 1 - (r.finishPosition - 1) / 20),
      qualifyingAdvantage: Math.max(0, 1 - (r.gridPosition - 1) / 20),
      podium: r.podium ? 1 : 0, win: r.winner ? 1 : 0, reliability: r.dnf ? 0 : 1,
    }));
    const seq = buildRaceWinnerSequenceEmbedding(steps);
    feats.driverSequenceMomentum = seq.momentum * 2 - 1;
    feats.driverSequenceConsistency = seq.consistency * 2 - 1;
    feats.driverSequenceUpside = seq.upside * 2 - 1;

    const csteps = recentConstructor.map((r) => ({
      finishAdvantage: r.winner ? 1 : r.podium ? 0.6 : Math.max(0, 1 - (r.finishPosition - 1) / 20),
      qualifyingAdvantage: Math.max(0, 1 - (r.gridPosition - 1) / 20),
      podium: r.podium ? 1 : 0, win: r.winner ? 1 : 0, reliability: r.dnf ? 0 : 1,
    }));
    const cseq = buildRaceWinnerSequenceEmbedding(csteps);
    feats.constructorSequenceMomentum = cseq.momentum * 2 - 1;
    feats.constructorSequenceConsistency = cseq.consistency * 2 - 1;
    feats.constructorSequenceUpside = cseq.upside * 2 - 1;

    feats.driverRecentWinRate = nrate(recentDriver.filter((r) => r.winner).length / recentDriver.length, 0.1);
    feats.driverRecentPodiumRate = nrate(recentDriver.filter((r) => r.podium).length / recentDriver.length, 0.3);
    feats.driverShortRecentWinRate = nrate(recentDriver.filter((r) => r.winner).length / recentDriver.length, 0.1);
    feats.driverLongRecentWinRate = nrate(recentDriver.filter((r) => r.winner).length / Math.max(recentDriver.length, 1), 0.05);
    const avgFinish = recentDriver.reduce((s, r) => s + r.finishPosition, 0) / recentDriver.length;
    feats.driverRecentFinishForm = ns(Math.round(avgFinish), 20);

    let lapsDone = 0, lapsTotal = 0;
    for (const r of recentDriver) { lapsDone += r.lapsCompleted; lapsTotal += r.totalLaps; }
    feats.driverRecentReliability = lapsTotal > 0 ? nrate(lapsDone / lapsTotal, 0.9) : 0;

    // Constructor form
    feats.constructorShortRecentWinRate = recentConstructor.length > 0
      ? nrate(recentConstructor.filter((r) => r.winner).length / recentConstructor.length, 0.1) : 0;
    feats.constructorRecentPodiumRate = recentConstructor.length > 0
      ? nrate(recentConstructor.filter((r) => r.podium).length / recentConstructor.length, 0.3) : 0;
    feats.constructorRecentWinRate = recentConstructor.length > 0
      ? nrate(recentConstructor.filter((r) => r.winner).length / recentConstructor.length, 0.1) : 0;
    feats.constructorLongRecentWinRate = recentConstructor.length > 0
      ? nrate(recentConstructor.filter((r) => r.winner).length / Math.max(recentConstructor.length, 1), 0.05) : 0;
    if (recentConstructor.length > 0) {
      const cAvg = recentConstructor.reduce((s, r) => s + r.finishPosition, 0) / recentConstructor.length;
      feats.constructorRecentFinishForm = ns(Math.round(cAvg), 20);
    }
  }

  // ---- Weather (from FastF1 weather summary) ----
  if (fastf1?.weather?.summary) {
    const ws = fastf1.weather.summary;
    feats.weatherRainRisk = ws.rainPointCount ? clamp(ws.rainPointCount / 100) : 0;
    feats.weatherCoolTrack = (ws.trackTempC?.average ?? 30) < 25 ? 1 : (ws.trackTempC?.average ?? 30) < 30 ? 0 : -1;
    feats.weatherHotTrack = (ws.trackTempC?.average ?? 30) > 40 ? 1 : (ws.trackTempC?.average ?? 30) > 35 ? 0 : -1;
    feats.weatherHumidity = ws.humidityPct?.average != null ? nrate(ws.humidityPct.average / 100, 0.5) : 0;
    feats.weatherWind = ws.maxWindSpeedMps != null ? clamp(ws.maxWindSpeedMps / 15) : 0;
    feats.weatherTrackAirDelta = ws.trackTempC?.average != null && ws.airTempC?.average != null
      ? clamp((ws.trackTempC.average - ws.airTempC.average - 10) / 15) : 0;
  }

  // ================================================================
  // FastF1 Rolling Features — TEAM-RELATIVE (from PAST races)
  // All values already in [-1, 1]: positive = outperformed team mate
  // ================================================================
  if (includeFastF1) {
    const f1Rolling = getDriverFastF1Rolling(driverId, 5);
    if (f1Rolling) {
      // Team-relative metrics are already self-normalized — use directly
      feats.driverLongRunPaceForm = f1Rolling.longRunPace;
      feats.driverTyreManagementForm = f1Rolling.tyreConsistency;
      feats.driverGridGainForm = f1Rolling.gridGain;
      feats.driverTelemetrySpeedForm = f1Rolling.maxSpeedKph;
      feats.driverQualifyingConversionForm = f1Rolling.qualifyingConversion;
      feats.driverPitStopForm = f1Rolling.stintCount;
      feats.driverFastestLapForm = f1Rolling.fastestLap;
      feats.driverStintLengthForm = 0;

      // Constructor form: average of team mate's rolling metrics
      const teamMate = race.results.find(
        (r) => r.constructorId === constructorId && r.driverId !== driverId,
      );
      if (teamMate) {
        const mateRolling = getDriverFastF1Rolling(teamMate.driverId, 5);
        if (mateRolling) {
          feats.constructorLongRunPaceForm = clamp((f1Rolling.longRunPace + mateRolling.longRunPace) / 2);
          feats.constructorTyreManagementForm = clamp((f1Rolling.tyreConsistency + mateRolling.tyreConsistency) / 2);
          feats.constructorGridGainForm = clamp((f1Rolling.gridGain + mateRolling.gridGain) / 2);
          feats.constructorTelemetrySpeedForm = clamp((f1Rolling.maxSpeedKph + mateRolling.maxSpeedKph) / 2);
          feats.constructorQualifyingConversionForm = clamp((f1Rolling.qualifyingConversion + mateRolling.qualifyingConversion) / 2);
          feats.constructorPitStopForm = clamp((f1Rolling.stintCount + mateRolling.stintCount) / 2);
          feats.constructorStintLengthForm = 0;
          feats.constructorFastestLapForm = clamp((f1Rolling.fastestLap + mateRolling.fastestLap) / 2);
        }
      }
    }
  }

  // ================================================================
  // Extended Features (beyond the 172 WINNER_PREDICTION_FEATURES)
  // ================================================================
  // ================================================================
  // Driver Fixed Traits × Season Phase (dynamic scaling)
  // Early season: traits muted (0). Late season: traits fully active (1).
  // ================================================================
  const seasonPhase = clamp((race.round - 8) / 10); // R8→0, R13→0.5, R18→1
  const traits = driverTraitsCache.get(driverId);
  if (traits) {
    feats['trait_NonPoleWinRate'] = traits.nonPoleWinRate * seasonPhase;
    feats['trait_RaceVsQualiDelta'] = traits.raceVsQualiDelta * seasonPhase;
    feats['trait_WetPerformance'] = traits.wetPerformance * seasonPhase;
    feats['trait_StreetVsPermanent'] = traits.streetVsPermanent * seasonPhase;
    feats['trait_LateSeasonSprint'] = traits.lateSeasonSprint * seasonPhase;
    feats['trait_TopTeamPerformance'] = traits.topTeamPerformance * seasonPhase;
    feats['trait_Lap1Gain'] = traits.lap1Gain * seasonPhase;
    feats['trait_TyreManagement'] = traits.tyreManagement * seasonPhase;
  }

  // Fill all 172 base keys
  for (const feat of WINNER_PREDICTION_FEATURES) {
    if (!(feat in feats)) feats[feat] = 0;
  }
  return feats;
}

// ============================================================================
// Build Candidates
// ============================================================================

function groupByRace(candidates: WinnerPredictionCandidate[]): WinnerPredictionCandidate[][] {
  const groups = new Map<string, WinnerPredictionCandidate[]>();
  for (const c of candidates) {
    const list = groups.get(c.raceKey) || [];
    list.push(c);
    groups.set(c.raceKey, list);
  }
  return [...groups.values()];
}

function buildAllCandidates(
  races: RaceData[],
  includeFastF1: boolean,
): WinnerPredictionCandidate[] {
  const driverHistories = new Map<string, DriverHistoryEntry[]>();
  driverFastF1History.clear();
  const candidates: WinnerPredictionCandidate[] = [];

  // Process races in chronological order (across seasons)
  const sortedRaces = [...races].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : a.round - b.round,
  );

  for (const race of sortedRaces) {
    const raceKey = `${race.season}-${race.round}`;
    const fastf1 = loadFastF1(race.season, race.round);
    const f1ToF1db = fastf1 ? buildFastF1ToF1dbMap(fastf1, race.results) : new Map<string, string>();
    const f1dbToF1 = new Map([...f1ToF1db.entries()].map(([k, v]) => [v, k]));

    // Phase 1: Extract raw FastF1 metrics for ALL drivers in this race
    const rawMetrics = new Map<string, FastF1DriverMetrics>();
    if (includeFastF1 && fastf1) {
      for (const result of race.results) {
        const fastF1Id = f1dbToF1.get(result.driverId);
        if (fastF1Id) {
          const m = extractRawMetrics(fastf1, fastF1Id);
          if (m) rawMetrics.set(result.driverId, m);
        }
      }
    }

    // Phase 2: Compute team-relative metrics (driver - team mate)
    const teamRelativeMetrics = new Map<string, FastF1DriverMetrics>();
    if (rawMetrics.size > 0) {
      // Group drivers by constructor
      const byConstructor = new Map<string, string[]>();
      for (const result of race.results) {
        if (rawMetrics.has(result.driverId)) {
          const list = byConstructor.get(result.constructorId) || [];
          list.push(result.driverId);
          byConstructor.set(result.constructorId, list);
        }
      }
      // For teams with exactly 2 drivers, compute relative metrics
      for (const [, drivers] of byConstructor) {
        if (drivers.length === 2) {
          const d1 = rawMetrics.get(drivers[0])!;
          const d2 = rawMetrics.get(drivers[1])!;
          teamRelativeMetrics.set(drivers[0], makeRelative(d1, d2));
          teamRelativeMetrics.set(drivers[1], makeRelative(d2, d1));
        }
      }
    }

    const entriesThisRace: Array<{ driverId: string; entry: DriverHistoryEntry; f1Metrics: FastF1DriverMetrics | null }> = [];

    for (const result of race.results) {
      const driverId = result.driverId;
      const pos = num(result.position) || 20;
      const gridPos = num(result.gridPosition) || pos;
      const laps = num(result.laps) || 0;
      const totalLaps = Math.max(...race.results.map((r) => num(r.laps) || 0), laps);

      const driverHistory = (driverHistories.get(driverId) || []).slice(-10);

      // Constructor history: lightweight, team mate's current race only
      const constructorHistory: DriverHistoryEntry[] = [];
      const teamMateResult = race.results.find(
        (r) => r.constructorId === result.constructorId && r.driverId !== driverId,
      );
      if (teamMateResult) {
        constructorHistory.push({
          finishPosition: num(teamMateResult.position) || 20,
          gridPosition: num(teamMateResult.gridPosition) || 20,
          winner: num(teamMateResult.position) === 1,
          podium: num(teamMateResult.position) <= 3,
          dnf: teamMateResult.reasonRetired != null || num(teamMateResult.position) > 20,
          lapsCompleted: num(teamMateResult.laps) || 0,
          totalLaps: Math.max(...race.results.map((r) => num(r.laps) || 0)),
        });
      }

      const features = buildFeatures(
        race, result, driverHistory, constructorHistory, fastf1, includeFastF1, f1ToF1db,
      );

      const isWinner = pos === 1;
      candidates.push({
        raceKey, driverId, constructorId: result.constructorId, winner: isWinner, features,
      });

      // Use TEAM-RELATIVE metrics for history (not raw)
      const f1Metrics = teamRelativeMetrics.get(driverId) ?? null;

      entriesThisRace.push({
        driverId,
        entry: { finishPosition: pos, gridPosition: gridPos, winner: isWinner, podium: pos <= 3, dnf: result.reasonRetired != null || pos > 20, lapsCompleted: laps, totalLaps },
        f1Metrics,
      });
    }

    // Update histories AFTER processing this race (no data leakage)
    for (const { driverId: did, entry, f1Metrics } of entriesThisRace) {
      const hist = driverHistories.get(did) || [];
      hist.push(entry);
      driverHistories.set(did, hist);

      if (f1Metrics) {
        const f1Hist = driverFastF1History.get(did) || [];
        f1Hist.push({ season: race.season, round: race.round, metrics: f1Metrics });
        driverFastF1History.set(did, f1Hist);
      }
    }
  }

  return candidates;
}

// ============================================================================
// Pre-trained Base + In-Season Incremental Learning
// - Base model trained on 2022-2024 (pre-season knowledge)
// - Each 2025 race: train on base data + 2025 races 1..N-1, predict race N
// ============================================================================

console.log('=== Pre-train + In-Season Predictions (2025) ===\n');

const allSeasons = [2022, 2023, 2024, 2025];
const allRaces: RaceData[] = [];
for (const s of allSeasons) {
  allRaces.push(...loadSeason(s));
  console.log(`Loaded ${loadSeason(s).length} races from ${s}`);
}
allRaces.sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);
console.log(`Total: ${allRaces.length} races`);

type ModelKind = 'linear' | 'nonlinear';

function runPretrainInSeason(includeFastF1: boolean, modelKind: ModelKind, label: string) {
  console.log(`\n--- ${label} ---`);

  // Phase 1: Build FastF1 history + train base model on 2022-2024
  driverFastF1History.clear();
  const baseSeasons = [2022, 2023, 2024];

  // Build base season candidates in chronological order (accumulates FastF1 history)
  const baseRaces = allRaces
    .filter((r) => baseSeasons.includes(r.season))
    .sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);

  const baseCandidates = buildAllCandidates(baseRaces, includeFastF1);
  const baseGroups = groupByRace(baseCandidates);
  console.log(`  Base model: ${baseGroups.length} races (2022-2024)`);

  let entries = 0;
  for (const [, h] of driverFastF1History) entries += h.length;
  console.log(`  FastF1 history: ${driverFastF1History.size} drivers, ${entries} entries`);

  // Phase 2: 2025 season predictions
  // Build 2025 candidates (accumulates 2025 FastF1 history on top of base)
  const races2025 = allRaces
    .filter((r) => r.season === 2025)
    .sort((a, b) => a.round - b.round);
  const all2025Candidates = buildAllCandidates(races2025, includeFastF1);
  const raceMap2025 = new Map<string, WinnerPredictionCandidate[]>();
  for (const c of all2025Candidates) {
    const list = raceMap2025.get(c.raceKey) || [];
    list.push(c);
    raceMap2025.set(c.raceKey, list);
  }

  const predictions: Array<{
    round: number;
    predicted: string;
    actual: string;
    correct: boolean;
    prob: number;
    trainSize: number;
  }> = [];

  // Predict ALL 24 races (starting from round 1)
  for (let round = 1; round <= 24; round++) {
    const raceKey = `2025-${round}`;
    const testRace = raceMap2025.get(raceKey);
    if (!testRace) continue;

    // Training = base data (2022-2024) + 2025 races before this round
    const trainCandidates = [...baseCandidates];
    for (let r = 1; r < round; r++) {
      const prevRace = raceMap2025.get(`2025-${r}`);
      if (prevRace) trainCandidates.push(...prevRace);
    }

    const trainGroups = groupByRace(trainCandidates);

    let nonlinearModel: NonlinearWinnerPredictionModel | null = null;
    const linearModel = modelKind === 'linear'
      ? trainWinnerPredictionModel(trainGroups, { iterations: 240, learningRate: 0.08, l2: 0.002, featureNames: ALL_FEATURES as any })
      : null;

    if (modelKind === 'nonlinear') {
      nonlinearModel = trainNonlinearWinnerPredictionModel(trainGroups, {
        hiddenSize: 16,
        iterations: 120,
        learningRate: 0.05,
        l2: 0.001,
      });
    }

    // Predict
    const scores = testRace.map((c) => {
      let s: number;
      if (modelKind === 'linear' && linearModel) {
        s = linearModel.bias;
        for (const feat of ALL_FEATURES) {
          s += (c.features[feat] || 0) * ((linearModel.weights as Record<string, number>)[feat] || 0);
        }
      } else if (nonlinearModel) {
        s = scoreNonlinearWinnerCandidate(c, nonlinearModel);
      } else {
        s = 0;
      }
      return { driverId: c.driverId, score: s, winner: c.winner };
    });
    const maxScore = Math.max(...scores.map((s) => s.score));
    const exps = scores.map((s) => Math.exp(s.score - maxScore));
    const total = exps.reduce((a, b) => a + b, 0);
    const probs = scores.map((s, i) => ({ ...s, prob: exps[i] / total })).sort((a, b) => b.prob - a.prob);

    const actual = testRace.find((c) => c.winner);
    predictions.push({
      round,
      predicted: probs[0].driverId,
      actual: actual?.driverId || '?',
      correct: probs[0].driverId === actual?.driverId,
      prob: probs[0].prob,
      trainSize: trainGroups.length,
    });
  }

  const correct = predictions.filter((p) => p.correct).length;
  const total = predictions.length;
  console.log(`  Top-1: ${(correct / total * 100).toFixed(1)}% (${correct}/${total})`);

  return predictions;
}

// Compute driver traits from 2022-2024
computeDriverTraits();

// Run: Linear + Nonlinear WITHOUT FastF1, produce ensemble
console.log('\n=== Ensemble: Linear + Nonlinear ===\n');

function runEnsemble(label: string) {
  console.log(`--- ${label} ---`);

  // Build base candidates once (shared by both models)
  driverFastF1History.clear();
  const baseRaces = allRaces
    .filter((r) => [2022, 2023, 2024].includes(r.season))
    .sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);
  const baseCandidates = buildAllCandidates(baseRaces, false);
  const baseGroups = groupByRace(baseCandidates);

  // 2025 candidates
  const races2025 = allRaces.filter((r) => r.season === 2025).sort((a, b) => a.round - b.round);
  const all2025Candidates = buildAllCandidates(races2025, false);
  const raceMap2025 = new Map<string, WinnerPredictionCandidate[]>();
  for (const c of all2025Candidates) {
    const list = raceMap2025.get(c.raceKey) || [];
    list.push(c);
    raceMap2025.set(c.raceKey, list);
  }

  interface EnsembleEntry { round: number; predicted: string; actual: string; correct: boolean; linPred: string; linOk: boolean; nlPred: string; nlOk: boolean; conf: number; }
  const ensembleResults: EnsembleEntry[] = [];

  for (let round = 1; round <= 24; round++) {
    const raceKey = `2025-${round}`;
    const testRace = raceMap2025.get(raceKey);
    if (!testRace) continue;

    const trainCandidates = [...baseCandidates];
    for (let r = 1; r < round; r++) {
      const prevRace = raceMap2025.get(`2025-${r}`);
      if (prevRace) trainCandidates.push(...prevRace);
    }

    const trainGroups = groupByRace(trainCandidates);

    // Train both models
    const linearModel = trainWinnerPredictionModel(trainGroups, { iterations: 240, learningRate: 0.08, l2: 0.002, featureNames: ALL_FEATURES as any });
    const nonlinearModel = trainNonlinearWinnerPredictionModel(trainGroups, { hiddenSize: 16, iterations: 120, learningRate: 0.05, l2: 0.001 });

    // Get probabilities from both models
    function getProbs(model: 'linear' | 'nonlinear'): Map<string, number> {
      const scores = testRace.map((c) => {
        let s: number;
        if (model === 'linear') {
          s = linearModel.bias;
          for (const feat of ALL_FEATURES) {
            s += (c.features[feat] || 0) * ((linearModel.weights as Record<string, number>)[feat] || 0);
          }
        } else {
          s = scoreNonlinearWinnerCandidate(c, nonlinearModel);
        }
        return { driverId: c.driverId, score: s };
      });
      const maxScore = Math.max(...scores.map((s) => s.score));
      const exps = scores.map((s) => Math.exp(s.score - maxScore));
      const total = exps.reduce((a, b) => a + b, 0);
      return new Map(scores.map((s, i) => [s.driverId, exps[i] / total]));
    }

    const linProbs = getProbs('linear');
    const nlProbs = getProbs('nonlinear');

    // Ensemble: average probabilities
    const ensembleProbs = new Map<string, number>();
    for (const driverId of new Set([...linProbs.keys(), ...nlProbs.keys()])) {
      ensembleProbs.set(driverId, ((linProbs.get(driverId) || 0) + (nlProbs.get(driverId) || 0)) / 2);
    }

    const ensembleWinner = [...ensembleProbs.entries()].sort((a, b) => b[1] - a[1])[0];
    const linWinner = [...linProbs.entries()].sort((a, b) => b[1] - a[1])[0];
    const nlWinner = [...nlProbs.entries()].sort((a, b) => b[1] - a[1])[0];
    const actual = testRace.find((c) => c.winner);

    ensembleResults.push({
      round,
      predicted: ensembleWinner[0],
      actual: actual?.driverId || '?',
      correct: ensembleWinner[0] === actual?.driverId,
      linPred: linWinner[0], linOk: linWinner[0] === actual?.driverId,
      nlPred: nlWinner[0], nlOk: nlWinner[0] === actual?.driverId,
      conf: ensembleWinner[1],
    });
  }

  const correct = ensembleResults.filter((r) => r.correct).length;
  console.log(`  Ensemble: ${(correct/24*100).toFixed(1)}% (${correct}/24)`);

  return ensembleResults;
}

const ensemble = runEnsemble('Linear + Nonlinear Ensemble');

// Comparison
console.log('\n--- Per-Race: Linear vs Nonlinear vs Ensemble ---');
let ensFixed = 0, ensBroke = 0;
for (const r of ensemble) {
  const ok = (x: boolean) => x ? '✓' : '✗';
  let note = '';
  if (!r.linOk && !r.nlOk && r.correct) { note = ' ← ENS fixed both'; ensFixed++; }
  if ((r.linOk || r.nlOk) && !r.correct) { note = ' ← ENS broke'; ensBroke++; }
  if (r.linOk && !r.nlOk && r.correct) { note = ' ← ENS = Lin (NL wrong)'; }
  if (!r.linOk && r.nlOk && r.correct) { note = ' ← ENS = NL (Lin wrong)'; }
  console.log(`  R${String(r.round).padStart(2)}: ${r.actual.padEnd(20)} | Lin=${r.linPred.padEnd(18)}${ok(r.linOk)} | NL=${r.nlPred.padEnd(18)}${ok(r.nlOk)} | ENS=${r.predicted.padEnd(18)}${ok(r.correct)}${note}`);
}

const linC = ensemble.filter((r) => r.linOk).length;
const nlC = ensemble.filter((r) => r.nlOk).length;
const ensC = ensemble.filter((r) => r.correct).length;
console.log(`\n  Linear:  ${(linC/24*100).toFixed(1)}% (${linC}/24)`);
console.log(`  Nonlin:  ${(nlC/24*100).toFixed(1)}% (${nlC}/24)`);
console.log(`  Ensemble:${(ensC/24*100).toFixed(1)}% (${ensC}/24)`);
console.log(`  Pole:    66.7% (16/24)`);
console.log(`  ENS fixes both wrong: ${ensFixed}, ENS breaks: ${ensBroke}`);

// Pole baseline for 2025
console.log('\n--- Pole Baseline (2025) ---');
const races2025 = allRaces.filter((r) => r.season === 2025);
let poleC = 0, poleT = 0;
for (const race of races2025) {
  const poleSitter = race.qualifying.reduce((best, q) => (num(q.position) || 99) < (num(best.position) || 99) ? q : best);
  const winner = race.results.find((r) => num(r.position) === 1);
  if (poleSitter.driverId === winner?.driverId) poleC++;
  poleT++;
}
console.log(`  ${(poleC / poleT * 100).toFixed(1)}% (${poleC}/${poleT})`);

console.log('\n=== Done ===');
