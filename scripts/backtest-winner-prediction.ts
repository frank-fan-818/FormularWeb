import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  WINNER_PREDICTION_FEATURES,
  buildPoleBaselineModel,
  evaluateWinnerPredictions,
  getWinnerPredictionEra,
  predictWinnerRace,
  scoreWinnerCandidate,
  trainWinnerPredictionModel,
  type WinnerPredictionCandidate,
  type WinnerPredictionEra,
  type WinnerPredictionFeatureVector,
  type WinnerPredictionFeatureName,
  type WinnerPredictionMetrics,
  type WinnerPredictionResult,
  type WinnerPredictionWeights,
} from '../src/utils/raceWinnerPrediction.ts';
import {
  predictNonlinearWinnerRace,
  scoreNonlinearWinnerCandidate,
  trainResidualWinnerPredictionModel,
  trainNonlinearWinnerPredictionModel,
  type NonlinearWinnerPredictionModel,
  type ResidualWinnerTrainingSample,
} from '../src/utils/raceWinnerNonlinearPrediction.ts';
import { buildRaceWinnerSequenceEmbedding, type RaceWinnerSequenceStep } from '../src/utils/raceWinnerSequenceModel.ts';
import type { FiaCarUpgradeSummary } from '../src/utils/fiaCarUpgrades.ts';

interface RaceYaml {
  id: number;
  round: number;
  officialName?: string;
  grandPrixId?: string;
  circuitId: string;
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

interface FastF1WeatherPayload {
  weather?: {
    points?: Array<{
      airTempC?: number | null;
      trackTempC?: number | null;
      humidityPct?: number | null;
      rainfall?: boolean | null;
      windSpeedMps?: number | null;
    }>;
    summary?: {
      airTempC?: { average?: number | null };
      trackTempC?: { average?: number | null };
      humidityPct?: { average?: number | null };
      rainPointCount?: number | null;
      maxWindSpeedMps?: number | null;
    };
  };
}

interface FastF1RacePayload extends FastF1WeatherPayload {
  trackStatusPeriods?: Array<{
    type?: 'YELLOW' | 'SC' | 'VSC' | 'RED' | string;
    label?: string;
    message?: string;
    startLap?: number | null;
    endLap?: number | null;
    startTimeSeconds?: number | null;
    endTimeSeconds?: number | null;
  }>;
  raceControlMessages?: Array<{
    category?: string;
    message?: string;
    status?: string;
    flag?: string;
    lap?: number | null;
  }>;
  lapTimeSeries?: Array<{
    driver?: string;
    driverId?: string;
    team?: string;
    laps?: Array<{
      lapNumber?: number | null;
      lapTimeSeconds?: number | null;
      compound?: string | null;
      stint?: number | null;
      tyreLife?: number | null;
      position?: number | null;
      freshTyre?: boolean | null;
    }>;
  }>;
  tyreStrategies?: Array<{
    driver?: string;
    driverId?: string;
    team?: string;
    stints?: Array<{
      startLap?: number | null;
      endLap?: number | null;
      lapCount?: number | null;
      compound?: string | null;
      freshTyre?: boolean | null;
      startTyreLife?: number | null;
      endTyreLife?: number | null;
    }>;
  }>;
  telemetrySummary?: Array<{
    driver?: string;
    driverId?: string;
    avgSpeedKph?: number | null;
    maxSpeedKph?: number | null;
    fullThrottlePct?: number | null;
  }>;
}

interface SourceRace {
  season: number;
  round: number;
  raceKey: string;
  raceName: string;
  circuitId: string;
  era: WinnerPredictionEra;
  isSprintWeekend: boolean;
  results: ResultYaml[];
  qualifying: QualifyingYaml[];
  practices: PracticeYaml[][];
  fastestLaps: ResultYaml[];
  pitStops: PracticeYaml[];
  sprintResults: ResultYaml[];
  sprintQualifying: QualifyingYaml[];
  weather: RaceWeatherSummary;
  safety: RaceSafetySummary;
}

interface RaceWeatherSummary {
  rainRisk: number;
  coolTrack: number;
  hotTrack: number;
  humidity: number;
  wind: number;
  trackAirDelta: number;
}

interface RaceSafetySummary {
  safetyCar: number;
  virtualSafetyCar: number;
  redFlag: number;
  yellow: number;
  restartRisk: number;
  disruptionScore: number;
}

interface DriverRaceSnapshot {
  position: number | null;
  qualifyingPosition: number | null;
  gridPosition: number | null;
  points: number;
  winner: boolean;
  podium: boolean;
  dnf: boolean;
  chaosScore: number;
  safetyCarScore: number;
  virtualSafetyCarScore: number;
  redFlagScore: number;
  weather: RaceWeatherSummary;
  longRunPaceAdvantage: number;
  tyreManagementAdvantage: number;
  stintLengthAdvantage: number;
  pitStopAdvantage: number;
  fastestLapAdvantage: number;
  telemetrySpeedAdvantage: number;
  postPitPaceAdvantage: number;
  strategyGainAdvantage: number;
  restartPaceAdvantage: number;
  restartGainAdvantage: number;
  safetyCarGainAdvantage: number;
  hotTrackTyreAdvantage: number;
  wetTrackPaceAdvantage: number;
  circuitProfile: CircuitRaceProfile;
}

interface ConstructorRaceSnapshot extends DriverRaceSnapshot {}

interface FiaUpgradeArtifact {
  summaries?: FiaCarUpgradeSummary[];
}

interface DeclaredUpgradeFeatures {
  intensity: number;
  count: number;
  performanceIntent: number;
  circuitSpecificIntent: number;
  reliabilityIntent: number;
  trackFit: number;
  trackTypeInteraction: number;
}

interface PredictionReportRace {
  raceKey: string;
  season: number;
  round: number;
  raceName: string;
  era: WinnerPredictionEra;
  actualWinner: string;
  predictedWinner: string;
  actualPole: string | null;
  predictedPole: string | null;
  poleRank: number | null;
  poleProbability: number | null;
  winnerRank: number;
  winnerProbability: number;
  brierScore: number;
  top3Hit: boolean;
  top5: Array<{
    rank: number;
    driverId: string;
    constructorId: string;
    probability: number;
    factors: Array<{
      feature: string;
      contribution: number;
    }>;
  }>;
}

interface PredictionReport {
  generatedAt: string;
  config: {
    modelKind: WinnerModelKind;
    nonlinearBlend: number;
    residualBlend: number;
    residualTrainingMode: 'in-sample' | 'out-of-fold';
    sequenceEncoder: 'fixed-recurrent';
    predictionPhase: PredictionPhase;
    windowSize: number;
    shortWindowSize: number;
    longWindowSize: number;
    minimumTrainingRaces: number;
    featureCount: number;
    poleFeatureCount: number;
  };
  metrics: {
    learnedModel: WinnerPredictionMetrics;
    trainedPoleModel: WinnerPredictionMetrics;
    poleBaseline: WinnerPredictionMetrics;
    byEra: Partial<Record<WinnerPredictionEra, WinnerPredictionMetrics>>;
  };
  model: WinnerPredictionWeights;
  nonlinearModel?: NonlinearWinnerPredictionModel;
  poleModel: WinnerPredictionWeights;
  races: PredictionReportRace[];
}

const DATA_ROOT = path.join(process.cwd(), 'f1db-main', 'src', 'data', 'seasons');
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'model-artifacts', 'winner-prediction-backtest.json');
const FIA_UPGRADES_PATH = path.join(process.cwd(), 'docs', 'model-artifacts', 'fia-car-upgrades-full-v2.json');
const FIA_UPGRADES_FALLBACK_PATH = path.join(process.cwd(), 'docs', 'model-artifacts', 'fia-car-upgrades.json');
const SHORT_WINDOW_SIZE = 3;
const WINDOW_SIZE = 5;
const LONG_WINDOW_SIZE = 10;
const MINIMUM_TRAINING_RACES = 24;
const MAX_GLOBAL_TRAINING_RACES = 24;
const MAX_ERA_TRAINING_RACES = 36;
const ROLLING_TRAINING_ITERATIONS = 24;
const TREND_FEATURE_BOOST = 0.5;
const PREDICTION_PHASES = ['pre-weekend', 'post-fp', 'post-quali'] as const;
type PredictionPhase = typeof PREDICTION_PHASES[number];
const WINNER_MODEL_KINDS = ['linear', 'mlp', 'hybrid', 'residual-hybrid'] as const;
type WinnerModelKind = typeof WINNER_MODEL_KINDS[number];

const PRE_WEEKEND_POLE_FEATURES = [
  'driverQualifyingTrend',
  'constructorQualifyingTrend',
  'driverStandingAdvantage',
  'constructorStandingAdvantage',
  'driverRecentFinishForm',
  'driverRecentPodiumRate',
  'driverRecentWinRate',
  'constructorRecentFinishForm',
  'constructorRecentPodiumRate',
  'constructorRecentWinRate',
  'driverSeasonWinRate',
  'constructorSeasonWinRate',
  'sameCircuitDriverWinRate',
  'sameCircuitDriverPodiumRate',
  'sameCircuitConstructorWinRate',
  'sameCircuitPoleWinRate',
  'weatherRainRisk',
  'weatherCoolTrack',
  'weatherHotTrack',
  'weatherWind',
  'driverSimilarWeatherForm',
  'constructorSimilarWeatherForm',
  'driverSequenceMomentum',
  'driverSequenceConsistency',
  'constructorSequenceMomentum',
  'constructorSequenceConsistency',
  'sprintWeekend',
] as const satisfies readonly WinnerPredictionFeatureName[];

const POST_FP_POLE_FEATURES = [
  ...PRE_WEEKEND_POLE_FEATURES,
  'fp1Advantage',
  'fp2Advantage',
  'fp3Advantage',
  'fpBestAdvantage',
  'fpAverageAdvantage',
  'fpBestGapAdvantage',
  'fpLapsShare',
  'fpTeamMateAdvantage',
  'fpConstructorAdvantage',
] as const satisfies readonly WinnerPredictionFeatureName[];

const POST_QUALI_POLE_FEATURES = [
  'qualifyingAdvantage',
  'qualifyingPaceAdvantage',
  'qualifyingPaceSharpAdvantage',
  'teamMateQualifyingAdvantage',
  ...POST_FP_POLE_FEATURES,
] as const satisfies readonly WinnerPredictionFeatureName[];

const PRE_WEEKEND_WINNER_FEATURES = WINNER_PREDICTION_FEATURES.filter((feature) => ![
  'gridAdvantage',
  'gridPole',
  'gridFrontRow',
  'gridTop3',
  'qualifyingAdvantage',
  'qualifyingPole',
  'qualifyingFrontRow',
  'qualifyingPaceAdvantage',
  'qualifyingPaceSharpAdvantage',
  'teamMateQualifyingAdvantage',
  'fp1Advantage',
  'fp2Advantage',
  'fp3Advantage',
  'fpBestAdvantage',
  'fpAverageAdvantage',
  'fpBestGapAdvantage',
  'fpLapsShare',
  'fpTeamMateAdvantage',
  'fpConstructorAdvantage',
  'sprintFinishAdvantage',
  'sprintQualifyingAdvantage',
  'gridPoleCircuitInteraction',
  'gridFrontRowCircuitInteraction',
  'gridTop3CircuitInteraction',
  'constructorQualifyingInteraction',
  'driverTeamMateInteraction',
].includes(feature)) as readonly WinnerPredictionFeatureName[];

const POST_FP_WINNER_FEATURES = WINNER_PREDICTION_FEATURES.filter((feature) => ![
  'gridAdvantage',
  'gridPole',
  'gridFrontRow',
  'gridTop3',
  'qualifyingAdvantage',
  'qualifyingPole',
  'qualifyingFrontRow',
  'qualifyingPaceAdvantage',
  'qualifyingPaceSharpAdvantage',
  'teamMateQualifyingAdvantage',
  'gridPoleCircuitInteraction',
  'gridFrontRowCircuitInteraction',
  'gridTop3CircuitInteraction',
  'constructorQualifyingInteraction',
  'driverTeamMateInteraction',
].includes(feature)) as readonly WinnerPredictionFeatureName[];

const POST_QUALI_WINNER_FEATURES = WINNER_PREDICTION_FEATURES;

function getStringArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function getPredictionPhase(): PredictionPhase {
  const phase = getStringArg('prediction-phase', 'post-quali');
  return PREDICTION_PHASES.includes(phase as PredictionPhase) ? phase as PredictionPhase : 'post-quali';
}

function getWinnerModelKind(): WinnerModelKind {
  const kind = getStringArg('model', 'linear');
  return WINNER_MODEL_KINDS.includes(kind as WinnerModelKind) ? kind as WinnerModelKind : 'linear';
}

function getPoleFeatureNames(phase: PredictionPhase): readonly WinnerPredictionFeatureName[] {
  if (phase === 'pre-weekend') {
    return PRE_WEEKEND_POLE_FEATURES;
  }

  if (phase === 'post-fp') {
    return POST_FP_POLE_FEATURES;
  }

  return POST_QUALI_POLE_FEATURES;
}

function getWinnerFeatureNames(phase: PredictionPhase): readonly WinnerPredictionFeatureName[] {
  if (phase === 'pre-weekend') {
    return PRE_WEEKEND_WINNER_FEATURES;
  }

  if (phase === 'post-fp') {
    return POST_FP_WINNER_FEATURES;
  }

  return POST_QUALI_WINNER_FEATURES;
}

function getNumberArg(name: string, fallback: number) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  const value = match ? Number(match.slice(prefix.length)) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function readYaml<T>(filePath: string): T {
  return YAML.parse(readFileSync(filePath, 'utf8')) as T;
}

function readYamlArray<T>(filePath: string): T[] {
  try {
    return readYaml<T[]>(filePath) || [];
  } catch {
    return [];
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function parseLapTimeSeconds(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
}

function normalizeFastF1DriverId(value: string | null | undefined) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

  const aliases: Record<string, string> = {
    norris: 'lando-norris',
    piastri: 'oscar-piastri',
    verstappen: 'max-verstappen',
    russell: 'george-russell',
    antonelli: 'kimi-antonelli',
    leclerc: 'charles-leclerc',
    hamilton: 'lewis-hamilton',
    sainz: 'carlos-sainz-jr',
    perez: 'sergio-perez',
    alonso: 'fernando-alonso',
    stroll: 'lance-stroll',
    gasly: 'pierre-gasly',
    ocon: 'esteban-ocon',
    hulkenberg: 'nico-hulkenberg',
    albon: 'alexander-albon',
    tsunoda: 'yuki-tsunoda',
    lawson: 'liam-lawson',
    bearman: 'oliver-bearman',
    bortoleto: 'gabriel-bortoleto',
    colapinto: 'franco-colapinto',
    bottas: 'valtteri-bottas',
  };

  return aliases[normalized] || normalized;
}

function median(values: number[], fallback = 0.5) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!sorted.length) {
    return fallback;
  }

  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function rankByHigherIsBetter(valuesByDriver: Map<string, number>, fieldSize: number) {
  const sorted = [...valuesByDriver.entries()]
    .filter(([, value]) => Number.isFinite(value))
    .sort((left, right) => right[1] - left[1]);

  return new Map(sorted.map(([driverId], index) => [
    driverId,
    normalizedPositionAdvantage(index + 1, Math.max(fieldSize, sorted.length)),
  ]));
}

