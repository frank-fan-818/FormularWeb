import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { PredictionSeasonRaceData } from '../src/types/predictionData.ts';
import {
  buildCurrentRaceFeatureInputs,
  getPredictionPhase,
  hasCompletePredictionField,
  selectPredictionTarget,
  type ScheduledPredictionRace,
} from '../src/utils/currentRacePrediction.ts';
import { buildWinnerCandidates } from '../src/utils/winnerFeatureBuilder.ts';
import {
  predictWinnerRace,
  type WinnerPredictionWeights,
} from '../src/utils/raceWinnerPrediction.ts';

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const MODEL_PATH = path.resolve('docs/model-artifacts/winner-prediction-backtest.json');
const REQUEST_TIMEOUT_MS = 15_000;

interface ModelArtifact {
  generatedAt: string;
  config: { modelKind: string; featureCount: number };
  metrics: unknown;
  model: WinnerPredictionWeights;
}

type JsonRecord = Record<string, unknown>;

function log(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ scope: 'race-winner-publisher', event, ...details }));
}

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null ? value as JsonRecord : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeId(value: unknown): string {
  return textValue(value).trim().replace(/_/g, '-');
}

async function fetchRaces(endpoint: string): Promise<JsonRecord[]> {
  const response = await fetch(`${JOLPICA_BASE_URL}${endpoint}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Jolpica ${endpoint} returned HTTP ${response.status}`);
  const payload = asRecord(await response.json());
  const mrData = asRecord(payload.MRData);
  const raceTable = asRecord(mrData.RaceTable);
  return asArray(raceTable.Races);
}

function keyOf(race: JsonRecord): string {
  return `${numberValue(race.season)}-${numberValue(race.round)}`;
}

function mapResult(value: JsonRecord) {
  const driver = asRecord(value.Driver);
  const constructor = asRecord(value.Constructor);
  return {
    position: numberValue(value.position),
    driverId: normalizeId(driver.driverId),
    constructorId: normalizeId(constructor.constructorId),
    points: numberValue(value.points),
    gridPosition: numberValue(value.grid),
    laps: numberValue(value.laps),
    status: textValue(value.status) || 'Unknown',
  };
}

function mapQualifying(value: JsonRecord) {
  const driver = asRecord(value.Driver);
  const constructor = asRecord(value.Constructor);
  return {
    position: numberValue(value.position),
    driverId: normalizeId(driver.driverId),
    constructorId: normalizeId(constructor.constructorId),
    q1: textValue(value.Q1) || null,
    q2: textValue(value.Q2) || null,
    q3: textValue(value.Q3) || null,
  };
}

function indexSessions(races: JsonRecord[], field: string): Map<string, JsonRecord[]> {
  return new Map(races.map((race) => [keyOf(race), asArray(race[field])]));
}

async function loadSeason(season: number): Promise<ScheduledPredictionRace[]> {
  const [schedule, results, qualifying, sprint, sprintQualifying] = await Promise.all([
    fetchRaces(`/${season}.json?limit=100`),
    fetchRaces(`/${season}/results.json?limit=2000`),
    fetchRaces(`/${season}/qualifying.json?limit=2000`),
    fetchRaces(`/${season}/sprint.json?limit=1000`).catch(() => []),
    fetchRaces(`/${season}/sprint/qualifying.json?limit=1000`).catch(() => []),
  ]);
  const resultByRace = indexSessions(results, 'Results');
  const qualifyingByRace = indexSessions(qualifying, 'QualifyingResults');
  const sprintByRace = indexSessions(sprint, 'SprintResults');
  const sprintQualifyingByRace = indexSessions(sprintQualifying, 'SprintQualifyingResults');

  return schedule.map((race) => {
    const raceKey = keyOf(race);
    const circuit = asRecord(race.Circuit);
    const raceDate = textValue(race.date);
    const raceTime = textValue(race.time) || '00:00:00Z';
    const sprintResults = (sprintByRace.get(raceKey) || []).map(mapResult);
    const sprintQualifyingResults = (sprintQualifyingByRace.get(raceKey) || []).map(mapQualifying);
    return {
      season,
      round: numberValue(race.round),
      raceName: textValue(race.raceName),
      circuitId: normalizeId(circuit.circuitId),
      raceStartAt: new Date(`${raceDate}T${raceTime}`).toISOString(),
      isSprintWeekend: sprintResults.length > 0 || sprintQualifyingResults.length > 0,
      results: (resultByRace.get(raceKey) || []).map(mapResult),
      qualifying: (qualifyingByRace.get(raceKey) || []).map(mapQualifying),
      sprintResults,
      sprintQualifying: sprintQualifyingResults,
    };
  }).filter((race) => race.round > 0 && race.raceName && Number.isFinite(Date.parse(race.raceStartAt)));
}

