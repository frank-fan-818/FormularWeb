/**
 * Evaluate the winnerFeatureBuilder with real F1 historical data (f1db YAML).
 *
 * Usage: npx tsx scripts/eval-winner-features.ts
 *
 * Fetches race data from local f1db YAML files, builds feature vectors using
 * src/utils/winnerFeatureBuilder.ts, trains a linear model, and reports accuracy.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

import {
  WINNER_PREDICTION_FEATURES,
  buildPoleBaselineModel,
  evaluateWinnerPredictions,
  trainWinnerPredictionModel,
  type WinnerPredictionCandidate,
  type WinnerPredictionWeights,
} from '../src/utils/raceWinnerPrediction.ts';
import {
  buildRaceWinnerSequenceEmbedding,
  type RaceWinnerSequenceStep,
} from '../src/utils/raceWinnerSequenceModel.ts';
import {
  normalizePosition,
  normalizeRate,
  normalizeAdvantage,
  normalizeLinear,
  type WinnerFeatureInput,
  type QualifyingInput,
  type StandingInput,
  type PracticeInput,
  type DriverRecentForm,
  type ConstructorRecentForm,
  type CircuitHistoryInput,
  type SprintInput,
  type CircuitCharacteristicsInput,
} from '../src/utils/winnerFeatureBuilder.ts';

// ============================================================================
// Config
// ============================================================================

const DATA_ROOT = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons');
const EVAL_SEASONS = [2022, 2023, 2024];  // Train on these
const TEST_SEASONS = [2025];               // Evaluate on this

// Circuit characteristics lookup (simplified)
const CIRCUIT_PROFILES: Record<string, CircuitCharacteristicsInput> = {
  monaco: { isStreetCircuit: true, overtakeDifficulty: 0.95, tyreStress: 0.3, restartRisk: 0.4, qualifyingImportance: 0.95 },
  baku: { isStreetCircuit: true, overtakeDifficulty: 0.7, tyreStress: 0.4, restartRisk: 0.5, qualifyingImportance: 0.8 },
  singapore: { isStreetCircuit: true, overtakeDifficulty: 0.85, tyreStress: 0.6, restartRisk: 0.6, qualifyingImportance: 0.85 },
  jeddah: { isStreetCircuit: true, overtakeDifficulty: 0.65, tyreStress: 0.5, restartRisk: 0.4, qualifyingImportance: 0.7 },
  miami: { isStreetCircuit: true, overtakeDifficulty: 0.6, tyreStress: 0.5, restartRisk: 0.3, qualifyingImportance: 0.6 },
  las_vegas: { isStreetCircuit: true, overtakeDifficulty: 0.55, tyreStress: 0.4, restartRisk: 0.3, qualifyingImportance: 0.55 },
  albert_park: { isStreetCircuit: true, overtakeDifficulty: 0.7, tyreStress: 0.5, restartRisk: 0.4, qualifyingImportance: 0.75 },
  montreal: { isStreetCircuit: true, overtakeDifficulty: 0.65, tyreStress: 0.35, restartRisk: 0.5, qualifyingImportance: 0.7 },
};

const DEFAULT_CIRCUIT: CircuitCharacteristicsInput = {
  isStreetCircuit: false, overtakeDifficulty: 0.5, tyreStress: 0.5,
  restartRisk: 0.3, qualifyingImportance: 0.5,
};

function getCircuitProfile(circuitId: string): CircuitCharacteristicsInput {
  return CIRCUIT_PROFILES[circuitId] ?? DEFAULT_CIRCUIT;
}

// ============================================================================
// YAML Types
// ============================================================================

interface RaceYaml {
  round: number;
  circuitId: string;
  grandPrixId?: string;
}

interface ResultYaml {
  position?: number | string | null;
  driverId: string;
  constructorId: string;
  points?: number | string | null;
  gridPosition?: number | string | null;
  laps?: number | string | null;
  reasonRetired?: string | null;
}

interface QualifyingYaml {
  position?: number | string | null;
  driverId: string;
  constructorId: string;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
}

interface PracticeYaml {
  position?: number | string | null;
  driverId: string;
  constructorId: string;
  time?: string | null;
  laps?: number | string | null;
}

interface StandingYaml {
  position?: number | string | null;
  driverId: string;
  constructorId: string;
  points?: number | string | null;
  wins?: number | string | null;
}

// ============================================================================
// YAML Helpers
// ============================================================================

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function readYaml<T>(filePath: string): T | null {
  try {
    const raw = readFileSync(filePath, 'utf8');
    return YAML.parse(raw) as T;
  } catch {
    return null;
  }
}

function timeToSeconds(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  return parseFloat(time) || null;
}

// ============================================================================
// Data Loading
// ============================================================================

interface RaceData {
  season: number;
  round: number;
  circuitId: string;
  results: ResultYaml[];
  qualifying: QualifyingYaml[];
  fp1: PracticeYaml[];
  fp2: PracticeYaml[];
  fp3: PracticeYaml[];
  sprintResults: ResultYaml[];
  sprintQualifying: QualifyingYaml[];
  driverStandings: StandingYaml[];
  constructorStandings: StandingYaml[];
}

function loadSeason(season: number): RaceData[] {
  const seasonDir = path.join(DATA_ROOT, String(season));
  if (!existsSync(seasonDir)) return [];

  const racesDir = path.join(seasonDir, 'races');
  const raceDirs = readdirSync(racesDir).filter((d) => /^\d{2}-/.test(d));
  const races: RaceData[] = [];

  for (const dir of raceDirs) {
    const racePath = path.join(racesDir, dir);

    const raceYaml = readYaml<RaceYaml>(path.join(racePath, 'race.yml'));
    if (!raceYaml) continue;

    const results = readYaml<ResultYaml[]>(path.join(racePath, 'race-results.yml')) ?? [];
    const qualifying = readYaml<QualifyingYaml[]>(path.join(racePath, 'qualifying-results.yml')) ?? [];
    const fp1 = readYaml<PracticeYaml[]>(path.join(racePath, 'free-practice-1-results.yml')) ?? [];
    const fp2 = readYaml<PracticeYaml[]>(path.join(racePath, 'free-practice-2-results.yml')) ?? [];
    const fp3 = readYaml<PracticeYaml[]>(path.join(racePath, 'free-practice-3-results.yml')) ?? [];
    const sprintResults = readYaml<ResultYaml[]>(path.join(racePath, 'sprint-results.yml')) ?? [];

    // Sprint qualifying
    let sprintQualifying = readYaml<QualifyingYaml[]>(
      path.join(racePath, 'sprint-qualifying-results.yml'),
    );
    if (!sprintQualifying) {
      sprintQualifying = readYaml<QualifyingYaml[]>(
        path.join(racePath, 'sprint-shootout-results.yml'),
      );
    }
    if (!sprintQualifying) sprintQualifying = [];

    // Standings at this race
    const ds = readYaml<StandingYaml[]>(path.join(racePath, 'driver-standings.yml')) ?? [];
    const cs = readYaml<StandingYaml[]>(path.join(racePath, 'constructor-standings.yml')) ?? [];

    races.push({
      season,
      round: raceYaml.round,
      circuitId: raceYaml.circuitId,
      results,
      qualifying,
      fp1, fp2, fp3,
      sprintResults,
      sprintQualifying,
      driverStandings: ds,
      constructorStandings: cs,
    });
  }

  return races.sort((a, b) => a.round - b.round);
}

// ============================================================================
// Feature Construction
// ============================================================================

interface DriverHistoryEntry {
  finishPosition: number;
  gridPosition: number;
  winner: boolean;
  podium: boolean;
  dnf: boolean;
  lapsCompleted: number;
  totalLaps: number;
  season: number;
  round: number;
}

function buildRaceWinnerInput(
  season: number,
  round: number,
  circuitId: string,
  driverId: string,
  constructorId: string,
  result: ResultYaml,
  raceData: RaceData,
  driverHistory: DriverHistoryEntry[],
  constructorHistory: DriverHistoryEntry[],
): WinnerFeatureInput {
  const pos = num(result.position) || 20;
  const gridPos = num(result.gridPosition) || pos;
  const totalDrivers = raceData.results.length;

  // ---- Qualifying ----
  const qResult = raceData.qualifying.find((q) => q.driverId === driverId);
  const allQ3Times = raceData.qualifying
    .map((q) => timeToSeconds(q.q3))
    .filter((t): t is number => t != null);
  const teamMate = raceData.results.find(
    (r) => r.constructorId === constructorId && r.driverId !== driverId,
  );
  const teamMateQ = teamMate
    ? raceData.qualifying.find((q) => q.driverId === teamMate.driverId)
    : null;

  const qualifying: QualifyingInput = {
    position: qResult ? (num(qResult.position) || gridPos) : gridPos,
    totalDrivers,
    q1TimeSeconds: timeToSeconds(qResult?.q1),
    q2TimeSeconds: timeToSeconds(qResult?.q2),
    q3TimeSeconds: timeToSeconds(qResult?.q3),
    allPositions: raceData.qualifying.map((q) => num(q.position) || totalDrivers),
    allQ3TimesSeconds: allQ3Times,
    teamMatePosition: teamMateQ ? (num(teamMateQ.position) || totalDrivers) : null,
    teamMateQ3TimeSeconds: timeToSeconds(teamMateQ?.q3),
  };

  // ---- Practice ----
  const fp1Result = raceData.fp1.find((r) => r.driverId === driverId);
  const fp2Result = raceData.fp2.find((r) => r.driverId === driverId);
  const fp3Result = raceData.fp3.find((r) => r.driverId === driverId);

  const allFpBest = raceData.fp2
    .map((r) => timeToSeconds(r.time))
    .filter((t): t is number => t != null);
  const allFpLaps = raceData.fp2.map((r) => num(r.laps) || 0);
  const teamMateFp = teamMate ? raceData.fp2.find((r) => r.driverId === teamMate.driverId) : null;

  const practice: PracticeInput = {
    fp1TimeSeconds: timeToSeconds(fp1Result?.time),
    fp2TimeSeconds: timeToSeconds(fp2Result?.time),
    fp3TimeSeconds: timeToSeconds(fp3Result?.time),
    lapsCompleted: (num(fp1Result?.laps) || 0) + (num(fp2Result?.laps) || 0) + (num(fp3Result?.laps) || 0),
    allFpBestTimesSeconds: allFpBest,
    allFpLapsCounts: allFpLaps,
    teamMateBestFpTimeSeconds: timeToSeconds(teamMateFp?.time),
    constructorBestFpTimeSeconds: timeToSeconds(fp2Result?.time), // simplified
  };

  // ---- Standings ----
  const ds = raceData.driverStandings.find((s) => s.driverId === driverId);
  const cs = raceData.constructorStandings.find((s) => s.constructorId === constructorId);

  const driverStanding: StandingInput = {
    position: ds ? (num(ds.position) || totalDrivers) : totalDrivers,
    points: num(ds?.points) || 0,
    wins: num(ds?.wins) || 0,
    totalDrivers,
  };

  const constructorStanding: StandingInput = {
    position: cs ? (num(cs.position) || 10) : 10,
    points: num(cs?.points) || 0,
    wins: num(cs?.wins) || 0,
    totalDrivers: 10,
  };

  // ---- Recent Form ----
  const recentDriverRaces = driverHistory.slice(-10);
  const recentConstructorRaces = constructorHistory.slice(-10);

  const driverRecentForm: DriverRecentForm = {
    last10Steps: recentDriverRaces.map((r) => ({
      finishAdvantage: r.winner ? 1 : r.podium ? 0.6 : Math.max(0, 1 - (r.finishPosition - 1) / 20),
      qualifyingAdvantage: Math.max(0, 1 - (r.gridPosition - 1) / 20),
      podium: r.podium ? 1 : 0,
      win: r.winner ? 1 : 0,
      reliability: r.dnf ? 0 : 1,
    })),
    finishPositions: recentDriverRaces.map((r) => r.finishPosition),
    qualifyingPositions: recentDriverRaces.map((r) => r.gridPosition),
    winCount: recentDriverRaces.filter((r) => r.winner).length,
    podiumCount: recentDriverRaces.filter((r) => r.podium).length,
    raceCount: Math.max(recentDriverRaces.length, 1),
    dnfCount: recentDriverRaces.filter((r) => r.dnf).length,
    totalLapsCompleted: recentDriverRaces.reduce((s, r) => s + r.lapsCompleted, 0),
    totalLapsPossible: Math.max(recentDriverRaces.reduce((s, r) => s + r.totalLaps, 0), 1),
  };

  const constructorRecentForm: ConstructorRecentForm = {
    last10Steps: recentConstructorRaces.map((r) => ({
      finishAdvantage: r.winner ? 1 : r.podium ? 0.6 : Math.max(0, 1 - (r.finishPosition - 1) / 20),
      qualifyingAdvantage: Math.max(0, 1 - (r.gridPosition - 1) / 20),
      podium: r.podium ? 1 : 0,
      win: r.winner ? 1 : 0,
      reliability: r.dnf ? 0 : 1,
    })),
    finishPositions: recentConstructorRaces.map((r) => r.finishPosition),
    winCount: recentConstructorRaces.filter((r) => r.winner).length,
    podiumCount: recentConstructorRaces.filter((r) => r.podium).length,
    raceCount: Math.max(recentConstructorRaces.length, 1),
  };

  // ---- Circuit History (simplified) ----
  const circuitHistory: CircuitHistoryInput = {
    driverWinCount: 0,
    driverPodiumCount: 0,
    driverTotalRaces: 0,
    constructorWinCount: 0,
    constructorTotalRaces: 0,
    poleWinConversionPct: null,
    top3GridWinPct: null,
    scRate: null,
    vscRate: null,
    redFlagRate: null,
    overtakeUpsetRate: null,
    totalSamples: 0,
  };

  // ---- Sprint ----
  const sprintResult = raceData.sprintResults.find((r) => r.driverId === driverId);
  const sprintQResult = raceData.sprintQualifying.find((r) => r.driverId === driverId);
  const isSprintWeekend = raceData.sprintResults.length > 0;

  const sprint: SprintInput = {
    isSprintWeekend,
    sprintPosition: sprintResult ? (num(sprintResult.position) || totalDrivers) : null,
    sprintQualifyingPosition: sprintQResult ? (num(sprintQResult.position) || totalDrivers) : null,
    totalSprintDrivers: raceData.sprintResults.length || totalDrivers,
  };

  return {
    season, round, circuitId, driverId, constructorId,
    qualifying,
    practice,
    driverStanding,
    constructorStanding,
    driverRecentForm,
    constructorRecentForm,
    circuitHistory,
    circuitCharacteristics: getCircuitProfile(circuitId),
    sprint,
  };
}

// ============================================================================
// Manual feature assembly (avoids importing ESM-only module)
// ============================================================================

function buildFeaturesDirect(input: WinnerFeatureInput): Record<string, number> {
  const feats: Record<string, number> = {};

  // Grid/Qualifying
  if (input.qualifying) {
    const q = input.qualifying;
    const pos = q.position, total = q.totalDrivers;
    const ns = (p: number, t: number) => t > 1 ? 1 - (2 * (p - 1)) / (t - 1) : 0;

    feats.gridAdvantage = ns(pos, total);
    feats.gridPole = pos === 1 ? 1 : 0;
    feats.gridFrontRow = pos <= 2 ? 1 : 0;
    feats.gridTop3 = pos <= 3 ? 1 : 0;
    feats.poleModelProbability = pos === 1 ? 1 : pos <= 3 ? 0.6 : Math.max(0, 1 - (pos - 1) / total);
    feats.poleModelRankAdvantage = ns(pos, total);
    feats.poleModelScore = pos === 1 ? 2 : pos <= 3 ? 1 : ns(pos, total);
    feats.qualifyingAdvantage = ns(pos, total);
    feats.qualifyingPole = pos === 1 ? 1 : 0;
    feats.qualifyingFrontRow = pos <= 2 ? 1 : 0;

    if (q.allQ3TimesSeconds && q.allQ3TimesSeconds.length > 0) {
      const best = Math.min(...q.allQ3TimesSeconds);
      const myTime = q.q3TimeSeconds;
      if (myTime != null) {
        const gap = myTime - best;
        feats.qualifyingPaceAdvantage = Math.max(-1, Math.min(1, 1 - gap / 2));
        feats.qualifyingPaceSharpAdvantage = gap < 0.1 ? 1 : gap < 0.3 ? 0.5 : 0;
      }
    }

    feats.teamMateQualifyingAdvantage = 0;
    if (q.teamMateQ3TimeSeconds != null && q.q3TimeSeconds != null) {
      const g = q.q3TimeSeconds - q.teamMateQ3TimeSeconds;
      feats.teamMateQualifyingAdvantage = Math.max(-1, Math.min(1, g / 0.5 * -1));
    }
  }

  // Standings
  if (input.driverStanding && input.constructorStanding) {
    const d = input.driverStanding, c = input.constructorStanding;
    const ns = (p: number, t: number) => t > 1 ? 1 - (2 * (p - 1)) / (t - 1) : 0;
    feats.driverStandingAdvantage = ns(d.position, d.totalDrivers);
    feats.driverStandingPointsShare = Math.max(-1, Math.min(1, (d.points / d.totalDrivers - 10) / 50));
    feats.constructorStandingAdvantage = ns(c.position, c.totalDrivers);
    feats.constructorStandingPointsShare = Math.max(-1, Math.min(1, (c.points / c.totalDrivers - 10) / 50));
    const nrate = (r: number, neu: number) => r >= neu ? Math.min(1, (r - neu) / (1 - neu)) : Math.max(-1, (r - neu) / neu);
    feats.driverSeasonWinRate = d.totalDrivers > 0 ? nrate(d.wins / d.totalDrivers, 0.1) : 0;
    feats.constructorSeasonWinRate = c.totalDrivers > 0 ? nrate(c.wins / c.totalDrivers, 0.1) : 0;
  }

  // Circuit characteristics
  if (input.circuitCharacteristics) {
    const cc = input.circuitCharacteristics;
    const nrate = (r: number, neu: number) => r >= neu ? Math.min(1, (r - neu) / (1 - neu)) : Math.max(-1, (r - neu) / neu);
    feats.circuitStreetTrack = cc.isStreetCircuit ? 1 : 0;
    feats.circuitLowOvertake = cc.overtakeDifficulty > 0.7 ? 1 : cc.overtakeDifficulty > 0.4 ? nrate(cc.overtakeDifficulty, 0.5) : -1;
    feats.circuitTyreStress = nrate(cc.tyreStress, 0.5);
    feats.circuitRestartRisk = nrate(cc.restartRisk, 0.3);
    feats.circuitQualifyingImportance = nrate(cc.qualifyingImportance, 0.5);
  }

  // Sprint
  if (input.sprint) {
    const s = input.sprint;
    feats.sprintWeekend = s.isSprintWeekend ? 1 : 0;
    if (s.sprintPosition != null && s.totalSprintDrivers && s.totalSprintDrivers > 1) {
      feats.sprintFinishAdvantage = 1 - (2 * (s.sprintPosition - 1)) / (s.totalSprintDrivers - 1);
    }
    if (s.sprintQualifyingPosition != null && s.totalSprintDrivers && s.totalSprintDrivers > 1) {
      feats.sprintQualifyingAdvantage = 1 - (2 * (s.sprintQualifyingPosition - 1)) / (s.totalSprintDrivers - 1);
    }
  }

  // Round progress
  feats.raceRoundProgress = (2 * (input.round - 1)) / 23 - 1;

  // Sequence features
  if (input.driverRecentForm && input.constructorRecentForm) {
    const drf = input.driverRecentForm;
    const seq = buildRaceWinnerSequenceEmbedding(drf.last10Steps);
    feats.driverSequenceMomentum = seq.momentum * 2 - 1;
    feats.driverSequenceConsistency = seq.consistency * 2 - 1;
    feats.driverSequenceUpside = seq.upside * 2 - 1;

    const cseq = buildRaceWinnerSequenceEmbedding(input.constructorRecentForm.last10Steps);
    feats.constructorSequenceMomentum = cseq.momentum * 2 - 1;
    feats.constructorSequenceConsistency = cseq.consistency * 2 - 1;
    feats.constructorSequenceUpside = cseq.upside * 2 - 1;

    const dr = drf.raceCount;
    const nrate2 = (r: number, neu: number) => r >= neu ? Math.min(1, (r - neu) / (1 - neu)) : Math.max(-1, (r - neu) / neu);
    feats.driverRecentWinRate = dr > 0 ? nrate2(drf.winCount / dr, 0.1) : 0;
    feats.driverRecentPodiumRate = dr > 0 ? nrate2(drf.podiumCount / dr, 0.3) : 0;
    feats.driverShortRecentWinRate = dr > 0 ? nrate2(drf.winCount / dr, 0.1) : 0;
    feats.driverLongRecentWinRate = dr > 0 ? nrate2(drf.winCount / dr, 0.05) : 0;
    feats.driverRecentFinishForm = drf.finishPositions.length > 0
      ? (1 - (2 * (Math.round(drf.finishPositions.reduce((s, p) => s + p, 0) / drf.finishPositions.length) - 1)) / 19)
      : 0;
    feats.driverRecentReliability = drf.totalLapsPossible > 0
      ? nrate2(drf.totalLapsCompleted / drf.totalLapsPossible, 0.9)
      : 0;
  }

  // Practice
  if (input.practice) {
    const p = input.practice;
    const bestTimes = p.allFpBestTimesSeconds ?? [];
    const bestOverall = bestTimes.length > 0 ? Math.min(...bestTimes) : null;
    const driverBest = [p.fp1TimeSeconds, p.fp2TimeSeconds, p.fp3TimeSeconds]
      .filter((t): t is number => t != null);
    const myBest = driverBest.length > 0 ? Math.min(...driverBest) : null;

    const fpGap = (time: number | null, best: number) =>
      time != null ? Math.max(-1, Math.min(1, 1 - (time - best) / 2)) : 0;

    if (bestOverall != null) {
      feats.fp1Advantage = fpGap(p.fp1TimeSeconds ?? null, bestOverall);
      feats.fp2Advantage = fpGap(p.fp2TimeSeconds ?? null, bestOverall);
      feats.fp3Advantage = fpGap(p.fp3TimeSeconds ?? null, bestOverall);
      feats.fpBestAdvantage = fpGap(myBest, bestOverall);
      feats.fpBestGapAdvantage = myBest != null ? Math.max(-1, Math.min(1, 1 - (myBest - bestOverall) / 0.5)) : 0;
    }

    if (p.teamMateBestFpTimeSeconds != null && myBest != null) {
      feats.fpTeamMateAdvantage = Math.max(-1, Math.min(1, (p.teamMateBestFpTimeSeconds - myBest) / 0.5));
    }

    if (p.constructorBestFpTimeSeconds != null && myBest != null) {
      feats.fpConstructorAdvantage = Math.max(-1, Math.min(1, (p.constructorBestFpTimeSeconds - myBest) / 0.5));
    }
  }

  // Ensure all 172 keys exist with at least 0
  for (const feat of WINNER_PREDICTION_FEATURES) {
    if (!(feat in feats)) {
      feats[feat] = 0;
    }
  }

  return feats;
}

// ============================================================================
// Main Evaluation
// ============================================================================

console.log('=== F1 Winner Prediction Feature Evaluation ===\n');

// Load all seasons
const allSeasons = [...EVAL_SEASONS, ...TEST_SEASONS];
const allRaces: RaceData[] = [];
for (const season of allSeasons) {
  const races = loadSeason(season);
  allRaces.push(...races);
  console.log(`Loaded ${races.length} races from ${season}`);
}

// Build driver history from previous races
const driverHistories = new Map<string, DriverHistoryEntry[]>();

function addHistory(driverId: string, entry: DriverHistoryEntry): void {
  const hist = driverHistories.get(driverId) || [];
  hist.push(entry);
  driverHistories.set(driverId, hist);
}

// Build candidates for all races
const allCandidates: WinnerPredictionCandidate[] = [];
const sequentialRaces = allRaces.sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);

for (const race of sequentialRaces) {
  const raceKey = `${race.season}-${race.round}`;
  const raceInputs: WinnerFeatureInput[] = [];
  const driverEntriesThisRace: Array<{ driverId: string; entry: DriverHistoryEntry }> = [];

  for (const result of race.results) {
    const driverId = result.driverId;
    const constructorId = result.constructorId;
    const pos = num(result.position) || 20;
    const gridPos = num(result.gridPosition) || pos;
    const laps = num(result.laps) || 0;
    const totalLaps = Math.max(...race.results.map((r) => num(r.laps) || 0), laps);
    const winner = pos === 1;
    const podium = pos <= 3;
    const dnf = result.reasonRetired != null || pos > 20;

    // Get history (races BEFORE this one)
    const driverHistory = (driverHistories.get(driverId) || []).slice(-10);
    const constructorHistory: DriverHistoryEntry[] = [];
    // Collect recent races for this constructor from other drivers
    for (const [dId, entries] of driverHistories) {
      if (dId !== driverId) {
        const sameConstructorRaces = race.results.filter((r) => r.constructorId === constructorId);
        if (sameConstructorRaces.length > 0) {
          for (const e of entries) {
            constructorHistory.push(e);
          }
          break;
        }
      }
    }

    const input = buildRaceWinnerInput(
      race.season, race.round, race.circuitId,
      driverId, constructorId, result, race,
      driverHistory,
      constructorHistory.slice(-10),
    );
    raceInputs.push(input);

    driverEntriesThisRace.push({
      driverId,
      entry: {
        finishPosition: pos,
        gridPosition: gridPos,
        winner,
        podium,
        dnf,
        lapsCompleted: laps,
        totalLaps,
        season: race.season,
        round: race.round,
      },
    });
  }

  // Build candidates using our feature builder
  for (const input of raceInputs) {
    const features = buildFeaturesDirect(input);
    const isWinner = input.driverId === raceInputs.find((ri) => {
      const res = race.results.find((r) => r.driverId === ri.driverId);
      return res && num(res.position) === 1;
    })?.driverId;

    allCandidates.push({
      raceKey,
      driverId: input.driverId,
      constructorId: input.constructorId,
      winner: isWinner || false,
      features,
    });
  }

  // Update histories AFTER processing this race
  for (const { driverId, entry } of driverEntriesThisRace) {
    addHistory(driverId, entry);
  }
}

// Split into train/test by season
const trainCandidates = allCandidates.filter((c) => {
  const season = parseInt(c.raceKey.split('-')[0]);
  return EVAL_SEASONS.includes(season);
});
const testCandidates = allCandidates.filter((c) => {
  const season = parseInt(c.raceKey.split('-')[0]);
  return TEST_SEASONS.includes(season);
});

function groupByRace(candidates: WinnerPredictionCandidate[]): WinnerPredictionCandidate[][] {
  const groups = new Map<string, WinnerPredictionCandidate[]>();
  for (const c of candidates) {
    const list = groups.get(c.raceKey) || [];
    list.push(c);
    groups.set(c.raceKey, list);
  }
  return [...groups.values()];
}

const trainGroups = groupByRace(trainCandidates);
const testGroups = groupByRace(testCandidates);

console.log(`\nTraining races: ${trainGroups.length} (${EVAL_SEASONS.join(', ')})`);
console.log(`Test races: ${testGroups.length} (${TEST_SEASONS.join(', ')})`);
console.log(`Total candidates: ${allCandidates.length}`);

// Train
console.log('\n--- Training ---');
const model = trainWinnerPredictionModel(trainGroups, {
  iterations: 240,
  learningRate: 0.08,
  l2: 0.002,
});

// Evaluate on test set
console.log('\n--- Evaluation ---');
const metrics = evaluateWinnerPredictions(testGroups, model);
console.log(`Top-1 Accuracy:  ${(metrics.top1Accuracy * 100).toFixed(1)}%`);
console.log(`Top-3 Accuracy:  ${(metrics.top3Accuracy * 100).toFixed(1)}%`);
console.log(`Avg Winner Rank: ${metrics.averageWinnerRank.toFixed(2)}`);
console.log(`Log Loss:        ${metrics.logLoss.toFixed(4)}`);
console.log(`Brier Score:     ${metrics.brierScore.toFixed(4)}`);

// Baseline comparison
const baseline = buildPoleBaselineModel();
const baselineMetrics = evaluateWinnerPredictions(testGroups, baseline);
console.log('\n--- Pole Baseline (reference) ---');
console.log(`Top-1 Accuracy:  ${(baselineMetrics.top1Accuracy * 100).toFixed(1)}%`);
console.log(`Top-3 Accuracy:  ${(baselineMetrics.top3Accuracy * 100).toFixed(1)}%`);
console.log(`Log Loss:        ${baselineMetrics.logLoss.toFixed(4)}`);

// Print per-race predictions
console.log('\n--- Per-Race Predictions ---');
for (const race of testGroups.slice(0, 10)) {
  const scores = race.map((c) => {
    let s = model.bias;
    for (const feat of WINNER_PREDICTION_FEATURES) {
      s += (c.features[feat] || 0) * (model.weights[feat] || 0);
    }
    return { driverId: c.driverId, score: s, winner: c.winner };
  });
  const maxScore = Math.max(...scores.map((s) => s.score));
  const exps = scores.map((s) => Math.exp(s.score - maxScore));
  const total = exps.reduce((a, b) => a + b, 0);
  const probs = scores.map((s, i) => ({ ...s, prob: exps[i] / total }))
    .sort((a, b) => b.prob - a.prob);

  const actual = race.find((c) => c.winner);
  const predicted = probs[0];
  const correct = predicted.driverId === actual?.driverId ? '✓' : '✗';
  console.log(`\nRace: ${race[0].raceKey} ${correct}`);
  console.log(`  Actual:  ${actual?.driverId || 'unknown'}`);
  console.log(`  Predict: ${predicted.driverId} (${(predicted.prob * 100).toFixed(1)}%)`);
  for (const p of probs.slice(1, 3)) {
    console.log(`           ${p.driverId} (${(p.prob * 100).toFixed(1)}%)`);
  }
}

// Top feature weights
console.log('\n--- Top 20 Feature Weights (by |weight|) ---');
const sortedWeights = Object.entries(model.weights)
  .filter(([, w]) => w != null)
  .sort((a, b) => Math.abs(b[1]!) - Math.abs(a[1]!))
  .slice(0, 20);
for (const [name, weight] of sortedWeights) {
  console.log(`  ${name}: ${weight!.toFixed(4)}`);
}

console.log('\n=== Done ===');