function rankByLowerIsBetter(valuesByDriver: Map<string, number>, fieldSize: number) {
  const sorted = [...valuesByDriver.entries()]
    .filter(([, value]) => Number.isFinite(value))
    .sort((left, right) => left[1] - right[1]);

  return new Map(sorted.map(([driverId], index) => [
    driverId,
    normalizedPositionAdvantage(index + 1, Math.max(fieldSize, sorted.length)),
  ]));
}

function summarizeWeather(payload: FastF1WeatherPayload | null): RaceWeatherSummary {
  const points = payload?.weather?.points || [];
  const summary = payload?.weather?.summary;
  const averagePoint = (selector: (point: NonNullable<FastF1WeatherPayload['weather']>['points'][number]) => number | null | undefined) => {
    const values = points
      .map(selector)
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    return values.length ? average(values, 0) : null;
  };
  const trackTemp = summary?.trackTempC?.average ?? averagePoint((point) => point.trackTempC);
  const airTemp = summary?.airTempC?.average ?? averagePoint((point) => point.airTempC);
  const humidity = summary?.humidityPct?.average ?? averagePoint((point) => point.humidityPct);
  const rainPointCount = summary?.rainPointCount ?? points.filter((point) => point.rainfall).length;
  const maxWind = summary?.maxWindSpeedMps ?? Math.max(
    0,
    ...points
      .map((point) => point.windSpeedMps)
      .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value)),
  );

  return {
    rainRisk: points.length ? clamp(rainPointCount / points.length) : 0,
    coolTrack: trackTemp === null ? 0.5 : clamp((28 - trackTemp) / 18),
    hotTrack: trackTemp === null ? 0.5 : clamp((trackTemp - 32) / 22),
    humidity: humidity === null ? 0.5 : clamp(humidity / 100),
    wind: clamp(maxWind / 12),
    trackAirDelta: trackTemp === null || airTemp === null ? 0.5 : clamp((trackTemp - airTemp) / 25),
  };
}

const CIRCUIT_WEATHER_PRIORS: Record<string, RaceWeatherSummary> = {
  melbourne: { rainRisk: 0.24, coolTrack: 0.38, hotTrack: 0.22, humidity: 0.58, wind: 0.38, trackAirDelta: 0.42 },
  shanghai: { rainRisk: 0.28, coolTrack: 0.32, hotTrack: 0.28, humidity: 0.64, wind: 0.3, trackAirDelta: 0.42 },
  suzuka: { rainRisk: 0.34, coolTrack: 0.3, hotTrack: 0.32, humidity: 0.68, wind: 0.28, trackAirDelta: 0.44 },
  miami: { rainRisk: 0.38, coolTrack: 0.04, hotTrack: 0.78, humidity: 0.75, wind: 0.32, trackAirDelta: 0.5 },
  montreal: { rainRisk: 0.32, coolTrack: 0.28, hotTrack: 0.34, humidity: 0.62, wind: 0.36, trackAirDelta: 0.44 },
  monaco: { rainRisk: 0.22, coolTrack: 0.22, hotTrack: 0.42, humidity: 0.64, wind: 0.22, trackAirDelta: 0.46 },
  catalunya: { rainRisk: 0.16, coolTrack: 0.14, hotTrack: 0.56, humidity: 0.58, wind: 0.26, trackAirDelta: 0.5 },
  spielberg: { rainRisk: 0.36, coolTrack: 0.34, hotTrack: 0.26, humidity: 0.6, wind: 0.3, trackAirDelta: 0.4 },
  silverstone: { rainRisk: 0.38, coolTrack: 0.52, hotTrack: 0.1, humidity: 0.7, wind: 0.46, trackAirDelta: 0.3 },
  spa_francorchamps: { rainRisk: 0.46, coolTrack: 0.54, hotTrack: 0.08, humidity: 0.72, wind: 0.44, trackAirDelta: 0.3 },
  hungaroring: { rainRisk: 0.22, coolTrack: 0.08, hotTrack: 0.72, humidity: 0.5, wind: 0.2, trackAirDelta: 0.55 },
  zandvoort: { rainRisk: 0.4, coolTrack: 0.48, hotTrack: 0.12, humidity: 0.72, wind: 0.58, trackAirDelta: 0.32 },
  monza: { rainRisk: 0.24, coolTrack: 0.16, hotTrack: 0.5, humidity: 0.62, wind: 0.24, trackAirDelta: 0.48 },
  baku: { rainRisk: 0.16, coolTrack: 0.2, hotTrack: 0.48, humidity: 0.58, wind: 0.62, trackAirDelta: 0.48 },
  marina_bay: { rainRisk: 0.48, coolTrack: 0.02, hotTrack: 0.7, humidity: 0.84, wind: 0.18, trackAirDelta: 0.36 },
  austin: { rainRisk: 0.22, coolTrack: 0.18, hotTrack: 0.58, humidity: 0.55, wind: 0.36, trackAirDelta: 0.52 },
  mexico_city: { rainRisk: 0.18, coolTrack: 0.28, hotTrack: 0.24, humidity: 0.42, wind: 0.28, trackAirDelta: 0.48 },
  interlagos: { rainRisk: 0.52, coolTrack: 0.18, hotTrack: 0.5, humidity: 0.72, wind: 0.36, trackAirDelta: 0.48 },
  las_vegas: { rainRisk: 0.08, coolTrack: 0.62, hotTrack: 0.02, humidity: 0.24, wind: 0.34, trackAirDelta: 0.24 },
  lusail: { rainRisk: 0.04, coolTrack: 0.06, hotTrack: 0.76, humidity: 0.5, wind: 0.42, trackAirDelta: 0.54 },
  yas_marina: { rainRisk: 0.04, coolTrack: 0.08, hotTrack: 0.68, humidity: 0.56, wind: 0.28, trackAirDelta: 0.48 },
};

interface CircuitRaceProfile {
  streetTrack: number;
  lowOvertake: number;
  tyreStress: number;
  restartRisk: number;
  qualifyingImportance: number;
}

const DEFAULT_CIRCUIT_PROFILE: CircuitRaceProfile = {
  streetTrack: 0.25,
  lowOvertake: 0.45,
  tyreStress: 0.5,
  restartRisk: 0.35,
  qualifyingImportance: 0.5,
};

const CIRCUIT_RACE_PROFILES: Record<string, CircuitRaceProfile> = {
  monaco: { streetTrack: 1, lowOvertake: 0.95, tyreStress: 0.28, restartRisk: 0.72, qualifyingImportance: 0.96 },
  marina_bay: { streetTrack: 1, lowOvertake: 0.82, tyreStress: 0.78, restartRisk: 0.82, qualifyingImportance: 0.82 },
  baku: { streetTrack: 1, lowOvertake: 0.42, tyreStress: 0.44, restartRisk: 0.78, qualifyingImportance: 0.48 },
  las_vegas: { streetTrack: 1, lowOvertake: 0.35, tyreStress: 0.36, restartRisk: 0.62, qualifyingImportance: 0.42 },
  jeddah: { streetTrack: 1, lowOvertake: 0.4, tyreStress: 0.52, restartRisk: 0.72, qualifyingImportance: 0.52 },
  melbourne: { streetTrack: 0.7, lowOvertake: 0.54, tyreStress: 0.46, restartRisk: 0.58, qualifyingImportance: 0.58 },
  miami: { streetTrack: 0.65, lowOvertake: 0.5, tyreStress: 0.64, restartRisk: 0.55, qualifyingImportance: 0.52 },
  montreal: { streetTrack: 0.55, lowOvertake: 0.38, tyreStress: 0.48, restartRisk: 0.68, qualifyingImportance: 0.42 },
  silverstone: { streetTrack: 0, lowOvertake: 0.28, tyreStress: 0.72, restartRisk: 0.36, qualifyingImportance: 0.36 },
  spa_francorchamps: { streetTrack: 0, lowOvertake: 0.2, tyreStress: 0.64, restartRisk: 0.46, qualifyingImportance: 0.28 },
  monza: { streetTrack: 0, lowOvertake: 0.18, tyreStress: 0.38, restartRisk: 0.42, qualifyingImportance: 0.28 },
  catalunya: { streetTrack: 0, lowOvertake: 0.74, tyreStress: 0.78, restartRisk: 0.28, qualifyingImportance: 0.74 },
  hungaroring: { streetTrack: 0, lowOvertake: 0.86, tyreStress: 0.7, restartRisk: 0.34, qualifyingImportance: 0.86 },
  zandvoort: { streetTrack: 0.25, lowOvertake: 0.76, tyreStress: 0.66, restartRisk: 0.48, qualifyingImportance: 0.78 },
  suzuka: { streetTrack: 0, lowOvertake: 0.62, tyreStress: 0.72, restartRisk: 0.34, qualifyingImportance: 0.66 },
  lusail: { streetTrack: 0, lowOvertake: 0.54, tyreStress: 0.9, restartRisk: 0.32, qualifyingImportance: 0.56 },
  yas_marina: { streetTrack: 0, lowOvertake: 0.5, tyreStress: 0.56, restartRisk: 0.32, qualifyingImportance: 0.52 },
  interlagos: { streetTrack: 0, lowOvertake: 0.34, tyreStress: 0.58, restartRisk: 0.58, qualifyingImportance: 0.42 },
  spielberg: { streetTrack: 0, lowOvertake: 0.26, tyreStress: 0.62, restartRisk: 0.4, qualifyingImportance: 0.34 },
  austin: { streetTrack: 0, lowOvertake: 0.36, tyreStress: 0.66, restartRisk: 0.36, qualifyingImportance: 0.42 },
  mexico_city: { streetTrack: 0, lowOvertake: 0.46, tyreStress: 0.52, restartRisk: 0.38, qualifyingImportance: 0.48 },
  shanghai: { streetTrack: 0, lowOvertake: 0.44, tyreStress: 0.62, restartRisk: 0.34, qualifyingImportance: 0.48 },
  bahrain: { streetTrack: 0, lowOvertake: 0.34, tyreStress: 0.82, restartRisk: 0.3, qualifyingImportance: 0.38 },
};

function getCircuitRaceProfile(circuitId: string): CircuitRaceProfile {
  return CIRCUIT_RACE_PROFILES[circuitId.replace(/-/g, '_')] || DEFAULT_CIRCUIT_PROFILE;
}

function getCircuitWeatherPrior(circuitId: string): RaceWeatherSummary {
  return CIRCUIT_WEATHER_PRIORS[circuitId.replace(/-/g, '_')] || summarizeWeather(null);
}

function blendWeather(primary: RaceWeatherSummary, fallback: RaceWeatherSummary) {
  if (
    primary.rainRisk === 0 &&
    primary.coolTrack === 0.5 &&
    primary.hotTrack === 0.5 &&
    primary.humidity === 0.5 &&
    primary.wind === 0 &&
    primary.trackAirDelta === 0.5
  ) {
    return fallback;
  }

  return primary;
}

function readFastF1Weather(season: number, round: number): RaceWeatherSummary {
  const filePath = path.join(process.cwd(), 'public', 'fastf1', String(season), String(round), 'R.json');

  if (!existsSyncSafe(filePath)) {
    return summarizeWeather(null);
  }

  try {
    return summarizeWeather(JSON.parse(readFileSync(filePath, 'utf8')) as FastF1WeatherPayload);
  } catch {
    return summarizeWeather(null);
  }
}

