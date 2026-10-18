import 'dotenv/config';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withRetry } from '../src/utils/withRetry.ts';
import { fetchPaginatedRaceTable } from '../src/api/jolpicaRacePagination.ts';
import { createClient } from '@supabase/supabase-js';
import type { PredictionSeasonRaceData } from '../src/types/predictionData.ts';
import type { RacePredictionModelArtifact, PhasePredictionModel } from '../src/types/racePredictionModel.ts';
import { buildPhaseCandidates, eligiblePredictionHistory, PREDICTION_FEATURE_SCHEMA_VERSION, predictPhaseRace, selectPhaseModel } from '../src/utils/racePredictionTraining.ts';
import { loadPredictionHistory, loadPreRaceObservations } from './prediction-history.ts';
import { latestPreRaceObservation } from '../src/utils/racePredictionHistory.ts';
import {
  getPredictionPhase,
  hasCompletePredictionField,
  selectPredictionTarget,
  type ScheduledPredictionRace,
} from '../src/utils/currentRacePrediction.ts';
import {
  predictWinnerRace,
} from '../src/utils/raceWinnerPrediction.ts';

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const MODEL_PATH = path.resolve('docs/model-artifacts/race-prediction-models.json');
const REQUEST_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

function log(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ scope: 'race-winner-publisher', event, ...details }));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Prediction: ${event}\n\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\`\n`);
  }
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
  return fetchPaginatedRaceTable(endpoint, (pageEndpoint) => withRetry(async (signal) => {
    const response = await fetch(`${JOLPICA_BASE_URL}${pageEndpoint}`, {
      signal,
    }).catch((cause: unknown) => { throw Object.assign(new Error('Network request failed while loading Jolpica'), { cause }); });
    if (!response.ok) throw Object.assign(new Error(`Jolpica ${pageEndpoint} returned HTTP ${response.status}`), { status: response.status });
    return response.json();
  }, { timeoutMs: REQUEST_TIMEOUT_MS, maxRetries: 2 }));
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

export async function loadSeason(season: number): Promise<ScheduledPredictionRace[]> {
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

export async function publishToSupabase(
  artifact: PhasePredictionModel,
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
  if (existingRun) {
    const { data: saved, error } = await supabase.from('prediction_candidates')
      .select('driver_id').eq('run_id', existingRun.id);
    if (error) throw error;
    const expected = new Set(prediction.map((candidate) => candidate.driverId));
    if (saved?.length === expected.size && saved.every((row) => expected.has(row.driver_id))) {
      return { published: false, runId: existingRun.id };
    }
    log('repairing-incomplete-publication', { runId: existingRun.id });
  }

  // A temporarily missing qualifying response must not replace a final forecast.
  if (phase === 'pre_weekend') {
    const { data: current, error } = await supabase.from('race_prediction_current')
      .select('run_id,phase,candidates').eq('season', target.season).eq('round', target.round).maybeSingle();
    if (error) throw error;
    if (current?.phase === 'post_quali' && hasCompletePredictionField(current.candidates?.length || 0)) {
      return { published: false, runId: current.run_id };
    }
  }

  const { error: deactivateError } = await supabase.from('prediction_models').update({ is_active: false }).eq('is_active', true);
  if (deactivateError) throw deactivateError;
  const { error: modelError } = await supabase.from('prediction_models').upsert({
    version: modelVersion,
    feature_schema_version: PREDICTION_FEATURE_SCHEMA_VERSION,
    trained_through_season: artifact.training.trainedThrough.season,
    trained_through_round: artifact.training.trainedThrough.round,
    artifact: { phase: artifact.phase, featureNames: artifact.featureNames, model: artifact.model, training: artifact.training, recipe: artifact.recipe, calibration: artifact.calibration },
    metrics: artifact.backtest,
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
  target.preRaceObservations = loadPreRaceObservations(season, target.round);
  const artifact = JSON.parse(readFileSync(MODEL_PATH, 'utf8')) as RacePredictionModelArtifact;
  const liveHistory: PredictionSeasonRaceData[] = races.filter((race) => race.results.some((result) => result.position === 1));
  const historical = loadPredictionHistory(artifact.config.historyStartSeason, season);
  const completedRaces = eligiblePredictionHistory([...historical, ...liveHistory.map((race) => ({ ...race, preRaceObservations: loadPreRaceObservations(race.season, race.round) }))], generatedAt);
  const phaseModel = selectPhaseModel(artifact, target, completedRaces);
  const candidates = buildPhaseCandidates(target, completedRaces, phaseModel.phase, phaseModel.recipe.featureSet, generatedAt);
  if (!hasCompletePredictionField(candidates.length)) {
    throw new Error(`Incomplete entry field for ${season}/${target.round}: ${candidates.length} candidates. Publication must be retried.`);
  }

  const modelHash = createHash('sha256').update(JSON.stringify({ schema: artifact.featureSchemaVersion,
    phase: phaseModel.phase, features: phaseModel.featureNames, model: phaseModel.model, training: phaseModel.training,
    recipe: phaseModel.recipe, calibration: phaseModel.calibration })).digest('hex').slice(0, 16);
  const modelVersion = `winner-v3-${phaseModel.phase}-${modelHash}`;
  const prediction = predictPhaseRace(candidates, phaseModel);
  const confirmed = latestPreRaceObservation(target, phaseModel.phase, generatedAt);
  const inputCoverage = { roster: confirmed ? 'confirmed' : target.qualifying.length ? 'qualifying' : 'estimated',
    grid: confirmed?.entries.every((row) => row.gridPosition !== undefined) ? 'confirmed' : 'qualifying-proxy' };
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
    inputCoverage,
  };
  const outputPath = getArg('output');
  if (outputPath) writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  const publication = hasFlag('dry-run')
    ? { published: false, runId: null }
    : await publishToSupabase(phaseModel, modelVersion, target, generatedAt, inputHash, prediction);
  log(hasFlag('dry-run') ? 'generated' : publication.published ? 'published' : 'unchanged', {
    season,
    round: target.round,
    phase: output.phase,
    candidateCount: prediction.length,
    inputCoverage,
    favourite: prediction[0]?.driverId,
    probability: prediction[0]?.probability,
    inputHash,
    runId: publication.runId,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error: unknown) => {
  log('failed', {
    reason: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
