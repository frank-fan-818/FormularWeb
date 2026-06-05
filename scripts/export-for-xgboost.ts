/**
 * Export ALL 172 feature vectors to JSON for XGBoost.
 * Imports the full feature builder from eval-fastf1-features.ts
 *
 * Usage: npx tsx scripts/export-for-xgboost.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { WINNER_PREDICTION_FEATURES } from '../src/utils/raceWinnerPrediction.ts';

// Copy all helpers from eval-fastf1-features.ts
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
function ns(p: number, t: number): number { return t > 1 ? 1 - (2 * (p - 1)) / (t - 1) : 0; }
function nrate(r: number, neu: number): number { return r >= neu ? Math.min(1, (r - neu) / (1 - neu)) : Math.max(-1, (r - neu) / neu); }
function clamp(v: number): number { return Math.max(-1, Math.min(1, v)); }

const DATA_ROOT = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons');
const FASTF1_ROOT = path.join(process.cwd(), 'public', 'fastf1');

// Types
interface ResultYaml { position?: number | string | null; driverId: string; constructorId: string; points?: number | string | null; gridPosition?: number | string | null; laps?: number | string | null; reasonRetired?: string | null; }
interface QualifyingYaml { position?: number | string | null; driverId: string; constructorId: string; q1?: string | null; q2?: string | null; q3?: string | null; }
interface PracticeYaml { position?: number | string | null; driverId: string; constructorId: string; time?: string | null; laps?: number | string | null; }
interface StandingYaml { position?: number | string | null; driverId: string; constructorId: string; points?: number | string | null; wins?: number | string | null; }

interface RaceData { season: number; round: number; circuitId: string; results: ResultYaml[]; qualifying: QualifyingYaml[]; fp1: PracticeYaml[]; fp2: PracticeYaml[]; fp3: PracticeYaml[]; sprintResults: ResultYaml[]; sprintQualifying: QualifyingYaml[]; driverStandings: StandingYaml[]; constructorStandings: StandingYaml[]; }

function loadSeason(season: number): RaceData[] {
  const seasonDir = path.join(DATA_ROOT, String(season));
  if (!existsSync(seasonDir)) return [];
  const races: RaceData[] = [];
  const racesDir = path.join(seasonDir, 'races');
  const dirs = readdirSync(racesDir).filter((d) => /^\d{2}-/.test(d));
  for (const dir of dirs) {
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
      sprintQualifying: (readYaml<QualifyingYaml[]>(path.join(rp, 'sprint-qualifying-results.yml')) ?? readYaml<QualifyingYaml[]>(path.join(rp, 'sprint-shootout-results.yml')) ?? []),
      driverStandings: readYaml<StandingYaml[]>(path.join(rp, 'driver-standings.yml')) ?? [],
      constructorStandings: readYaml<StandingYaml[]>(path.join(rp, 'constructor-standings.yml')) ?? [],
    });
  }
  return races.sort((a, b) => a.round - b.round);
}

// FastF1 loading (simplified)
interface FastF1WeatherSummary { airTempC?: { average?: number }; trackTempC?: { average?: number }; humidityPct?: { average?: number }; rainPointCount?: number; maxWindSpeedMps?: number; }
interface FastF1RacePayload { sessionResults?: Array<{ driverId: string; firstName?: string; lastName?: string; }>; weather?: { summary?: FastF1WeatherSummary }; }

function loadFastF1(season: number, round: number): FastF1RacePayload | null {
  const filePath = path.join(FASTF1_ROOT, String(season), String(round), 'R.json');
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, 'utf8')) as FastF1RacePayload; } catch { return null; }
}

interface DriverHistoryEntry { finishPosition: number; gridPosition: number; winner: boolean; podium: boolean; dnf: boolean; lapsCompleted: number; totalLaps: number; }

// Build full 172 features (same logic as eval-fastf1-features.ts)
function buildFeatures(race: RaceData, result: ResultYaml, driverHistory: DriverHistoryEntry[]): Record<string, number> {
  const driverId = result.driverId;
  const constructorId = result.constructorId;
  const pos = num(result.position) || 20;
  const gridPos = num(result.gridPosition) || pos;
  const totalDrivers = race.results.length;
  const feats: Record<string, number> = {};

  // Grid/Qualifying
  feats.gridAdvantage = ns(gridPos, totalDrivers);
  feats.gridPole = gridPos === 1 ? 1 : 0;
  feats.gridFrontRow = gridPos <= 2 ? 1 : 0;
  feats.gridTop3 = gridPos <= 3 ? 1 : 0;
  feats.poleModelProbability = gridPos === 1 ? 1 : gridPos <= 3 ? 0.6 : Math.max(0, 1 - (gridPos - 1) / totalDrivers);
  feats.poleModelRankAdvantage = ns(gridPos, totalDrivers);
  feats.poleModelScore = gridPos === 1 ? 2 : gridPos <= 3 ? 1 : ns(gridPos, totalDrivers);

  const qResult = race.qualifying.find((q) => q.driverId === driverId);
  const qPos = qResult ? (num(qResult.position) || gridPos) : gridPos;
  feats.qualifyingAdvantage = ns(qPos, totalDrivers);
  feats.qualifyingPole = qPos === 1 ? 1 : 0;
  feats.qualifyingFrontRow = qPos <= 2 ? 1 : 0;

  const allQ3Times = race.qualifying.map((q) => timeToSeconds(q.q3)).filter((t): t is number => t != null);
  if (allQ3Times.length > 0 && qResult?.q3) {
    const q3t = timeToSeconds(qResult.q3);
    const best = Math.min(...allQ3Times);
    if (q3t != null) {
      feats.qualifyingPaceAdvantage = clamp(1 - (q3t - best) / 2);
      feats.qualifyingPaceSharpAdvantage = q3t - best < 0.1 ? 1 : q3t - best < 0.3 ? 0.5 : 0;
    }
  }

  const teamMate = race.results.find((r) => r.constructorId === constructorId && r.driverId !== driverId);
  const teamMateQ = teamMate ? race.qualifying.find((q) => q.driverId === teamMate.driverId) : null;
  if (teamMateQ?.q3 && qResult?.q3) {
    const mateT = timeToSeconds(teamMateQ.q3);
    const myT = timeToSeconds(qResult.q3);
    if (mateT != null && myT != null) feats.teamMateQualifyingAdvantage = clamp((mateT - myT) / 0.5);
  }

  // Standings
  const ds = race.driverStandings.find((s) => s.driverId === driverId);
  const cs = race.constructorStandings.find((s) => s.constructorId === constructorId);
  feats.driverStandingAdvantage = ds ? ns(num(ds.position) || totalDrivers, totalDrivers) : 0;
  feats.driverStandingPointsShare = clamp((num(ds?.points || 0) / totalDrivers - 10) / 50);
  feats.constructorStandingAdvantage = cs ? ns(num(cs.position) || 10, 10) : 0;
  feats.constructorStandingPointsShare = clamp((num(cs?.points || 0) / 10 - 10) / 50);
  feats.driverSeasonWinRate = ds ? nrate(num(ds.wins || 0) / totalDrivers, 0.1) : 0;
  feats.constructorSeasonWinRate = cs ? nrate(num(cs.wins || 0) / 10, 0.1) : 0;

  // Practice
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
  const teamMateFp = teamMate ? race.fp2.find((r) => r.driverId === teamMate.driverId) : null;
  if (teamMateFp && myBest != null && timeToSeconds(teamMateFp.time) != null) {
    feats.fpTeamMateAdvantage = clamp((timeToSeconds(teamMateFp.time)! - myBest) / 0.5);
  }

  // Sprint
  const sprintResult = race.sprintResults.find((r) => r.driverId === driverId);
  const sprintQResult = race.sprintQualifying.find((r) => r.driverId === driverId);
  feats.sprintWeekend = race.sprintResults.length > 0 ? 1 : 0;
  if (sprintResult && race.sprintResults.length > 1) feats.sprintFinishAdvantage = ns(num(sprintResult.position) || 20, race.sprintResults.length);
  if (sprintQResult && race.sprintQualifying.length > 1) feats.sprintQualifyingAdvantage = ns(num(sprintQResult.position) || 20, race.sprintQualifying.length);

  // Round progress
  feats.raceRoundProgress = (2 * (race.round - 1)) / 23 - 1;

  // Street circuits
  const streetCircuits = new Set(['monaco', 'baku', 'singapore', 'jeddah', 'miami', 'las_vegas', 'albert_park', 'montreal']);
  feats.circuitStreetTrack = streetCircuits.has(race.circuitId) ? 1 : 0;
  feats.circuitLowOvertake = feats.circuitStreetTrack === 1 ? 0.8 : 0.4;
  feats.circuitTyreStress = 0.5;
  feats.circuitRestartRisk = feats.circuitStreetTrack === 1 ? 0.5 : 0.3;
  feats.circuitQualifyingImportance = feats.circuitStreetTrack === 1 ? 0.9 : 0.5;

  // Driver recent form
  const recent = driverHistory.slice(-10);
  if (recent.length > 0) {
    feats.driverRecentWinRate = nrate(recent.filter((r) => r.winner).length / recent.length, 0.1);
    feats.driverRecentPodiumRate = nrate(recent.filter((r) => r.podium).length / recent.length, 0.3);
    feats.driverShortRecentWinRate = nrate(recent.filter((r) => r.winner).length / recent.length, 0.1);
    feats.driverLongRecentWinRate = nrate(recent.filter((r) => r.winner).length / Math.max(recent.length, 1), 0.05);
    const avgFinish = recent.reduce((s, r) => s + r.finishPosition, 0) / recent.length;
    feats.driverRecentFinishForm = ns(Math.round(avgFinish), 20);
    let lapsDone = 0, lapsTotal = 0;
    for (const r of recent) { lapsDone += r.lapsCompleted; lapsTotal += r.totalLaps; }
    feats.driverRecentReliability = lapsTotal > 0 ? nrate(lapsDone / lapsTotal, 0.9) : 0;

    // Constructor form from team mate
    if (teamMate) {
      feats.constructorRecentPodiumRate = teamMate && num(teamMate.position) <= 3 ? 1 : 0;
      feats.constructorRecentWinRate = teamMate && num(teamMate.position) === 1 ? 1 : 0;
    }
  }

  // Weather (from FastF1)
  const fastf1 = loadFastF1(race.season, race.round);
  if (fastf1?.weather?.summary) {
    const ws = fastf1.weather.summary;
    feats.weatherRainRisk = ws.rainPointCount ? clamp(ws.rainPointCount / 100) : 0;
    feats.weatherCoolTrack = (ws.trackTempC?.average ?? 30) < 25 ? 1 : (ws.trackTempC?.average ?? 30) < 30 ? 0 : -1;
    feats.weatherHotTrack = (ws.trackTempC?.average ?? 30) > 40 ? 1 : (ws.trackTempC?.average ?? 30) > 35 ? 0 : -1;
    feats.weatherHumidity = ws.humidityPct?.average != null ? nrate(ws.humidityPct.average / 100, 0.5) : 0;
    feats.weatherWind = ws.maxWindSpeedMps != null ? clamp(ws.maxWindSpeedMps / 15) : 0;
  }

  // Fill all keys
  for (const feat of WINNER_PREDICTION_FEATURES) {
    if (!(feat in feats)) feats[feat] = 0;
  }
  return feats;
}

// ============================================================================
// Main
// ============================================================================

console.log('Exporting full 172-feature vectors for XGBoost...\n');

const allSeasons = [2022, 2023, 2024, 2025];
const allRaces: RaceData[] = [];
for (const s of allSeasons) allRaces.push(...loadSeason(s));
allRaces.sort((a, b) => a.season !== b.season ? a.season - b.season : a.round - b.round);

const driverHistories = new Map<string, DriverHistoryEntry[]>();
const exportData: Array<{
  season: number; round: number; raceKey: string;
  driverId: string; constructorId: string;
  winner: boolean; features: Record<string, number>;
}> = [];

for (const race of allRaces) {
  const raceKey = `${race.season}-${race.round}`;
  const entriesThisRace: Array<{ driverId: string; entry: DriverHistoryEntry }> = [];

  for (const result of race.results) {
    const driverId = result.driverId;
    const driverHistory = (driverHistories.get(driverId) || []).slice(-10);
    const features = buildFeatures(race, result, driverHistory);
    const pos = num(result.position) || 20;

    exportData.push({
      season: race.season, round: race.round, raceKey,
      driverId, constructorId: result.constructorId,
      winner: pos === 1, features,
    });

    entriesThisRace.push({
      driverId,
      entry: {
        finishPosition: pos,
        gridPosition: num(result.gridPosition) || pos,
        winner: pos === 1, podium: pos <= 3,
        dnf: result.reasonRetired != null || pos > 20,
        lapsCompleted: num(result.laps) || 0,
        totalLaps: Math.max(...race.results.map((r) => num(r.laps) || 0)),
      },
    });
  }

  for (const { driverId: did, entry } of entriesThisRace) {
    const hist = driverHistories.get(did) || [];
    hist.push(entry);
    driverHistories.set(did, hist);
  }
}

const outputPath = path.join(process.cwd(), 'docs', 'model-artifacts', 'xgboost-features.json');
writeFileSync(outputPath, JSON.stringify(exportData));
console.log(`Exported ${exportData.length} samples`);
console.log(`Feature count: ${WINNER_PREDICTION_FEATURES.length}`);
console.log(`Races: ${new Set(exportData.map((d) => d.raceKey)).size}`);
console.log('Done.');