function readFastF1RacePayload(season: number, round: number): FastF1RacePayload | null {
  const filePath = path.join(process.cwd(), 'public', 'fastf1', String(season), String(round), 'R.json');

  if (!existsSyncSafe(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as FastF1RacePayload;
  } catch {
    return null;
  }
}

function raceControlText(message: NonNullable<FastF1RacePayload['raceControlMessages']>[number]) {
  return `${message.category || ''} ${message.message || ''} ${message.status || ''} ${message.flag || ''}`.toUpperCase();
}

function summarizeSafety(payload: FastF1RacePayload | null): RaceSafetySummary {
  const periods = payload?.trackStatusPeriods || [];
  const messages = payload?.raceControlMessages || [];
  const totalLaps = Math.max(
    1,
    ...periods.map((period) => toNumber(period.endLap) || 0),
    ...messages.map((message) => toNumber(message.lap) || 0),
  );
  const periodLapShare = (type: string) => {
    const laps = periods
      .filter((period) => String(period.type || '').toUpperCase() === type)
      .reduce((sum, period) => {
        const startLap = toNumber(period.startLap) || 0;
        const endLap = toNumber(period.endLap) || startLap;
        return sum + Math.max(1, endLap - startLap + 1);
      }, 0);

    return clamp(laps / totalLaps);
  };
  const messageCount = (matcher: (text: string) => boolean) =>
    messages.filter((message) => matcher(raceControlText(message))).length;
  const scMessages = messageCount((text) =>
    text.includes('SAFETY CAR') && !text.includes('VIRTUAL') && (
      text.includes('DEPLOYED') || text.includes('IN THIS LAP')
    ),
  );
  const vscMessages = messageCount((text) =>
    text.includes('VIRTUAL SAFETY CAR') && (text.includes('DEPLOYED') || text.includes('ENDING')),
  );
  const redMessages = messageCount((text) => text.includes('RED FLAG') || text.includes('RED'));
  const yellowMessages = messageCount((text) => text.includes('YELLOW'));
  const safetyCar = clamp(periodLapShare('SC') + scMessages / 8);
  const virtualSafetyCar = clamp(periodLapShare('VSC') + vscMessages / 8);
  const redFlag = clamp(periodLapShare('RED') + redMessages / 4);
  const yellow = clamp(periodLapShare('YELLOW') + yellowMessages / 30);
  const restartRisk = clamp(safetyCar * 0.5 + virtualSafetyCar * 0.25 + redFlag * 0.75 + scMessages / 12);

  return {
    safetyCar,
    virtualSafetyCar,
    redFlag,
    yellow,
    restartRisk,
    disruptionScore: clamp(safetyCar * 0.35 + virtualSafetyCar * 0.2 + redFlag * 0.35 + yellow * 0.1),
  };
}

function readFastF1RaceSafetySummary(season: number, round: number): RaceSafetySummary {
  return summarizeSafety(readFastF1RacePayload(season, round));
}

function existsSyncSafe(filePath: string) {
  return existsSync(filePath);
}

function loadFiaUpgradeSummaries(): Map<string, FiaCarUpgradeSummary> {
  const artifactPath = existsSyncSafe(FIA_UPGRADES_PATH) ? FIA_UPGRADES_PATH : FIA_UPGRADES_FALLBACK_PATH;
  if (!existsSyncSafe(artifactPath)) {
    return new Map();
  }

  try {
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as FiaUpgradeArtifact;
    return new Map((artifact.summaries || []).map((summary) => [
      upgradeSummaryKey(summary.season, summary.round, summary.team),
      summary,
    ]));
  } catch {
    return new Map();
  }
}

function getDeclaredUpgradeFeatures(
  race: SourceRace,
  constructorId: string,
  summaries: Map<string, FiaCarUpgradeSummary>,
): DeclaredUpgradeFeatures {
  const summary = summaries.get(upgradeSummaryKey(race.season, race.round, constructorId));
  if (!summary) {
    return {
      intensity: 0,
      count: 0,
      performanceIntent: 0,
      circuitSpecificIntent: 0,
      reliabilityIntent: 0,
      trackFit: 0,
      trackTypeInteraction: 0,
    };
  }

  const circuitProfile = getCircuitRaceProfile(race.circuitId);
  const intensity = clamp(summary.declaredUpgradeIntensity / 12);
  const count = clamp(summary.declaredUpgradeCount / 5);
  const trackFit = clamp(
    summary.circuitSpecificIntent * 0.36 +
    summary.performanceIntent * 0.24 +
    intensity * 0.18 +
    circuitProfile.qualifyingImportance * summary.performanceIntent * 0.08 +
    circuitProfile.tyreStress * summary.coolingIntent * 0.08 +
    circuitProfile.lowOvertake * summary.performanceIntent * 0.04 +
    circuitProfile.restartRisk * summary.reliabilityIntent * 0.02,
  );
  const trackTypeInteraction = clamp(
    trackFit * 0.42 +
    intensity * (
      circuitProfile.qualifyingImportance * 0.2 +
      circuitProfile.tyreStress * 0.18 +
      circuitProfile.lowOvertake * 0.14 +
      circuitProfile.streetTrack * 0.08
    ) +
    summary.circuitSpecificIntent * 0.18,
  );

  return {
    intensity,
    count,
    performanceIntent: clamp(summary.performanceIntent),
    circuitSpecificIntent: clamp(summary.circuitSpecificIntent),
    reliabilityIntent: clamp(summary.reliabilityIntent),
    trackFit,
    trackTypeInteraction,
  };
}

function upgradeSummaryKey(season: number, round: number | undefined, teamOrConstructorId: string): string {
  return `${season}:${round ?? ''}:${normalizeConstructorUpgradeName(teamOrConstructorId)}`;
}

function normalizeConstructorUpgradeName(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (normalized.includes('red_bull')) {
    return 'red_bull';
  }
  if (normalized.includes('racing_bulls') || normalized.includes('visa_cash_app_rb') || normalized === 'rb') {
    return 'rb';
  }
  if (normalized.includes('aston_martin')) {
    return 'aston_martin';
  }
  if (normalized.includes('kick_sauber') || normalized.includes('stake') || normalized.includes('sauber')) {
    return 'sauber';
  }
  if (normalized.includes('alfa_romeo')) {
    return 'alfa_romeo';
  }
  if (normalized.includes('mercedes')) {
    return 'mercedes';
  }
  if (normalized.includes('mclaren')) {
    return 'mclaren';
  }
  if (normalized.includes('ferrari')) {
    return 'ferrari';
  }
  if (normalized.includes('alpine') || normalized.includes('renault')) {
    return 'alpine';
  }
  if (normalized.includes('williams')) {
    return 'williams';
  }
  if (normalized.includes('haas')) {
    return 'haas';
  }
  return normalized;
}

function average(values: number[], fallback = 0.5) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function normalizedPositionAdvantage(position: number | null, fieldSize: number) {
  if (!position || fieldSize <= 1) {
    return 0.5;
  }

  return clamp((fieldSize - position) / (fieldSize - 1));
}

function getBestQualifyingTime(result: QualifyingYaml) {
  return Math.min(
    ...[result.q1, result.q2, result.q3]
      .map(parseLapTimeSeconds)
      .filter((value): value is number => value !== null),
  );
}

function getPracticeTime(result: PracticeYaml | undefined) {
  return parseLapTimeSeconds(result?.time);
}

function buildPracticeFeatureSummary(
  race: SourceRace,
  driverId: string,
  constructorId: string,
  fieldSize: number,
) {
  const sessionSummaries = race.practices.map((session) => {
    const result = session.find((item) => item.driverId === driverId);
    const bestTime = Math.min(
      ...session
        .map(getPracticeTime)
        .filter((value): value is number => value !== null && Number.isFinite(value)),
    );
    const time = getPracticeTime(result);
    const gap = time !== null && Number.isFinite(bestTime) ? time - bestTime : null;
    const maxLaps = Math.max(0, ...session.map((item) => toNumber(item.laps) || 0));
    const teamBestTime = Math.min(
      ...session
        .filter((item) => item.constructorId === constructorId)
        .map(getPracticeTime)
        .filter((value): value is number => value !== null && Number.isFinite(value)),
    );
    const teamMateGap = time !== null && Number.isFinite(teamBestTime) ? teamBestTime - time : null;
    const constructorBestPosition = Math.min(
      ...session
        .filter((item) => item.constructorId === constructorId)
        .map((item) => toNumber(item.position) || Number.POSITIVE_INFINITY),
    );

    return {
      advantage: normalizedPositionAdvantage(toNumber(result?.position), fieldSize),
      gapAdvantage: gap === null ? 0.5 : clamp(1 - gap / 1.5),
      lapsShare: maxLaps ? clamp((toNumber(result?.laps) || 0) / maxLaps) : 0.5,
      teamMateAdvantage: teamMateGap === null ? 0.5 : clamp(0.5 + teamMateGap / 1.5),
      constructorAdvantage: Number.isFinite(constructorBestPosition)
        ? normalizedPositionAdvantage(constructorBestPosition, fieldSize)
        : 0.5,
    };
  });

  const available = sessionSummaries.filter((summary) =>
    summary.advantage !== 0.5 || summary.gapAdvantage !== 0.5 || summary.lapsShare !== 0.5,
  );

  return {
    fp1Advantage: sessionSummaries[0]?.advantage ?? 0.5,
    fp2Advantage: sessionSummaries[1]?.advantage ?? 0.5,
    fp3Advantage: sessionSummaries[2]?.advantage ?? 0.5,
    fpBestAdvantage: available.length ? Math.max(...available.map((summary) => summary.advantage)) : 0.5,
    fpAverageAdvantage: available.length ? average(available.map((summary) => summary.advantage)) : 0.5,
    fpBestGapAdvantage: available.length ? Math.max(...available.map((summary) => summary.gapAdvantage)) : 0.5,
    fpLapsShare: available.length ? average(available.map((summary) => summary.lapsShare)) : 0.5,
    fpTeamMateAdvantage: available.length ? average(available.map((summary) => summary.teamMateAdvantage)) : 0.5,
    fpConstructorAdvantage: available.length ? Math.max(...available.map((summary) => summary.constructorAdvantage)) : 0.5,
  };
}

function validRacePaceLaps(laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = []) {
  const lapTimes = laps
    .map((lap) => lap.lapTimeSeconds)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value) && value > 0);
  const baseline = median(lapTimes, 0);

  return laps.filter((lap) =>
    lap.lapNumber !== null &&
    lap.lapNumber !== undefined &&
    lap.lapNumber > 2 &&
    lap.lapTimeSeconds !== null &&
    lap.lapTimeSeconds !== undefined &&
    Number.isFinite(lap.lapTimeSeconds) &&
    lap.lapTimeSeconds > 0 &&
    (!baseline || lap.lapTimeSeconds <= baseline * 1.08),
  );
}

function tyreDegradationScore(laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = []) {
  const stints = new Map<number, NonNullable<typeof laps>[number][]>();

  validRacePaceLaps(laps).forEach((lap) => {
    const stint = lap.stint ?? 0;
    const stintLaps = stints.get(stint) || [];
    stintLaps.push(lap);
    stints.set(stint, stintLaps);
  });

  const slopes = [...stints.values()].flatMap((stintLaps) => {
    const sorted = stintLaps
      .filter((lap) => lap.tyreLife !== null && lap.tyreLife !== undefined)
      .sort((left, right) => (left.tyreLife || 0) - (right.tyreLife || 0));

    if (sorted.length < 6) {
      return [];
    }

    const bucketSize = Math.max(2, Math.floor(sorted.length / 3));
    const early = sorted.slice(0, bucketSize);
    const late = sorted.slice(-bucketSize);
    const ageDelta = Math.max(
      1,
      average(late.map((lap) => lap.tyreLife || 0), 1) - average(early.map((lap) => lap.tyreLife || 0), 0),
    );
    const slope = (average(late.map((lap) => lap.lapTimeSeconds || 0)) -
      average(early.map((lap) => lap.lapTimeSeconds || 0))) / ageDelta;

    return Number.isFinite(slope) ? [-slope] : [];
  });

  return average(slopes, 0);
}

function lapPositionAt(
  laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = [],
  targetLap: number,
) {
  const lap = laps.find((item) => item.lapNumber === targetLap);
  const position = toNumber(lap?.position);
  return position !== null && position > 0 ? position : null;
}

function normalizedPositionGain(before: number | null, after: number | null) {
  if (before === null || after === null) {
    return 0.5;
  }

  return clamp(0.5 + (before - after) / 8);
}

function stintStartLaps(
  laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = [],
  strategy?: NonNullable<FastF1RacePayload['tyreStrategies']>[number],
) {
  const starts = new Set<number>();

  strategy?.stints?.forEach((stint) => {
    const startLap = toNumber(stint.startLap);
    if (startLap !== null && startLap > 1) {
      starts.add(startLap);
    }
  });

  [...laps]
    .sort((left, right) => (left.lapNumber || 0) - (right.lapNumber || 0))
    .forEach((lap, index, sorted) => {
      const previous = sorted[index - 1];
      if (
        lap.lapNumber !== null &&
        lap.lapNumber !== undefined &&
        lap.lapNumber > 1 &&
        (lap.freshTyre || (
          previous?.stint !== undefined &&
          lap.stint !== undefined &&
          previous.stint !== lap.stint
        ))
      ) {
        starts.add(lap.lapNumber);
      }
    });

  return [...starts].sort((left, right) => left - right);
}

function medianLapTimeInWindows(
  laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = [],
  windows: Array<{ startLap: number; endLap: number }>,
) {
  const lapTimes = validRacePaceLaps(laps)
    .filter((lap) => windows.some((window) =>
      (lap.lapNumber || 0) >= window.startLap && (lap.lapNumber || 0) <= window.endLap,
    ))
    .map((lap) => lap.lapTimeSeconds || 0)
    .filter(isFiniteTime);

  return lapTimes.length >= 2 ? median(lapTimes) : null;
}

function averagePositionGainInWindows(
  laps: NonNullable<FastF1RacePayload['lapTimeSeries']>[number]['laps'] = [],
  windows: Array<{ beforeLap: number; afterLap: number }>,
) {
  const gains = windows
    .map((window) => normalizedPositionGain(
      lapPositionAt(laps, window.beforeLap),
      lapPositionAt(laps, window.afterLap),
    ))
    .filter((value) => value !== 0.5);

  return gains.length ? average(gains) : 0.5;
}

function buildRacePerformanceSummary(
  race: SourceRace,
  fastestLaps: ResultYaml[],
  pitStops: PracticeYaml[],
) {
  const fieldSize = race.results.length || 20;
  const payload = readFastF1RacePayload(race.season, race.round);
  const raceDrivers = new Set(race.results.map((result) => result.driverId));
  const longRunPace = new Map<string, number>();
  const tyreManagement = new Map<string, number>();
  const stintLength = new Map<string, number>();
  const telemetrySpeed = new Map<string, number>();
  const fastestLapRank = new Map<string, number>();
  const pitStopTime = new Map<string, number>();
  const postPitPace = new Map<string, number>();
  const strategyGain = new Map<string, number>();
  const restartPace = new Map<string, number>();
  const restartGain = new Map<string, number>();
  const safetyCarGain = new Map<string, number>();
  const strategyByDriver = new Map((payload?.tyreStrategies || []).map((item) => [
    normalizeFastF1DriverId(item.driverId || item.driver),
    item,
  ]));
  const restartWindows = (payload?.trackStatusPeriods || [])
    .filter((period) => ['SC', 'VSC', 'RED'].includes(String(period.type || '').toUpperCase()))
    .flatMap((period) => {
      const endLap = toNumber(period.endLap);
      return endLap === null ? [] : [{ startLap: endLap + 1, endLap: endLap + 3 }];
    });
  const restartGainWindows = (payload?.trackStatusPeriods || [])
    .filter((period) => ['SC', 'VSC', 'RED'].includes(String(period.type || '').toUpperCase()))
    .flatMap((period) => {
      const startLap = toNumber(period.startLap);
      const endLap = toNumber(period.endLap);
      return startLap === null || endLap === null ? [] : [{ beforeLap: Math.max(1, startLap - 1), afterLap: endLap + 2 }];
    });
  const safetyCarGainWindows = (payload?.trackStatusPeriods || [])
    .filter((period) => ['SC', 'VSC'].includes(String(period.type || '').toUpperCase()))
    .flatMap((period) => {
      const startLap = toNumber(period.startLap);
      const endLap = toNumber(period.endLap);
      return startLap === null || endLap === null ? [] : [{ beforeLap: Math.max(1, startLap - 1), afterLap: endLap + 2 }];
    });

  payload?.lapTimeSeries?.forEach((item) => {
    const driverId = normalizeFastF1DriverId(item.driverId || item.driver);
    if (!raceDrivers.has(driverId)) {
      return;
    }

    const paceLaps = validRacePaceLaps(item.laps);
    if (paceLaps.length >= 5) {
      longRunPace.set(driverId, median(paceLaps.map((lap) => lap.lapTimeSeconds || 0)));
      tyreManagement.set(driverId, tyreDegradationScore(item.laps));
    }

    const starts = stintStartLaps(item.laps, strategyByDriver.get(driverId));
    const postPitWindows = starts.map((startLap) => ({ startLap: startLap + 1, endLap: startLap + 3 }));
    const postPitMedian = medianLapTimeInWindows(item.laps, postPitWindows);
    if (postPitMedian !== null) {
      postPitPace.set(driverId, postPitMedian);
    }

    const pitGain = averagePositionGainInWindows(
      item.laps,
      starts.map((startLap) => ({ beforeLap: Math.max(1, startLap - 1), afterLap: startLap + 3 })),
    );
    if (pitGain !== 0.5) {
      strategyGain.set(driverId, pitGain);
    }

    const restartMedian = medianLapTimeInWindows(item.laps, restartWindows);
    if (restartMedian !== null) {
      restartPace.set(driverId, restartMedian);
    }

    const restartGainScore = averagePositionGainInWindows(item.laps, restartGainWindows);
    if (restartGainScore !== 0.5) {
      restartGain.set(driverId, restartGainScore);
    }

    const safetyGainScore = averagePositionGainInWindows(item.laps, safetyCarGainWindows);
    if (safetyGainScore !== 0.5) {
      safetyCarGain.set(driverId, safetyGainScore);
    }
  });

  payload?.tyreStrategies?.forEach((item) => {
    const driverId = normalizeFastF1DriverId(item.driverId || item.driver);
    if (!raceDrivers.has(driverId)) {
      return;
    }

    const longestStint = Math.max(0, ...(item.stints || []).map((stint) => toNumber(stint.lapCount) || 0));
    if (longestStint > 0) {
      stintLength.set(driverId, longestStint);
    }
  });

  payload?.telemetrySummary?.forEach((item) => {
    const driverId = normalizeFastF1DriverId(item.driverId || item.driver);
    const avgSpeed = item.avgSpeedKph ?? null;
    if (raceDrivers.has(driverId) && avgSpeed !== null && Number.isFinite(avgSpeed)) {
      telemetrySpeed.set(driverId, avgSpeed);
    }
  });

  fastestLaps.forEach((item) => {
    const position = toNumber(item.position);
    if (position !== null) {
      fastestLapRank.set(item.driverId, normalizedPositionAdvantage(position, fieldSize));
    }
  });

  pitStops.forEach((item) => {
    const time = parseLapTimeSeconds(item.time);
    if (time === null || !Number.isFinite(time)) {
      return;
    }

    const current = pitStopTime.get(item.driverId);
    pitStopTime.set(item.driverId, current === undefined ? time : Math.min(current, time));
  });

  const longRunPaceRank = rankByLowerIsBetter(longRunPace, fieldSize);
  const tyreManagementRank = rankByHigherIsBetter(tyreManagement, fieldSize);
  const stintLengthRank = rankByHigherIsBetter(stintLength, fieldSize);
  const telemetrySpeedRank = rankByHigherIsBetter(telemetrySpeed, fieldSize);
  const pitStopRank = rankByLowerIsBetter(pitStopTime, fieldSize);
  const postPitPaceRank = rankByLowerIsBetter(postPitPace, fieldSize);
  const strategyGainRank = rankByHigherIsBetter(strategyGain, fieldSize);
  const restartPaceRank = rankByLowerIsBetter(restartPace, fieldSize);
  const restartGainRank = rankByHigherIsBetter(restartGain, fieldSize);
  const safetyCarGainRank = rankByHigherIsBetter(safetyCarGain, fieldSize);

  return new Map(race.results.map((result) => [
    result.driverId,
    {
      longRunPaceAdvantage: longRunPaceRank.get(result.driverId) ?? 0.5,
      tyreManagementAdvantage: tyreManagementRank.get(result.driverId) ?? 0.5,
      stintLengthAdvantage: stintLengthRank.get(result.driverId) ?? 0.5,
      pitStopAdvantage: pitStopRank.get(result.driverId) ?? 0.5,
      fastestLapAdvantage: fastestLapRank.get(result.driverId) ?? 0.5,
      telemetrySpeedAdvantage: telemetrySpeedRank.get(result.driverId) ?? 0.5,
      postPitPaceAdvantage: postPitPaceRank.get(result.driverId) ?? 0.5,
      strategyGainAdvantage: strategyGainRank.get(result.driverId) ?? 0.5,
      restartPaceAdvantage: restartPaceRank.get(result.driverId) ?? 0.5,
      restartGainAdvantage: restartGainRank.get(result.driverId) ?? 0.5,
      safetyCarGainAdvantage: safetyCarGainRank.get(result.driverId) ?? 0.5,
      hotTrackTyreAdvantage: race.weather.hotTrack > 0.35
        ? ((tyreManagementRank.get(result.driverId) ?? 0.5) * 0.65 + (postPitPaceRank.get(result.driverId) ?? 0.5) * 0.35)
        : 0.5,
      wetTrackPaceAdvantage: race.weather.rainRisk > 0.05
        ? ((longRunPaceRank.get(result.driverId) ?? 0.5) * 0.5 + (restartPaceRank.get(result.driverId) ?? 0.5) * 0.5)
        : 0.5,
    },
  ]));
}