async function publishToSupabase(
  artifact: ModelArtifact,
  modelVersion: string,
  target: ScheduledPredictionRace,
  generatedAt: string,
  inputHash: string,
  prediction: ReturnType<typeof predictWinnerRace>,
) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for publishing.');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const phase = getPredictionPhase(target);
  const { data: existingRun, error: existingRunError } = await supabase
    .from('prediction_runs')
    .select('id')
    .eq('season', target.season)
    .eq('round', target.round)
    .eq('phase', phase)
    .eq('model_version', modelVersion)
    .eq('input_hash', inputHash)
    .maybeSingle();
  if (existingRunError) throw existingRunError;
  if (existingRun) return { published: false, runId: existingRun.id };

  const { error: deactivateError } = await supabase.from('prediction_models').update({ is_active: false }).eq('is_active', true);
  if (deactivateError) throw deactivateError;
  const { error: modelError } = await supabase.from('prediction_models').upsert({
    version: modelVersion,
    feature_schema_version: 1,
    trained_through_season: target.season,
    trained_through_round: Math.max(0, target.round - 1),
    artifact: artifact.model,
    metrics: artifact.metrics,
    is_active: true,
  }, { onConflict: 'version' });
  if (modelError) throw modelError;

  const { data: run, error: runError } = await supabase.from('prediction_runs').upsert({
    season: target.season,
    round: target.round,
    race_name: target.raceName,
    phase,
    model_version: modelVersion,
    input_hash: inputHash,
    generated_at: generatedAt,
    data_cutoff_at: generatedAt,
  }, { onConflict: 'season,round,phase,model_version,input_hash' }).select('id').single();
  if (runError || !run) throw runError || new Error('Prediction run did not return an id.');

  const { error: candidatesError } = await supabase.from('prediction_candidates').upsert(
    prediction.map((candidate) => ({
      run_id: run.id,
      driver_id: candidate.driverId,
      constructor_id: candidate.constructorId,
      rank: candidate.rank,
      probability: candidate.probability,
      score: candidate.score,
      factors: candidate.factors.map(({ feature, contribution }) => ({ feature, contribution })),
    })),
    { onConflict: 'run_id,driver_id' },
  );
  if (candidatesError) throw candidatesError;
  return { published: true, runId: run.id };
}

async function main() {
  const season = Number(getArg('season') || new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 1950) throw new Error('Invalid --season value.');
  const generatedAt = new Date().toISOString();
  const races = await loadSeason(season);
  const target = selectPredictionTarget(races);
  if (!target) {
    log('skipped', { season, reason: 'no-future-race' });
    return;
  }
  const completedRaces: PredictionSeasonRaceData[] = races.filter((race) => race.results.some((result) => result.position === 1));
  const featureInputs = buildCurrentRaceFeatureInputs(target, completedRaces);
  if (!hasCompletePredictionField(featureInputs.length)) {
    log('skipped', {
      season,
      round: target.round,
      reason: 'incomplete-entry-field',
      candidateCount: featureInputs.length,
    });
    return;
  }

  const artifact = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as ModelArtifact;
  const modelVersion = `winner-linear-head-${artifact.generatedAt.slice(0, 10)}`;
  const candidates = buildWinnerCandidates(`${season}-${target.round}`, featureInputs);
  const prediction = predictWinnerRace(candidates, artifact.model);
  const inputHash = createHash('sha256').update(JSON.stringify({ target, completedRaces, modelVersion })).digest('hex');
  const output = {
    season,
    round: target.round,
    raceName: target.raceName,
    phase: getPredictionPhase(target),
    modelVersion,
    generatedAt,
    dataCutoffAt: generatedAt,
    inputHash,
    candidates: prediction,
  };
  const outputPath = getArg('output');
  if (outputPath) writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const publication = hasFlag('dry-run')
    ? { published: false, runId: null }
    : await publishToSupabase(artifact, modelVersion, target, generatedAt, inputHash, prediction);
  log(hasFlag('dry-run') ? 'generated' : publication.published ? 'published' : 'unchanged', {
    season,
    round: target.round,
    phase: output.phase,
    favourite: prediction[0]?.driverId,
    probability: prediction[0]?.probability,
    inputHash,
    runId: publication.runId,
  });
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    scope: 'race-winner-publisher',
    event: 'failed',
    reason: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