function isFiniteTime(value: number) {
  return Number.isFinite(value) && value > 0;
}

function rankAdvantage(points: number, allPoints: number[]) {
  if (!allPoints.length || allPoints.every((value) => value === allPoints[0])) {
    return 0.5;
  }

  const sorted = [...allPoints].sort((left, right) => right - left);
  const rank = sorted.findIndex((value) => value === points) + 1;
  return normalizedPositionAdvantage(rank || null, sorted.length);
}

function getRecentDriverStats(
  history: Map<string, DriverRaceSnapshot[]>,
  driverId: string,
  fieldSize: number,
  windowSize = WINDOW_SIZE,
) {
  const recent = (history.get(driverId) || []).slice(-windowSize);
  return {
    finishForm: average(recent.map((item) => normalizedPositionAdvantage(item.position, fieldSize))),
    podiumRate: average(recent.map((item) => (item.podium ? 1 : 0))),
    winRate: average(recent.map((item) => (item.winner ? 1 : 0)), 0),
    reliability: recent.length ? 1 - average(recent.map((item) => (item.dnf ? 1 : 0)), 0) : 0.85,
  };
}

function getRecentConstructorStats(
  history: Map<string, ConstructorRaceSnapshot[]>,
  constructorId: string,
  fieldSize: number,
  windowSize = WINDOW_SIZE,
) {
  const recent = (history.get(constructorId) || []).slice(-(windowSize * 2));
  return {
    finishForm: average(recent.map((item) => normalizedPositionAdvantage(item.position, fieldSize))),
    podiumRate: average(recent.map((item) => (item.podium ? 1 : 0))),
    winRate: average(recent.map((item) => (item.winner ? 1 : 0)), 0),
    reliability: recent.length ? 1 - average(recent.map((item) => (item.dnf ? 1 : 0)), 0) : 0.85,
  };
}

function getRecentPerformanceStats(historyItems: DriverRaceSnapshot[], windowSize = WINDOW_SIZE) {
  const recent = historyItems.slice(-windowSize);
  const finishAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.position, 20);
  const gridAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.gridPosition, 20);
  const gridGain = (item: DriverRaceSnapshot) => clamp(0.5 + (finishAdvantage(item) - gridAdvantage(item)));
  const qualifyingConversion = (item: DriverRaceSnapshot) => {
    if (item.qualifyingPosition === null || item.qualifyingPosition > 3) {
      return 0.5;
    }

    return item.winner ? 1 : item.podium ? 0.65 : 0.25;
  };
  const tyrePaceBlend = (item: DriverRaceSnapshot) => (
    item.longRunPaceAdvantage * 0.45 +
    item.tyreManagementAdvantage * 0.35 +
    item.stintLengthAdvantage * 0.2
  );
  const postPitStrategyBlend = (item: DriverRaceSnapshot) => (
    item.postPitPaceAdvantage * 0.45 +
    item.strategyGainAdvantage * 0.35 +
    item.pitStopAdvantage * 0.2
  );
  const restartBlend = (item: DriverRaceSnapshot) => (
    item.restartPaceAdvantage * 0.45 +
    item.restartGainAdvantage * 0.35 +
    item.safetyCarGainAdvantage * 0.2
  );

  return {
    longRunPaceForm: average(recent.map((item) => item.longRunPaceAdvantage)),
    tyreManagementForm: average(recent.map((item) => item.tyreManagementAdvantage)),
    stintLengthForm: average(recent.map((item) => item.stintLengthAdvantage)),
    pitStopForm: average(recent.map((item) => item.pitStopAdvantage)),
    fastestLapForm: average(recent.map((item) => item.fastestLapAdvantage)),
    telemetrySpeedForm: average(recent.map((item) => item.telemetrySpeedAdvantage)),
    gridGainForm: average(recent.map(gridGain)),
    chaosForm: weightedAverage(
      recent,
      (item) => 0.2 + item.chaosScore,
      (item) => finishAdvantage(item),
    ),
    restartProxyForm: weightedAverage(
      recent,
      (item) => 0.2 + item.chaosScore,
      gridGain,
    ),
    safetyCarForm: weightedAverage(
      recent,
      (item) => 0.15 + item.safetyCarScore * 1.4,
      (item) => finishAdvantage(item),
    ),
    virtualSafetyCarForm: weightedAverage(
      recent,
      (item) => 0.15 + item.virtualSafetyCarScore,
      (item) => finishAdvantage(item),
    ),
    redFlagForm: weightedAverage(
      recent,
      (item) => 0.15 + item.redFlagScore * 1.8,
      (item) => finishAdvantage(item),
    ),
    qualifyingConversionForm: average(recent.map(qualifyingConversion)),
    tyrePaceBlend: average(recent.map(tyrePaceBlend)),
    postPitPaceForm: average(recent.map((item) => item.postPitPaceAdvantage)),
    strategyGainForm: average(recent.map((item) => item.strategyGainAdvantage)),
    restartPaceForm: average(recent.map((item) => item.restartPaceAdvantage)),
    restartGainForm: average(recent.map((item) => item.restartGainAdvantage)),
    safetyCarGainForm: average(recent.map((item) => item.safetyCarGainAdvantage)),
    hotTrackTyreForm: average(recent.map((item) => item.hotTrackTyreAdvantage)),
    wetTrackPaceForm: average(recent.map((item) => item.wetTrackPaceAdvantage)),
    postPitStrategyBlend: average(recent.map(postPitStrategyBlend)),
    restartBlend: average(recent.map(restartBlend)),
  };
}

function trendSignal(recentValue: number, previousValue: number, boost = TREND_FEATURE_BOOST) {
  return clamp(0.5 + (recentValue - previousValue) * boost);
}

function splitTrendWindows<T>(historyItems: T[], recentSize: number, previousSize = recentSize) {
  const previousEnd = Math.max(0, historyItems.length - recentSize);
  return {
    recent: historyItems.slice(-recentSize),
    previous: historyItems.slice(Math.max(0, previousEnd - previousSize), previousEnd),
  };
}

function buildTrendFeatures(historyItems: DriverRaceSnapshot[], fieldSize: number) {
  const { recent, previous } = splitTrendWindows(historyItems, 3, 5);
  const finishForm = (items: DriverRaceSnapshot[]) =>
    average(items.map((item) => normalizedPositionAdvantage(item.position, fieldSize)));
  const qualifyingForm = (items: DriverRaceSnapshot[]) =>
    average(items.map((item) => normalizedPositionAdvantage(item.qualifyingPosition, fieldSize)));
  const winRate = (items: DriverRaceSnapshot[]) => average(items.map((item) => (item.winner ? 1 : 0)), 0);
  const podiumRate = (items: DriverRaceSnapshot[]) => average(items.map((item) => (item.podium ? 1 : 0)), 0);

  return {
    finishTrend: trendSignal(finishForm(recent), finishForm(previous)),
    qualifyingTrend: trendSignal(qualifyingForm(recent), qualifyingForm(previous)),
    winTrend: trendSignal(winRate(recent), winRate(previous)),
    podiumTrend: trendSignal(podiumRate(recent), podiumRate(previous)),
  };
}

function weatherSimilarity(left: RaceWeatherSummary, right: RaceWeatherSummary) {
  const distance = (
    Math.abs(left.rainRisk - right.rainRisk) * 1.4 +
    Math.abs(left.hotTrack - right.hotTrack) +
    Math.abs(left.coolTrack - right.coolTrack) +
    Math.abs(left.wind - right.wind) * 0.8 +
    Math.abs(left.humidity - right.humidity) * 0.4
  ) / 4.6;

  return clamp(1 - distance);
}

function weightedAverage<T>(
  items: T[],
  weightSelector: (item: T) => number,
  valueSelector: (item: T) => number,
  fallback = 0.5,
) {
  const totals = items.reduce(
    (accumulator, item) => {
      const weight = weightSelector(item);
      if (!Number.isFinite(weight) || weight <= 0) {
        return accumulator;
      }

      return {
        weight: accumulator.weight + weight,
        value: accumulator.value + weight * valueSelector(item),
      };
    },
    { weight: 0, value: 0 },
  );

  return totals.weight ? totals.value / totals.weight : fallback;
}

function buildWeatherAdaptationFeatures(
  historyItems: DriverRaceSnapshot[],
  fieldSize: number,
  weather: RaceWeatherSummary,
) {
  const recent = historyItems.slice(-28);
  const finishAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.position, fieldSize);
  const reliability = (item: DriverRaceSnapshot) => (item.dnf ? 0 : 1);
  const generalForm = average(recent.map(finishAdvantage));
  const generalReliability = recent.length ? average(recent.map(reliability), 0.85) : 0.85;
  const similarWeatherForm = weightedAverage(
    recent,
    (item) => 0.2 + weatherSimilarity(weather, item.weather) ** 2,
    finishAdvantage,
  );
  const rainForm = weightedAverage(
    recent,
    (item) => 0.15 + item.weather.rainRisk * weather.rainRisk,
    finishAdvantage,
  );
  const hotTrackForm = weightedAverage(
    recent,
    (item) => 0.15 + item.weather.hotTrack * weather.hotTrack,
    finishAdvantage,
  );
  const coolTrackForm = weightedAverage(
    recent,
    (item) => 0.15 + item.weather.coolTrack * weather.coolTrack,
    finishAdvantage,
  );
  const windReliability = weightedAverage(
    recent,
    (item) => 0.15 + item.weather.wind * weather.wind,
    reliability,
    0.85,
  );

  return {
    similarWeatherForm: similarWeatherForm - generalForm,
    rainForm: rainForm - generalForm,
    hotTrackForm: hotTrackForm - generalForm,
    coolTrackForm: coolTrackForm - generalForm,
    windReliability: windReliability - generalReliability,
  };
}

function circuitProfileSimilarity(left: CircuitRaceProfile, right: CircuitRaceProfile) {
  const distance = (
    Math.abs(left.streetTrack - right.streetTrack) * 1.15 +
    Math.abs(left.lowOvertake - right.lowOvertake) +
    Math.abs(left.tyreStress - right.tyreStress) +
    Math.abs(left.restartRisk - right.restartRisk) * 0.8 +
    Math.abs(left.qualifyingImportance - right.qualifyingImportance)
  ) / 4.95;

  return clamp(1 - distance);
}

function buildTrackTypeFamiliarityFeatures(
  historyItems: DriverRaceSnapshot[],
  fieldSize: number,
  circuitProfile: CircuitRaceProfile,
  windowSize = 36,
) {
  const recent = historyItems.slice(-windowSize);
  const finishAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.position, fieldSize);
  const qualifyingAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.qualifyingPosition, fieldSize);
  const gridAdvantage = (item: DriverRaceSnapshot) => normalizedPositionAdvantage(item.gridPosition, fieldSize);
  const gridGain = (item: DriverRaceSnapshot) => clamp(0.5 + finishAdvantage(item) - gridAdvantage(item));
  const tyrePaceBlend = (item: DriverRaceSnapshot) => (
    item.longRunPaceAdvantage * 0.42 +
    item.tyreManagementAdvantage * 0.36 +
    item.stintLengthAdvantage * 0.22
  );
  const racecraftBlend = (item: DriverRaceSnapshot) => (
    gridGain(item) * 0.35 +
    item.restartGainAdvantage * 0.25 +
    item.safetyCarGainAdvantage * 0.2 +
    finishAdvantage(item) * 0.2
  );
  const similarWeight = (item: DriverRaceSnapshot) =>
    0.12 + circuitProfileSimilarity(circuitProfile, item.circuitProfile) ** 2;

  return {
    familiarity: weightedAverage(
      recent,
      similarWeight,
      (item) => finishAdvantage(item) * 0.35 + qualifyingAdvantage(item) * 0.25 + tyrePaceBlend(item) * 0.25 + racecraftBlend(item) * 0.15,
    ),
    qualifyingForm: weightedAverage(recent, similarWeight, qualifyingAdvantage),
    paceForm: weightedAverage(recent, similarWeight, tyrePaceBlend),
    racecraft: weightedAverage(recent, similarWeight, racecraftBlend),
    reliability: weightedAverage(recent, similarWeight, (item) => (item.dnf ? 0 : 1), 0.85),
  };
}

function buildDriverSequenceEmbedding(
  history: Map<string, DriverRaceSnapshot[]>,
  driverId: string,
  fieldSize: number,
) {
  const sequence: RaceWinnerSequenceStep[] = (history.get(driverId) || []).slice(-10).map((item) => ({
    finishAdvantage: normalizedPositionAdvantage(item.position, fieldSize),
    qualifyingAdvantage: normalizedPositionAdvantage(item.qualifyingPosition, fieldSize),
    podium: item.podium ? 1 : 0,
    win: item.winner ? 1 : 0,
    reliability: item.dnf ? 0 : 1,
  }));

  return buildRaceWinnerSequenceEmbedding(sequence);
}

function buildConstructorSequenceEmbedding(
  history: Map<string, ConstructorRaceSnapshot[]>,
  constructorId: string,
  fieldSize: number,
) {
  const sequence: RaceWinnerSequenceStep[] = (history.get(constructorId) || []).slice(-20).map((item) => ({
    finishAdvantage: normalizedPositionAdvantage(item.position, fieldSize),
    qualifyingAdvantage: 0.5,
    podium: item.podium ? 1 : 0,
    win: item.winner ? 1 : 0,
    reliability: item.dnf ? 0 : 1,
  }));

  return buildRaceWinnerSequenceEmbedding(sequence);
}

function loadSourceRaces(): SourceRace[] {
  return readdirSync(DATA_ROOT)
    .filter((seasonName) => /^\d+$/.test(seasonName))
    .flatMap((seasonName) => {
      const season = Number(seasonName);
      const racesRoot = path.join(DATA_ROOT, seasonName, 'races');

      return readdirSync(racesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const raceRoot = path.join(racesRoot, entry.name);
          const race = readYaml<RaceYaml>(path.join(raceRoot, 'race.yml'));
          const sprintResults = readYamlArray<ResultYaml>(path.join(raceRoot, 'sprint-race-results.yml'));
          const sprintQualifying = readYamlArray<QualifyingYaml>(path.join(raceRoot, 'sprint-qualifying-results.yml'));
          const sprintShootout = readYamlArray<QualifyingYaml>(path.join(raceRoot, 'sprint-shootout-results.yml'));

          return {
            season,
            round: Number(race.round),
            raceKey: `${season}-${race.round}`,
            raceName: race.officialName || race.grandPrixId || entry.name,
            circuitId: race.circuitId,
            era: getWinnerPredictionEra(season),
            isSprintWeekend: sprintResults.length > 0 || sprintQualifying.length > 0 || sprintShootout.length > 0,
            results: readYamlArray<ResultYaml>(path.join(raceRoot, 'race-results.yml')),
            qualifying: readYamlArray<QualifyingYaml>(path.join(raceRoot, 'qualifying-results.yml')),
            practices: [
              readYamlArray<PracticeYaml>(path.join(raceRoot, 'free-practice-1-results.yml')),
              readYamlArray<PracticeYaml>(path.join(raceRoot, 'free-practice-2-results.yml')),
              readYamlArray<PracticeYaml>(path.join(raceRoot, 'free-practice-3-results.yml')),
            ],
            fastestLaps: readYamlArray<ResultYaml>(path.join(raceRoot, 'fastest-laps.yml')),
            pitStops: readYamlArray<PracticeYaml>(path.join(raceRoot, 'pit-stops.yml')),
            sprintResults,
            sprintQualifying: sprintQualifying.length ? sprintQualifying : sprintShootout,
            weather: blendWeather(readFastF1Weather(season, Number(race.round)), getCircuitWeatherPrior(race.circuitId)),
            safety: readFastF1RaceSafetySummary(season, Number(race.round)),
          };
        });
    })
    .filter((race) => race.results.some((result) => toNumber(result.position) === 1))
    .sort((left, right) => left.season - right.season || left.round - right.round);
}

function addHistoryItem<T>(history: Map<string, T[]>, key: string, item: T) {
  const items = history.get(key) || [];
  items.push(item);
  history.set(key, items);
}

function raceChaosScore(race: SourceRace) {
  const fieldSize = race.results.length || 20;
  const classified = race.results.length || 1;
  const dnfs = race.results.filter((result) => Boolean(result.reasonRetired)).length / classified;
  const winner = race.results.find((result) => toNumber(result.position) === 1);
  const winnerGrid = toNumber(winner?.gridPosition);
  const upsetWinner = winnerGrid === null ? 0.35 : clamp((winnerGrid - 3) / Math.max(1, fieldSize - 3));
  const podiumUpsets = race.results.filter((result) => {
    const position = toNumber(result.position);
    const grid = toNumber(result.gridPosition);
    return position !== null && position <= 3 && grid !== null && grid > 5;
  }).length / 3;

  return clamp(dnfs * 0.45 + upsetWinner * 0.35 + podiumUpsets * 0.2);
}

function circuitChaosStats(sameCircuitRaces: SourceRace[]) {
  if (!sameCircuitRaces.length) {
    return {
      chaosRate: 0.35,
      safetyCarRate: 0.25,
      virtualSafetyCarRate: 0.18,
      redFlagRate: 0.04,
      overtakeUpsetRate: 0.28,
    };
  }

  const chaosScores = sameCircuitRaces.map(raceChaosScore);
  const safetyCarScores = sameCircuitRaces.map((race) => race.safety.safetyCar);
  const virtualSafetyCarScores = sameCircuitRaces.map((race) => race.safety.virtualSafetyCar);
  const redFlagScores = sameCircuitRaces.map((race) => race.safety.redFlag);
  const upsetScores = sameCircuitRaces.map((race) => {
    const winner = race.results.find((result) => toNumber(result.position) === 1);
    const winnerGrid = toNumber(winner?.gridPosition);
    return winnerGrid !== null && winnerGrid > 3 ? 1 : 0;
  });

  return {
    chaosRate: average(chaosScores, 0.35),
    safetyCarRate: average(safetyCarScores, 0.25),
    virtualSafetyCarRate: average(virtualSafetyCarScores, 0.18),
    redFlagRate: average(redFlagScores, 0.04),
    overtakeUpsetRate: average(upsetScores, 0.28),
  };
}

function sameCircuitDriverPerformance(
  sameCircuitRaces: SourceRace[],
  driverId: string,
  fieldSize: number,
) {
  const entries = sameCircuitRaces.flatMap((previousRace) => {
    const result = previousRace.results.find((item) => item.driverId === driverId);
    if (!result) {
      return [];
    }
    const qualifying = previousRace.qualifying.find((item) => item.driverId === driverId);
    return [{ result, qualifying }];
  });

  const finishAdvantage = (entry: typeof entries[number]) =>
    normalizedPositionAdvantage(toNumber(entry.result.position), fieldSize);
  const qualifyingAdvantage = (entry: typeof entries[number]) =>
    normalizedPositionAdvantage(toNumber(entry.qualifying?.position), fieldSize);
  const gridGain = (entry: typeof entries[number]) => {
    const finish = normalizedPositionAdvantage(toNumber(entry.result.position), fieldSize);
    const grid = normalizedPositionAdvantage(toNumber(entry.result.gridPosition), fieldSize);
    return clamp(0.5 + finish - grid);
  };

  return {
    startRate: clamp(entries.length / 5),
    finishForm: average(entries.map(finishAdvantage)),
    podiumRate: average(entries.map((entry) => {
      const position = toNumber(entry.result.position);
      return position !== null && position <= 3 ? 1 : 0;
    }), 0),
    winRate: average(entries.map((entry) => toNumber(entry.result.position) === 1 ? 1 : 0), 0),
    qualifyingForm: average(entries.map(qualifyingAdvantage)),
    gridGainForm: average(entries.map(gridGain)),
  };
}

function sameCircuitConstructorPerformance(
  sameCircuitRaces: SourceRace[],
  constructorId: string,
  fieldSize: number,
) {
  const entries = sameCircuitRaces.flatMap((previousRace) =>
    previousRace.results
      .filter((item) => item.constructorId === constructorId)
      .map((result) => ({
        result,
        qualifying: previousRace.qualifying.find((item) => item.driverId === result.driverId),
      })),
  );

  const finishAdvantage = (entry: typeof entries[number]) =>
    normalizedPositionAdvantage(toNumber(entry.result.position), fieldSize);
  const qualifyingAdvantage = (entry: typeof entries[number]) =>
    normalizedPositionAdvantage(toNumber(entry.qualifying?.position), fieldSize);
  const gridGain = (entry: typeof entries[number]) => {
    const finish = normalizedPositionAdvantage(toNumber(entry.result.position), fieldSize);
    const grid = normalizedPositionAdvantage(toNumber(entry.result.gridPosition), fieldSize);
    return clamp(0.5 + finish - grid);
  };

  return {
    startRate: clamp(entries.length / 10),
    finishForm: average(entries.map(finishAdvantage)),
    podiumRate: average(entries.map((entry) => {
      const position = toNumber(entry.result.position);
      return position !== null && position <= 3 ? 1 : 0;
    }), 0),
    winRate: average(entries.map((entry) => toNumber(entry.result.position) === 1 ? 1 : 0), 0),
    qualifyingForm: average(entries.map(qualifyingAdvantage)),
    gridGainForm: average(entries.map(gridGain)),
  };
}

function buildRaceCandidates(races: SourceRace[]): WinnerPredictionCandidate[][] {
  const driverHistory = new Map<string, DriverRaceSnapshot[]>();
  const constructorHistory = new Map<string, ConstructorRaceSnapshot[]>();
  const circuitHistory = new Map<string, SourceRace[]>();
  const seasonDriverPoints = new Map<string, number>();
  const seasonConstructorPoints = new Map<string, number>();
  const seasonDriverWins = new Map<string, number>();
  const seasonConstructorWins = new Map<string, number>();
  const fiaUpgradeSummaries = loadFiaUpgradeSummaries();
  const raceGroups: WinnerPredictionCandidate[][] = [];

  races.forEach((race) => {
    const resultByDriver = new Map(race.results.map((result) => [result.driverId, result]));
    const qualifyingByDriver = new Map(race.qualifying.map((result) => [result.driverId, result]));
    const sprintByDriver = new Map(race.sprintResults.map((result) => [result.driverId, result]));
    const sprintQualifyingByDriver = new Map(race.sprintQualifying.map((result) => [result.driverId, result]));
    const fieldSize = race.results.length || race.qualifying.length || 20;
    const qualifyingTimes = race.qualifying
      .map(getBestQualifyingTime)
      .filter(isFiniteTime);
    const poleTime = qualifyingTimes.length ? Math.min(...qualifyingTimes) : null;
    const teamBestQualifyingTime = new Map<string, number>();
    const seasonPrefix = `${race.season}:`;

    race.qualifying.forEach((qualifying) => {
      const time = getBestQualifyingTime(qualifying);
      if (!isFiniteTime(time)) {
        return;
      }

      const current = teamBestQualifyingTime.get(qualifying.constructorId);
      if (current === undefined || time < current) {
        teamBestQualifyingTime.set(qualifying.constructorId, time);
      }
    });

    const driverPoints = [...seasonDriverPoints.entries()]
      .filter(([key]) => key.startsWith(seasonPrefix))
      .map(([, value]) => value);
    const constructorPoints = [...seasonConstructorPoints.entries()]
      .filter(([key]) => key.startsWith(seasonPrefix))
      .map(([, value]) => value);
    const maxDriverPoints = Math.max(0, ...driverPoints);
    const maxConstructorPoints = Math.max(0, ...constructorPoints);
    const sameCircuitRaces = (circuitHistory.get(race.circuitId) || []).slice(-5);
    const poleWins = sameCircuitRaces.filter((previousRace) => {
      const pole = [...previousRace.qualifying].sort((left, right) =>
        (toNumber(left.position) || 999) - (toNumber(right.position) || 999),
      )[0];
      const winner = previousRace.results.find((result) => toNumber(result.position) === 1);
      return pole?.driverId && winner?.driverId && pole.driverId === winner.driverId;
    });
    const sameCircuitPoleWinRate = sameCircuitRaces.length ? poleWins.length / sameCircuitRaces.length : 0.35;
    const top3GridWins = sameCircuitRaces.filter((previousRace) => {
      const winner = previousRace.results.find((result) => toNumber(result.position) === 1);
      const winnerGrid = toNumber(winner?.gridPosition);
      return winnerGrid !== null && winnerGrid <= 3;
    });
    const sameCircuitTop3GridWinRate = sameCircuitRaces.length
      ? top3GridWins.length / sameCircuitRaces.length
      : 0.72;
    const circuitProfile = getCircuitRaceProfile(race.circuitId);
    const circuitChaos = circuitChaosStats(sameCircuitRaces);
    const currentRaceChaosScore = raceChaosScore(race);
    const racePerformanceSummary = buildRacePerformanceSummary(race, race.fastestLaps, race.pitStops);

    const candidates = [...resultByDriver.values()].map((result) => {
      const qualifying = qualifyingByDriver.get(result.driverId);
      const qualifyingPosition = toNumber(qualifying?.position);
      const gridPosition = toNumber(result.gridPosition);
      const qualifyingTime = qualifying ? getBestQualifyingTime(qualifying) : null;
      const qualifyingGap = poleTime !== null && qualifyingTime !== null ? qualifyingTime - poleTime : null;
      const teamBestTime = teamBestQualifyingTime.get(result.constructorId);
      const teamMateGap = teamBestTime !== undefined && qualifyingTime !== null ? teamBestTime - qualifyingTime : null;
      const driverShortStats = getRecentDriverStats(driverHistory, result.driverId, fieldSize, SHORT_WINDOW_SIZE);
      const driverStats = getRecentDriverStats(driverHistory, result.driverId, fieldSize);
      const driverLongStats = getRecentDriverStats(driverHistory, result.driverId, fieldSize, LONG_WINDOW_SIZE);
      const constructorShortStats = getRecentConstructorStats(
        constructorHistory,
        result.constructorId,
        fieldSize,
        SHORT_WINDOW_SIZE,
      );
      const constructorStats = getRecentConstructorStats(constructorHistory, result.constructorId, fieldSize);
      const constructorLongStats = getRecentConstructorStats(
        constructorHistory,
        result.constructorId,
        fieldSize,
        LONG_WINDOW_SIZE,
      );
      const driverSequence = buildDriverSequenceEmbedding(driverHistory, result.driverId, fieldSize);
      const constructorSequence = buildConstructorSequenceEmbedding(constructorHistory, result.constructorId, fieldSize);
      const driverTrend = buildTrendFeatures(driverHistory.get(result.driverId) || [], fieldSize);
      const constructorTrend = buildTrendFeatures(constructorHistory.get(result.constructorId) || [], fieldSize);
      const driverPerformance = getRecentPerformanceStats(driverHistory.get(result.driverId) || []);
      const constructorPerformance = getRecentPerformanceStats(constructorHistory.get(result.constructorId) || [], WINDOW_SIZE * 2);
      const constructorUpgradeProxy = clamp((
        constructorTrend.finishTrend * 0.28 +
        constructorTrend.qualifyingTrend * 0.24 +
        constructorPerformance.telemetrySpeedForm * 0.18 +
        constructorPerformance.longRunPaceForm * 0.18 +
        constructorPerformance.tyrePaceBlend * 0.12
      ));
      const declaredUpgrade = getDeclaredUpgradeFeatures(race, result.constructorId, fiaUpgradeSummaries);
      const declaredUpgradeConstructorMomentum = clamp(declaredUpgrade.trackFit * (
        constructorTrend.finishTrend * 0.24 +
        constructorTrend.qualifyingTrend * 0.22 +
        constructorPerformance.telemetrySpeedForm * 0.18 +
        constructorPerformance.longRunPaceForm * 0.18 +
        constructorPerformance.tyrePaceBlend * 0.18
      ));
      const declaredUpgradeLongRunValidation = clamp(declaredUpgrade.intensity * (
        constructorPerformance.longRunPaceForm * 0.32 +
        driverPerformance.longRunPaceForm * 0.24 +
        constructorPerformance.tyrePaceBlend * 0.24 +
        driverPerformance.tyrePaceBlend * 0.2
      ));
      const driverUpgradeAdaptationProxy = clamp((
        driverTrend.finishTrend * 0.28 +
        driverTrend.qualifyingTrend * 0.22 +
        driverPerformance.telemetrySpeedForm * 0.16 +
        driverPerformance.longRunPaceForm * 0.16 +
        constructorUpgradeProxy * 0.1 +
        declaredUpgrade.trackFit * 0.08
      ));
      const declaredUpgradeDriverAdaptation = clamp(declaredUpgrade.trackFit * (
        driverUpgradeAdaptationProxy * 0.38 +
        driverTrend.finishTrend * 0.18 +
        driverTrend.qualifyingTrend * 0.14 +
        driverPerformance.longRunPaceForm * 0.16 +
        driverPerformance.telemetrySpeedForm * 0.14
      ));
      const driverTrackType = buildTrackTypeFamiliarityFeatures(
        driverHistory.get(result.driverId) || [],
        fieldSize,
        circuitProfile,
        28,
      );
      const constructorTrackType = buildTrackTypeFamiliarityFeatures(
        constructorHistory.get(result.constructorId) || [],
        fieldSize,
        circuitProfile,
        48,
      );
      const driverWeather = buildWeatherAdaptationFeatures(
        driverHistory.get(result.driverId) || [],
        fieldSize,
        race.weather,
      );
      const constructorWeather = buildWeatherAdaptationFeatures(
        constructorHistory.get(result.constructorId) || [],
        fieldSize,
        race.weather,
      );
      const driverPointKey = `${race.season}:${result.driverId}`;
      const constructorPointKey = `${race.season}:${result.constructorId}`;
      const driverPointsBefore = seasonDriverPoints.get(driverPointKey) || 0;
      const constructorPointsBefore = seasonConstructorPoints.get(constructorPointKey) || 0;
      const driverWinsBefore = seasonDriverWins.get(driverPointKey) || 0;
      const constructorWinsBefore = seasonConstructorWins.get(constructorPointKey) || 0;
      const sameCircuitDriverRaces = sameCircuitRaces
        .map((previousRace) => previousRace.results.find((item) => item.driverId === result.driverId))
        .filter((item): item is ResultYaml => Boolean(item));
      const sameCircuitConstructorRaces = sameCircuitRaces
        .flatMap((previousRace) => previousRace.results.filter((item) => item.constructorId === result.constructorId));
      const sameCircuitDriver = sameCircuitDriverPerformance(sameCircuitRaces, result.driverId, fieldSize);
      const sameCircuitConstructor = sameCircuitConstructorPerformance(sameCircuitRaces, result.constructorId, fieldSize);
      const sprint = sprintByDriver.get(result.driverId);
      const sprintQualifying = sprintQualifyingByDriver.get(result.driverId);
      const practiceFeatures = buildPracticeFeatureSummary(race, result.driverId, result.constructorId, fieldSize);
      const declaredUpgradePracticeValidation = clamp(declaredUpgrade.trackFit * (
        practiceFeatures.fpBestAdvantage * 0.32 +
        practiceFeatures.fpConstructorAdvantage * 0.26 +
        practiceFeatures.fpBestGapAdvantage * 0.22 +
        practiceFeatures.fpLapsShare * 0.2
      ));

      const features: WinnerPredictionFeatureVector = {
        gridAdvantage: normalizedPositionAdvantage(gridPosition, fieldSize),
        gridPole: gridPosition === 1 ? 1 : 0,
        gridFrontRow: gridPosition !== null && gridPosition <= 2 ? 1 : 0,
        gridTop3: gridPosition !== null && gridPosition <= 3 ? 1 : 0,
        qualifyingAdvantage: normalizedPositionAdvantage(qualifyingPosition, fieldSize),
        qualifyingPole: qualifyingPosition === 1 ? 1 : 0,
        qualifyingFrontRow: qualifyingPosition !== null && qualifyingPosition <= 2 ? 1 : 0,
        qualifyingPaceAdvantage: qualifyingGap === null ? 0.5 : clamp(1 - qualifyingGap / 1.5),
        qualifyingPaceSharpAdvantage: qualifyingGap === null ? 0.5 : Math.exp(-Math.max(0, qualifyingGap) / 0.28),
        teamMateQualifyingAdvantage: teamMateGap === null ? 0.5 : clamp(0.5 + teamMateGap / 1.5),
        fp1Advantage: practiceFeatures.fp1Advantage,
        fp2Advantage: practiceFeatures.fp2Advantage,
        fp3Advantage: practiceFeatures.fp3Advantage,
        fpBestAdvantage: practiceFeatures.fpBestAdvantage,
        fpAverageAdvantage: practiceFeatures.fpAverageAdvantage,
        fpBestGapAdvantage: practiceFeatures.fpBestGapAdvantage,
        fpLapsShare: practiceFeatures.fpLapsShare,
        fpTeamMateAdvantage: practiceFeatures.fpTeamMateAdvantage,
        fpConstructorAdvantage: practiceFeatures.fpConstructorAdvantage,
        driverLongRunPaceForm: driverPerformance.longRunPaceForm,
        constructorLongRunPaceForm: constructorPerformance.longRunPaceForm,
        driverTyreManagementForm: driverPerformance.tyreManagementForm,
        constructorTyreManagementForm: constructorPerformance.tyreManagementForm,
        driverStintLengthForm: driverPerformance.stintLengthForm,
        constructorStintLengthForm: constructorPerformance.stintLengthForm,
        driverPitStopForm: driverPerformance.pitStopForm,
        constructorPitStopForm: constructorPerformance.pitStopForm,
        driverFastestLapForm: driverPerformance.fastestLapForm,
        constructorFastestLapForm: constructorPerformance.fastestLapForm,
        driverTelemetrySpeedForm: driverPerformance.telemetrySpeedForm,
        constructorTelemetrySpeedForm: constructorPerformance.telemetrySpeedForm,
        driverGridGainForm: driverPerformance.gridGainForm,
        constructorGridGainForm: constructorPerformance.gridGainForm,
        driverChaosForm: driverPerformance.chaosForm,
        constructorChaosForm: constructorPerformance.chaosForm,
        driverRestartProxyForm: driverPerformance.restartProxyForm,
        constructorRestartProxyForm: constructorPerformance.restartProxyForm,
        driverSafetyCarForm: driverPerformance.safetyCarForm,
        constructorSafetyCarForm: constructorPerformance.safetyCarForm,
        driverVirtualSafetyCarForm: driverPerformance.virtualSafetyCarForm,
        constructorVirtualSafetyCarForm: constructorPerformance.virtualSafetyCarForm,
        driverRedFlagForm: driverPerformance.redFlagForm,
        constructorRedFlagForm: constructorPerformance.redFlagForm,
        driverQualifyingConversionForm: driverPerformance.qualifyingConversionForm,
        constructorQualifyingConversionForm: constructorPerformance.qualifyingConversionForm,
        driverTyrePaceBlend: driverPerformance.tyrePaceBlend,
        constructorTyrePaceBlend: constructorPerformance.tyrePaceBlend,
        driverPostPitPaceForm: driverPerformance.postPitPaceForm,
        constructorPostPitPaceForm: constructorPerformance.postPitPaceForm,
        driverStrategyGainForm: driverPerformance.strategyGainForm,
        constructorStrategyGainForm: constructorPerformance.strategyGainForm,
        driverRestartPaceForm: driverPerformance.restartPaceForm,
        constructorRestartPaceForm: constructorPerformance.restartPaceForm,
        driverRestartGainForm: driverPerformance.restartGainForm,
        constructorRestartGainForm: constructorPerformance.restartGainForm,
        driverSafetyCarGainForm: driverPerformance.safetyCarGainForm,
        constructorSafetyCarGainForm: constructorPerformance.safetyCarGainForm,
        driverHotTrackTyreForm: driverPerformance.hotTrackTyreForm,
        constructorHotTrackTyreForm: constructorPerformance.hotTrackTyreForm,
        driverWetTrackPaceForm: driverPerformance.wetTrackPaceForm,
        constructorWetTrackPaceForm: constructorPerformance.wetTrackPaceForm,
        constructorUpgradeProxy,
        constructorDeclaredUpgradeIntensity: declaredUpgrade.intensity,
        constructorDeclaredUpgradeCount: declaredUpgrade.count,
        constructorPerformanceUpgradeIntent: declaredUpgrade.performanceIntent,
        constructorCircuitSpecificUpgradeIntent: declaredUpgrade.circuitSpecificIntent,
        constructorReliabilityUpgradeIntent: declaredUpgrade.reliabilityIntent,
        declaredUpgradeTrackFit: declaredUpgrade.trackFit,
        declaredUpgradeConstructorMomentum,
        declaredUpgradeDriverAdaptation,
        declaredUpgradePracticeValidation,
        declaredUpgradeLongRunValidation,
        declaredUpgradeTrackTypeInteraction: declaredUpgrade.trackTypeInteraction,
        driverUpgradeAdaptationProxy,
        driverTrackTypeFamiliarity: driverTrackType.familiarity,
        constructorTrackTypeFamiliarity: constructorTrackType.familiarity,
        driverTrackTypePaceForm: driverTrackType.paceForm,
        constructorTrackTypePaceForm: constructorTrackType.paceForm,
        driverTrackTypeRacecraft: driverTrackType.racecraft,
        constructorTrackTypeRacecraft: constructorTrackType.racecraft,
        constructorTrackTypeReliability: constructorTrackType.reliability,
        driverShortRecentWinRate: driverShortStats.winRate,
        driverSequenceMomentum: driverSequence.momentum,
        driverSequenceConsistency: driverSequence.consistency,
        driverSequenceUpside: driverSequence.upside,
        driverFinishTrend: driverTrend.finishTrend,
        driverQualifyingTrend: driverTrend.qualifyingTrend,
        driverWinTrend: driverTrend.winTrend,
        driverPodiumTrend: driverTrend.podiumTrend,
        driverRecentFinishForm: driverStats.finishForm,
        driverRecentPodiumRate: driverStats.podiumRate,
        driverRecentWinRate: driverStats.winRate,
        driverLongRecentWinRate: driverLongStats.winRate,
        constructorShortRecentWinRate: constructorShortStats.winRate,
        constructorSequenceMomentum: constructorSequence.momentum,
        constructorSequenceConsistency: constructorSequence.consistency,
        constructorSequenceUpside: constructorSequence.upside,
        constructorFinishTrend: constructorTrend.finishTrend,
        constructorQualifyingTrend: constructorTrend.qualifyingTrend,
        constructorWinTrend: constructorTrend.winTrend,
        constructorPodiumTrend: constructorTrend.podiumTrend,
        constructorRecentFinishForm: constructorStats.finishForm,
        constructorRecentPodiumRate: constructorStats.podiumRate,
        constructorRecentWinRate: constructorStats.winRate,
        constructorLongRecentWinRate: constructorLongStats.winRate,
        driverStandingAdvantage: rankAdvantage(driverPointsBefore, driverPoints),
        driverStandingPointsShare: maxDriverPoints ? driverPointsBefore / maxDriverPoints : 0.5,
        constructorStandingAdvantage: rankAdvantage(constructorPointsBefore, constructorPoints),
        constructorStandingPointsShare: maxConstructorPoints ? constructorPointsBefore / maxConstructorPoints : 0.5,
        driverSeasonWinRate: race.round > 1 ? driverWinsBefore / (race.round - 1) : 0,
        constructorSeasonWinRate: race.round > 1 ? constructorWinsBefore / (race.round - 1) : 0,
        sameCircuitDriverWinRate: sameCircuitDriverRaces.length
          ? sameCircuitDriverRaces.filter((item) => toNumber(item.position) === 1).length / sameCircuitDriverRaces.length
          : 0,
        sameCircuitDriverPodiumRate: sameCircuitDriverRaces.length
          ? sameCircuitDriverRaces.filter((item) => {
            const position = toNumber(item.position);
            return position !== null && position <= 3;
          }).length / sameCircuitDriverRaces.length
          : 0,
        sameCircuitDriverStartRate: sameCircuitDriver.startRate,
        sameCircuitDriverFinishForm: sameCircuitDriver.finishForm,
        sameCircuitDriverQualifyingForm: sameCircuitDriver.qualifyingForm,
        sameCircuitDriverGridGainForm: sameCircuitDriver.gridGainForm,
        sameCircuitConstructorWinRate: sameCircuitConstructorRaces.length
          ? sameCircuitConstructorRaces.filter((item) => toNumber(item.position) === 1).length / sameCircuitConstructorRaces.length
          : 0,
        sameCircuitConstructorStartRate: sameCircuitConstructor.startRate,
        sameCircuitConstructorFinishForm: sameCircuitConstructor.finishForm,
        sameCircuitConstructorPodiumRate: sameCircuitConstructor.podiumRate,
        sameCircuitConstructorQualifyingForm: sameCircuitConstructor.qualifyingForm,
        sameCircuitConstructorGridGainForm: sameCircuitConstructor.gridGainForm,
        sameCircuitPoleWinRate,
        sameCircuitTop3GridWinRate,
        sameCircuitChaosRate: circuitChaos.chaosRate,
        sameCircuitSafetyCarRate: circuitChaos.safetyCarRate,
        sameCircuitVirtualSafetyCarRate: circuitChaos.virtualSafetyCarRate,
        sameCircuitRedFlagRate: circuitChaos.redFlagRate,
        sameCircuitOvertakeUpsetRate: circuitChaos.overtakeUpsetRate,
        circuitStreetTrack: circuitProfile.streetTrack,
        circuitLowOvertake: circuitProfile.lowOvertake,
        circuitTyreStress: circuitProfile.tyreStress,
        circuitRestartRisk: circuitProfile.restartRisk,
        circuitQualifyingImportance: circuitProfile.qualifyingImportance,
        weatherRainRisk: race.weather.rainRisk,
        weatherCoolTrack: race.weather.coolTrack,
        weatherHotTrack: race.weather.hotTrack,
        weatherHumidity: race.weather.humidity,
        weatherWind: race.weather.wind,
        weatherTrackAirDelta: race.weather.trackAirDelta,
        driverSimilarWeatherForm: driverWeather.similarWeatherForm,
        constructorSimilarWeatherForm: constructorWeather.similarWeatherForm,
        driverRainWeatherForm: driverWeather.rainForm,
        constructorRainWeatherForm: constructorWeather.rainForm,
        driverHotTrackForm: driverWeather.hotTrackForm,
        constructorHotTrackForm: constructorWeather.hotTrackForm,
        driverCoolTrackForm: driverWeather.coolTrackForm,
        constructorCoolTrackForm: constructorWeather.coolTrackForm,
        driverWindWeatherReliability: driverWeather.windReliability,
        constructorWindWeatherReliability: constructorWeather.windReliability,
        rainDriverInteraction: race.weather.rainRisk * driverWeather.rainForm,
        rainConstructorInteraction: race.weather.rainRisk * constructorWeather.rainForm,
        hotTrackConstructorInteraction: race.weather.hotTrack * constructorWeather.hotTrackForm,
        coolTrackDriverInteraction: race.weather.coolTrack * driverWeather.coolTrackForm,
        windReliabilityInteraction: race.weather.wind * (
          driverWeather.windReliability * 0.55 + constructorWeather.windReliability * 0.45
        ),
        sprintWeekend: race.isSprintWeekend ? 1 : 0,
        sprintFinishAdvantage: normalizedPositionAdvantage(toNumber(sprint?.position), fieldSize),
        sprintQualifyingAdvantage: normalizedPositionAdvantage(toNumber(sprintQualifying?.position), fieldSize),
        driverRecentReliability: driverStats.reliability,
        constructorRecentReliability: constructorStats.reliability,
        raceRoundProgress: clamp((race.round - 1) / 24),
        gridPoleCircuitInteraction: normalizedPositionAdvantage(gridPosition, fieldSize) * sameCircuitPoleWinRate,
        gridFrontRowCircuitInteraction: (gridPosition !== null && gridPosition <= 2 ? 1 : 0) * sameCircuitPoleWinRate,
        gridTop3CircuitInteraction: (gridPosition !== null && gridPosition <= 3 ? 1 : 0) * sameCircuitTop3GridWinRate,
        driverCircuitFamiliarityInteraction: (
          sameCircuitDriver.startRate * 0.25 +
          sameCircuitDriver.finishForm * 0.3 +
          sameCircuitDriver.qualifyingForm * 0.2 +
          sameCircuitDriver.gridGainForm * 0.25
        ) * (
          circuitProfile.streetTrack * 0.3 +
          circuitProfile.lowOvertake * 0.25 +
          circuitProfile.tyreStress * 0.2 +
          circuitProfile.qualifyingImportance * 0.25
        ),
        constructorCircuitFamiliarityInteraction: (
          sameCircuitConstructor.startRate * 0.2 +
          sameCircuitConstructor.finishForm * 0.3 +
          sameCircuitConstructor.podiumRate * 0.2 +
          sameCircuitConstructor.qualifyingForm * 0.15 +
          sameCircuitConstructor.gridGainForm * 0.15
        ) * (
          circuitProfile.lowOvertake * 0.3 +
          circuitProfile.tyreStress * 0.3 +
          circuitProfile.qualifyingImportance * 0.25 +
          circuitProfile.restartRisk * 0.15
        ),
        chaosRacecraftInteraction: (driverPerformance.chaosForm * 0.55 + constructorPerformance.chaosForm * 0.45) *
          (circuitChaos.chaosRate * 0.5 + circuitProfile.restartRisk * 0.5),
        restartRacecraftInteraction: (
          driverPerformance.restartProxyForm * 0.6 + constructorPerformance.restartProxyForm * 0.4
        ) * circuitProfile.restartRisk,
        safetyCarRacecraftInteraction: (
          driverPerformance.safetyCarForm * 0.6 + constructorPerformance.safetyCarForm * 0.4
        ) * (circuitChaos.safetyCarRate * 0.55 + circuitProfile.restartRisk * 0.45),
        redFlagRacecraftInteraction: (
          driverPerformance.redFlagForm * 0.65 + constructorPerformance.redFlagForm * 0.35
        ) * (circuitChaos.redFlagRate * 0.6 + circuitProfile.restartRisk * 0.4),
        tyreStressPaceInteraction: (
          driverPerformance.tyrePaceBlend * 0.55 + constructorPerformance.tyrePaceBlend * 0.45
        ) * circuitProfile.tyreStress,
        postPitStrategyInteraction: (
          driverPerformance.postPitStrategyBlend * 0.5 + constructorPerformance.postPitStrategyBlend * 0.5
        ) * (circuitProfile.lowOvertake * 0.45 + circuitProfile.tyreStress * 0.35 + circuitChaos.overtakeUpsetRate * 0.2),
        restartPaceInteraction: (
          driverPerformance.restartBlend * 0.6 + constructorPerformance.restartBlend * 0.4
        ) * (circuitProfile.restartRisk * 0.55 + circuitChaos.safetyCarRate * 0.3 + circuitChaos.redFlagRate * 0.15),
        weatherTyreInteraction: (
          driverPerformance.hotTrackTyreForm * race.weather.hotTrack * 0.45 +
          constructorPerformance.hotTrackTyreForm * race.weather.hotTrack * 0.35 +
          driverPerformance.wetTrackPaceForm * race.weather.rainRisk * 0.2
        ),
        upgradeTrendInteraction: (constructorUpgradeProxy * 0.78 + declaredUpgrade.trackFit * 0.22) * (
          driverUpgradeAdaptationProxy * 0.45 +
          driverTrend.finishTrend * 0.25 +
          constructorTrend.qualifyingTrend * 0.3
        ),
        upgradePracticeInteraction: declaredUpgradePracticeValidation * (
          practiceFeatures.fpBestAdvantage * 0.34 +
          practiceFeatures.fpConstructorAdvantage * 0.26 +
          normalizedPositionAdvantage(qualifyingPosition, fieldSize) * 0.22 +
          declaredUpgrade.performanceIntent * 0.18
        ),
        upgradeRacePaceInteraction: declaredUpgradeLongRunValidation * (
          constructorPerformance.longRunPaceForm * 0.32 +
          constructorPerformance.tyrePaceBlend * 0.24 +
          driverPerformance.longRunPaceForm * 0.22 +
          circuitProfile.tyreStress * 0.22
        ),
        upgradeTrackFitInteraction: declaredUpgrade.trackTypeInteraction * (
          constructorTrackType.paceForm * 0.24 +
          constructorTrackType.familiarity * 0.2 +
          constructorTrackType.racecraft * 0.16 +
          circuitProfile.qualifyingImportance * 0.16 +
          circuitProfile.tyreStress * 0.14 +
          circuitProfile.lowOvertake * 0.1
        ),
        trackTypeFamiliarityInteraction: (
          constructorTrackType.familiarity * 0.34 +
          constructorTrackType.paceForm * 0.22 +
          constructorTrackType.racecraft * 0.18 +
          driverTrackType.familiarity * 0.16 +
          driverTrackType.racecraft * 0.1
        ) * (
          circuitProfile.lowOvertake * 0.25 +
          circuitProfile.tyreStress * 0.25 +
          circuitProfile.streetTrack * 0.2 +
          circuitProfile.restartRisk * 0.15 +
          circuitProfile.qualifyingImportance * 0.15
        ),
        qualifyingConversionInteraction: (
          driverPerformance.qualifyingConversionForm * 0.55 +
          constructorPerformance.qualifyingConversionForm * 0.45
        ) * circuitProfile.qualifyingImportance,
        constructorQualifyingInteraction: constructorStats.winRate * normalizedPositionAdvantage(qualifyingPosition, fieldSize),
        driverTeamMateInteraction: driverStats.finishForm * (teamMateGap === null ? 0.5 : clamp(0.5 + teamMateGap / 1.5)),
        driverTrendSeasonInteraction: driverTrend.finishTrend * (race.round > 1 ? driverWinsBefore / (race.round - 1) : 0),
        constructorTrendStrengthInteraction: constructorTrend.finishTrend * constructorStats.winRate,
      };

      return {
        raceKey: race.raceKey,
        driverId: result.driverId,
        constructorId: result.constructorId,
        winner: toNumber(result.position) === 1,
        features,
      };
    });

    if (candidates.length > 1) {
      raceGroups.push(candidates);
    }

    race.results.forEach((result) => {
      const position = toNumber(result.position);
      const qualifyingPosition = toNumber(qualifyingByDriver.get(result.driverId)?.position);
      const points = toNumber(result.points) || 0;
      const winner = position === 1;
      const podium = position !== null && position <= 3;
      const dnf = Boolean(result.reasonRetired);
      const performance = racePerformanceSummary.get(result.driverId);
      const driverPointKey = `${race.season}:${result.driverId}`;
      const constructorPointKey = `${race.season}:${result.constructorId}`;

      addHistoryItem(driverHistory, result.driverId, {
        position,
        qualifyingPosition,
        gridPosition: toNumber(result.gridPosition),
        points,
        winner,
        podium,
        dnf,
        chaosScore: currentRaceChaosScore,
        safetyCarScore: race.safety.safetyCar,
        virtualSafetyCarScore: race.safety.virtualSafetyCar,
        redFlagScore: race.safety.redFlag,
        weather: race.weather,
        longRunPaceAdvantage: performance?.longRunPaceAdvantage ?? 0.5,
        tyreManagementAdvantage: performance?.tyreManagementAdvantage ?? 0.5,
        stintLengthAdvantage: performance?.stintLengthAdvantage ?? 0.5,
        pitStopAdvantage: performance?.pitStopAdvantage ?? 0.5,
        fastestLapAdvantage: performance?.fastestLapAdvantage ?? 0.5,
        telemetrySpeedAdvantage: performance?.telemetrySpeedAdvantage ?? 0.5,
        postPitPaceAdvantage: performance?.postPitPaceAdvantage ?? 0.5,
        strategyGainAdvantage: performance?.strategyGainAdvantage ?? 0.5,
        restartPaceAdvantage: performance?.restartPaceAdvantage ?? 0.5,
        restartGainAdvantage: performance?.restartGainAdvantage ?? 0.5,
        safetyCarGainAdvantage: performance?.safetyCarGainAdvantage ?? 0.5,
        hotTrackTyreAdvantage: performance?.hotTrackTyreAdvantage ?? 0.5,
        wetTrackPaceAdvantage: performance?.wetTrackPaceAdvantage ?? 0.5,
        circuitProfile,
      });
      addHistoryItem(constructorHistory, result.constructorId, {
        position,
        qualifyingPosition,
        gridPosition: toNumber(result.gridPosition),
        points,
        winner,
        podium,
        dnf,
        chaosScore: currentRaceChaosScore,
        safetyCarScore: race.safety.safetyCar,
        virtualSafetyCarScore: race.safety.virtualSafetyCar,
        redFlagScore: race.safety.redFlag,
        weather: race.weather,
        longRunPaceAdvantage: performance?.longRunPaceAdvantage ?? 0.5,
        tyreManagementAdvantage: performance?.tyreManagementAdvantage ?? 0.5,
        stintLengthAdvantage: performance?.stintLengthAdvantage ?? 0.5,
        pitStopAdvantage: performance?.pitStopAdvantage ?? 0.5,
        fastestLapAdvantage: performance?.fastestLapAdvantage ?? 0.5,
        telemetrySpeedAdvantage: performance?.telemetrySpeedAdvantage ?? 0.5,
        postPitPaceAdvantage: performance?.postPitPaceAdvantage ?? 0.5,
        strategyGainAdvantage: performance?.strategyGainAdvantage ?? 0.5,
        restartPaceAdvantage: performance?.restartPaceAdvantage ?? 0.5,
        restartGainAdvantage: performance?.restartGainAdvantage ?? 0.5,
        safetyCarGainAdvantage: performance?.safetyCarGainAdvantage ?? 0.5,
        hotTrackTyreAdvantage: performance?.hotTrackTyreAdvantage ?? 0.5,
        wetTrackPaceAdvantage: performance?.wetTrackPaceAdvantage ?? 0.5,
        circuitProfile,
      });
      seasonDriverPoints.set(driverPointKey, (seasonDriverPoints.get(driverPointKey) || 0) + points);
      seasonConstructorPoints.set(constructorPointKey, (seasonConstructorPoints.get(constructorPointKey) || 0) + points);

      if (winner) {
        seasonDriverWins.set(driverPointKey, (seasonDriverWins.get(driverPointKey) || 0) + 1);
        seasonConstructorWins.set(constructorPointKey, (seasonConstructorWins.get(constructorPointKey) || 0) + 1);
      }
    });

    addHistoryItem(circuitHistory, race.circuitId, race);
  });

  return raceGroups;
}

function buildPoleTrainingGroups(raceGroups: WinnerPredictionCandidate[][]) {
  return raceGroups
    .map((raceGroup) => raceGroup.map((candidate) => ({
      ...candidate,
      winner: candidate.features.qualifyingPole === 1,
    })))
    .filter((raceGroup) => raceGroup.some((candidate) => candidate.winner));
}

function withPoleModelFeatures(
  raceGroups: WinnerPredictionCandidate[][],
  poleModel: WinnerPredictionWeights,
  poleFeatureNames: readonly WinnerPredictionFeatureName[],
) {
  return raceGroups.map((raceGroup) => {
    const prediction = predictWinnerRace(raceGroup, poleModel, poleFeatureNames);
    const predictionByDriver = new Map(prediction.map((result) => [result.driverId, result]));

    return raceGroup.map((candidate) => {
      const polePrediction = predictionByDriver.get(candidate.driverId);

      return {
        ...candidate,
        features: {
          ...candidate.features,
          poleModelProbability: polePrediction?.probability ?? 1 / raceGroup.length,
          poleModelRankAdvantage: normalizedPositionAdvantage(polePrediction?.rank ?? null, raceGroup.length),
          poleModelScore: polePrediction ? clamp((polePrediction.score + 4) / 8) : 0.5,
        },
      };
    });
  });
}

function predictHybridWinnerRace(
  candidates: WinnerPredictionCandidate[],
  linearModel: WinnerPredictionWeights,
  nonlinearModel: NonlinearWinnerPredictionModel,
  featureNames: readonly WinnerPredictionFeatureName[],
  nonlinearBlend: number,
): WinnerPredictionResult[] {
  if (!candidates.length) {
    return [];
  }

  const linearPrediction = predictWinnerRace(candidates, linearModel, featureNames);
  const linearFactorsByDriver = new Map(linearPrediction.map((result) => [result.driverId, result.factors]));
  const rawScores = candidates.map((candidate) => (
    scoreWinnerCandidate(candidate, linearModel, featureNames) +
    scoreNonlinearWinnerCandidate(candidate, nonlinearModel) * nonlinearBlend
  ));
  const maxScore = Math.max(...rawScores);
  const exponentials = rawScores.map((score) => Math.exp(score - maxScore));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;

  return candidates
    .map((candidate, index) => ({
      driverId: candidate.driverId,
      constructorId: candidate.constructorId,
      score: rawScores[index],
      probability: exponentials[index] / total,
      winner: candidate.winner,
      rank: 0,
      factors: linearFactorsByDriver.get(candidate.driverId) || [],
    }))
    .sort((left, right) => right.probability - left.probability)
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
}

function buildResidualWinnerTrainingSamples(
  raceGroups: WinnerPredictionCandidate[][],
  linearModel: WinnerPredictionWeights,
  featureNames: readonly WinnerPredictionFeatureName[],
): ResidualWinnerTrainingSample[] {
  const residualTarget = getStringArg('residual-target', 'logit');

  return raceGroups.flatMap((raceGroup) => {
    const prediction = predictWinnerRace(raceGroup, linearModel, featureNames);
    const probabilityByDriver = new Map(prediction.map((result) => [result.driverId, result.probability]));

    return raceGroup.map((candidate) => ({
      candidate,
      target: residualWinnerTarget(
        candidate,
        probabilityByDriver.get(candidate.driverId) || 0,
        raceGroup.length,
        residualTarget,
      ),
    }));
  });
}

function residualWinnerTarget(
  candidate: WinnerPredictionCandidate,
  linearProbability: number,
  fieldSize: number,
  residualTarget: string,
) {
  if (residualTarget === 'probability') {
    return (candidate.winner ? 1 : 0) - linearProbability;
  }

  return candidate.winner
    ? 1 - linearProbability
    : -linearProbability / Math.max(1, fieldSize - 1);
}

function uniqueRaceGroupsByKey(raceGroups: WinnerPredictionCandidate[][]) {
  const seen = new Set<string>();
  return raceGroups.filter((raceGroup) => {
    const raceKey = raceGroup[0]?.raceKey;
    if (!raceKey || seen.has(raceKey)) {
      return false;
    }
    seen.add(raceKey);
    return true;
  });
}

function buildOutOfFoldResidualWinnerTrainingSamples(
  raceGroups: WinnerPredictionCandidate[][],
  featureNames: readonly WinnerPredictionFeatureName[],
): ResidualWinnerTrainingSample[] {
  const residualTarget = getStringArg('residual-target', 'logit');
  const minimumGroups = getNumberArg('residual-oof-min-races', 8);
  const windowSize = getNumberArg('residual-oof-window', 44);
  const iterations = getNumberArg('residual-oof-iterations', 12);
  const uniqueGroups = uniqueRaceGroupsByKey(raceGroups);
  const samples: ResidualWinnerTrainingSample[] = [];

  uniqueGroups.forEach((raceGroup, index) => {
    if (index < minimumGroups) {
      return;
    }

    const trainingSlice = uniqueGroups.slice(Math.max(0, index - windowSize), index);
    const oofLinearModel = trainWinnerPredictionModel(trainingSlice, {
      featureNames,
      iterations,
      learningRate: 0.085,
      l2: 0.004,
    });
    const prediction = predictWinnerRace(raceGroup, oofLinearModel, featureNames);
    const probabilityByDriver = new Map(prediction.map((result) => [result.driverId, result.probability]));

    raceGroup.forEach((candidate) => {
      samples.push({
        candidate,
        target: residualWinnerTarget(
          candidate,
          probabilityByDriver.get(candidate.driverId) || 0,
          raceGroup.length,
          residualTarget,
        ),
      });
    });
  });

  return samples.length ? samples : buildResidualWinnerTrainingSamples(
    raceGroups,
    trainWinnerPredictionModel(raceGroups, {
      featureNames,
      iterations: ROLLING_TRAINING_ITERATIONS,
      learningRate: 0.085,
      l2: 0.003,
    }),
    featureNames,
  );
}

function raceMetadataByKey(races: SourceRace[]) {
  return new Map(races.map((race) => [race.raceKey, race]));
}

function metricsByEra(
  reportRaces: PredictionReportRace[],
) {
  const reportRacesByEra = new Map<WinnerPredictionEra, PredictionReportRace[]>();

  reportRaces.forEach((race) => {
    const eraRaces = reportRacesByEra.get(race.era) || [];
    eraRaces.push(race);
    reportRacesByEra.set(race.era, eraRaces);
  });

  return Object.fromEntries([...reportRacesByEra.entries()].map(([era, eraRaces]) => {
    const top1Hits = eraRaces.filter((race) => race.winnerRank === 1).length;
    const top3Hits = eraRaces.filter((race) => race.top3Hit).length;
    const rankTotal = eraRaces.reduce((sum, race) => sum + race.winnerRank, 0);
    const logLossTotal = eraRaces.reduce((sum, race) => sum - Math.log(Math.max(race.winnerProbability, 1e-12)), 0);
    const brierTotal = eraRaces.reduce((sum, race) => sum + race.brierScore, 0);

    return [
      era,
      {
        raceCount: eraRaces.length,
        top1Accuracy: top1Hits / eraRaces.length,
        top3Accuracy: top3Hits / eraRaces.length,
        averageWinnerRank: rankTotal / eraRaces.length,
        logLoss: logLossTotal / eraRaces.length,
        brierScore: brierTotal / eraRaces.length,
      },
    ];
  })) as Partial<Record<WinnerPredictionEra, WinnerPredictionMetrics>>;
}

function runRollingBacktest(
  races: SourceRace[],
  raceGroups: WinnerPredictionCandidate[][],
  predictionPhase: PredictionPhase,
  modelKind: WinnerModelKind,
): PredictionReport {
  const metadata = raceMetadataByKey(races);
  const poleFeatureNames = getPoleFeatureNames(predictionPhase);
  const winnerFeatureNames = getWinnerFeatureNames(predictionPhase);
  const nonlinearBlend = modelKind === 'hybrid' ? getNumberArg('nonlinear-blend', 0.18) : 0;
  const residualBlend = modelKind === 'residual-hybrid' ? getNumberArg('residual-blend', 0.18) : 0;
  const residualTrainingMode = modelKind === 'residual-hybrid'
    ? (getStringArg('residual-training', 'out-of-fold') === 'in-sample' ? 'in-sample' : 'out-of-fold')
    : 'in-sample';
  const reportRaces: PredictionReportRace[] = [];
  const poleBaselineGroups: WinnerPredictionCandidate[][] = [];
  let latestModel: WinnerPredictionWeights = { bias: 0, weights: {} };
  let latestNonlinearModel: NonlinearWinnerPredictionModel | undefined;
  let latestPoleModel: WinnerPredictionWeights = { bias: 0, weights: {} };
  let top1Hits = 0;
  let top3Hits = 0;
  let poleRaceCount = 0;
  let poleTop1Hits = 0;
  let poleTop3Hits = 0;
  let poleRankTotal = 0;
  let poleLogLossTotal = 0;
  let poleBrierTotal = 0;
  let rankTotal = 0;
  let logLossTotal = 0;
  let brierTotal = 0;

  raceGroups.forEach((raceGroup, index) => {
    if (index < MINIMUM_TRAINING_RACES) {
      return;
    }

    const race = metadata.get(raceGroup[0].raceKey);
    if (!race) {
      return;
    }

    const sameEraTrainingGroups = raceGroups
      .slice(0, index)
      .filter((group) => metadata.get(group[0].raceKey)?.era === race.era)
      .slice(-MAX_ERA_TRAINING_RACES);
    const recentTrainingGroups = raceGroups.slice(Math.max(0, index - WINDOW_SIZE), index);
    const globalTrainingGroups = raceGroups.slice(Math.max(0, index - MAX_GLOBAL_TRAINING_RACES), index);
    const trainingGroups = [
      ...globalTrainingGroups,
      ...sameEraTrainingGroups,
      ...recentTrainingGroups,
      ...recentTrainingGroups,
    ];

    latestPoleModel = trainWinnerPredictionModel(buildPoleTrainingGroups(trainingGroups), {
      featureNames: poleFeatureNames,
      iterations: ROLLING_TRAINING_ITERATIONS,
      learningRate: 0.085,
      l2: 0.003,
    });

    const polePrediction = predictWinnerRace(raceGroup, latestPoleModel, poleFeatureNames);
    const actualPole = polePrediction.find((result) => result.factors.some((factor) => (
      factor.feature === 'qualifyingPole' && factor.value === 1
    ))) || polePrediction.find((result) => {
      const candidate = raceGroup.find((entry) => entry.driverId === result.driverId);
      return candidate?.features.qualifyingPole === 1;
    });
    const predictedPole = polePrediction[0];

    if (actualPole && predictedPole) {
      poleRaceCount += 1;
      poleTop1Hits += actualPole.rank === 1 ? 1 : 0;
      poleTop3Hits += actualPole.rank <= 3 ? 1 : 0;
      poleRankTotal += actualPole.rank;
      poleLogLossTotal += -Math.log(Math.max(actualPole.probability, 1e-12));
      poleBrierTotal += polePrediction.reduce((sum, result) => {
        const candidate = raceGroup.find((entry) => entry.driverId === result.driverId);
        const expected = candidate?.features.qualifyingPole === 1 ? 1 : 0;
        return sum + (result.probability - expected) ** 2;
      }, 0);
    }

    const augmentedTrainingGroups = withPoleModelFeatures(trainingGroups, latestPoleModel, poleFeatureNames);
    const augmentedRaceGroup = withPoleModelFeatures([raceGroup], latestPoleModel, poleFeatureNames)[0] || raceGroup;

    let prediction: WinnerPredictionResult[];
    if (modelKind === 'mlp') {
      latestNonlinearModel = trainNonlinearWinnerPredictionModel(augmentedTrainingGroups, {
        featureNames: winnerFeatureNames,
        hiddenSize: getNumberArg('mlp-hidden', 8),
        iterations: getNumberArg('mlp-iterations', Math.max(12, Math.floor(ROLLING_TRAINING_ITERATIONS * 0.75))),
        learningRate: getNumberArg('mlp-learning-rate', 0.035),
        l2: getNumberArg('mlp-l2', 0.0015),
      });
      prediction = predictNonlinearWinnerRace(augmentedRaceGroup, latestNonlinearModel);
    } else if (modelKind === 'hybrid' || modelKind === 'residual-hybrid') {
      latestModel = trainWinnerPredictionModel(augmentedTrainingGroups, {
        featureNames: winnerFeatureNames,
        iterations: ROLLING_TRAINING_ITERATIONS,
        learningRate: 0.085,
        l2: 0.003,
      });
      if (modelKind === 'residual-hybrid') {
        const residualSamples = residualTrainingMode === 'out-of-fold'
          ? buildOutOfFoldResidualWinnerTrainingSamples(augmentedTrainingGroups, winnerFeatureNames)
          : buildResidualWinnerTrainingSamples(augmentedTrainingGroups, latestModel, winnerFeatureNames);
        latestNonlinearModel = trainResidualWinnerPredictionModel(
          residualSamples,
          {
            featureNames: winnerFeatureNames,
            hiddenSize: getNumberArg('mlp-hidden', 4),
            iterations: getNumberArg('mlp-iterations', 36),
            learningRate: getNumberArg('mlp-learning-rate', 0.045),
            l2: getNumberArg('mlp-l2', 0.003),
          },
        );
      } else {
        latestNonlinearModel = trainNonlinearWinnerPredictionModel(augmentedTrainingGroups, {
          featureNames: winnerFeatureNames,
          hiddenSize: getNumberArg('mlp-hidden', 4),
          iterations: getNumberArg('mlp-iterations', 18),
          learningRate: getNumberArg('mlp-learning-rate', 0.025),
          l2: getNumberArg('mlp-l2', 0.002),
        });
      }
      prediction = predictHybridWinnerRace(
        augmentedRaceGroup,
        latestModel,
        latestNonlinearModel,
        winnerFeatureNames,
        modelKind === 'residual-hybrid' ? residualBlend : nonlinearBlend,
      );
    } else {
      latestModel = trainWinnerPredictionModel(augmentedTrainingGroups, {
        featureNames: winnerFeatureNames,
        iterations: ROLLING_TRAINING_ITERATIONS,
        learningRate: 0.085,
        l2: 0.003,
      });
      prediction = predictWinnerRace(augmentedRaceGroup, latestModel, winnerFeatureNames);
    }
    const actualWinner = prediction.find((result) => result.winner);
    const predictedWinner = prediction[0];

    if (!actualWinner || !predictedWinner) {
      return;
    }

    poleBaselineGroups.push(augmentedRaceGroup);
    top1Hits += actualWinner.rank === 1 ? 1 : 0;
    top3Hits += actualWinner.rank <= 3 ? 1 : 0;
    rankTotal += actualWinner.rank;
    logLossTotal += -Math.log(Math.max(actualWinner.probability, 1e-12));
    const raceBrierScore = prediction.reduce((sum, result) => {
      const expected = result.winner ? 1 : 0;
      return sum + (result.probability - expected) ** 2;
    }, 0);
    brierTotal += raceBrierScore;
    reportRaces.push({
      raceKey: race.raceKey,
      season: race.season,
      round: race.round,
      raceName: race.raceName,
      era: race.era,
      actualWinner: actualWinner.driverId,
      predictedWinner: predictedWinner.driverId,
      actualPole: actualPole?.driverId ?? null,
      predictedPole: predictedPole?.driverId ?? null,
      poleRank: actualPole?.rank ?? null,
      poleProbability: actualPole?.probability ?? null,
      winnerRank: actualWinner.rank,
      winnerProbability: actualWinner.probability,
      brierScore: raceBrierScore,
      top3Hit: actualWinner.rank <= 3,
      top5: prediction.slice(0, 5).map((result) => ({
        rank: result.rank,
        driverId: result.driverId,
        constructorId: result.constructorId,
        probability: result.probability,
        factors: result.factors.map((factor) => ({
          feature: factor.feature,
          contribution: factor.contribution,
        })),
      })),
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    config: {
      modelKind,
      nonlinearBlend,
      residualBlend,
      residualTrainingMode,
      sequenceEncoder: 'fixed-recurrent',
      predictionPhase,
      windowSize: WINDOW_SIZE,
      minimumTrainingRaces: MINIMUM_TRAINING_RACES,
      featureCount: winnerFeatureNames.length,
      poleFeatureCount: poleFeatureNames.length,
      shortWindowSize: SHORT_WINDOW_SIZE,
      longWindowSize: LONG_WINDOW_SIZE,
    },
    metrics: {
      learnedModel: {
        raceCount: reportRaces.length,
        top1Accuracy: reportRaces.length ? top1Hits / reportRaces.length : 0,
        top3Accuracy: reportRaces.length ? top3Hits / reportRaces.length : 0,
        averageWinnerRank: reportRaces.length ? rankTotal / reportRaces.length : 0,
        logLoss: reportRaces.length ? logLossTotal / reportRaces.length : 0,
        brierScore: reportRaces.length ? brierTotal / reportRaces.length : 0,
      },
      trainedPoleModel: {
        raceCount: poleRaceCount,
        top1Accuracy: poleRaceCount ? poleTop1Hits / poleRaceCount : 0,
        top3Accuracy: poleRaceCount ? poleTop3Hits / poleRaceCount : 0,
        averageWinnerRank: poleRaceCount ? poleRankTotal / poleRaceCount : 0,
        logLoss: poleRaceCount ? poleLogLossTotal / poleRaceCount : 0,
        brierScore: poleRaceCount ? poleBrierTotal / poleRaceCount : 0,
      },
      poleBaseline: evaluateWinnerPredictions(poleBaselineGroups, buildPoleBaselineModel()),
      byEra: metricsByEra(reportRaces),
    },
    model: latestModel,
    ...(latestNonlinearModel ? { nonlinearModel: latestNonlinearModel } : {}),
    poleModel: latestPoleModel,
    races: reportRaces,
  };
}

function main() {
  const seasonFrom = getNumberArg('season-from', 1950);
  const seasonTo = getNumberArg('season-to', 9999);
  const predictionPhase = getPredictionPhase();
  const modelKind = getWinnerModelKind();
  const races = loadSourceRaces().filter((race) => race.season >= seasonFrom && race.season <= seasonTo);
  const raceGroups = buildRaceCandidates(races);
  const report = runRollingBacktest(races, raceGroups, predictionPhase, modelKind);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`Winner prediction backtest wrote ${OUTPUT_PATH}`);
  console.log(`Winner model: ${report.config.modelKind}`);
  console.log(`Nonlinear blend: ${report.config.nonlinearBlend}`);
  console.log(`Residual blend: ${report.config.residualBlend}`);
  console.log(`Residual training: ${report.config.residualTrainingMode}`);
  console.log(`Sequence encoder: ${report.config.sequenceEncoder}`);
  console.log(`Prediction phase: ${report.config.predictionPhase}`);
  console.log(`Winner features: ${report.config.featureCount}`);
  console.log(`Pole features: ${report.config.poleFeatureCount}`);
  console.log(`Races evaluated: ${report.metrics.learnedModel.raceCount}`);
  console.log(`Top-1: ${(report.metrics.learnedModel.top1Accuracy * 100).toFixed(1)}%`);
  console.log(`Top-3: ${(report.metrics.learnedModel.top3Accuracy * 100).toFixed(1)}%`);
  console.log(`Trained pole Top-1: ${(report.metrics.trainedPoleModel.top1Accuracy * 100).toFixed(1)}%`);
  console.log(`Pole baseline Top-1: ${(report.metrics.poleBaseline.top1Accuracy * 100).toFixed(1)}%`);
}

main();
