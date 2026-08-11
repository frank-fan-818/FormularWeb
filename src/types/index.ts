export interface Driver {
  driverId: string;
  permanentNumber: string;
  code: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface Constructor {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
}

export interface Circuit {
  circuitId: string;
  url: string;
  circuitName: string;
  Location: {
    lat: string;
    long: string;
    locality: string;
    country: string;
  };
}

export interface Race {
  season: string;
  round: string;
  url: string;
  raceName: string;
  Circuit: Circuit;
  date: string;
  time?: string;
  Results?: Result[];
  QualifyingResults?: QualifyingResult[];
  SprintResults?: Result[];
  FirstPractice?: SessionSchedule;
  SecondPractice?: SessionSchedule;
  ThirdPractice?: SessionSchedule;
  Qualifying?: SessionSchedule;
  Sprint?: SessionSchedule;
  SprintQualifying?: SessionSchedule;
}

export interface SessionSchedule {
  date: string;
  time?: string;
}

export interface Result {
  number: string;
  position: string;
  positionText: string;
  points: string;
  Driver: Driver;
  Constructor: Constructor;
  grid: string;
  laps: string;
  status: string;
  Time?: {
    millis: string;
    time: string;
  };
  FastestLap?: {
    rank: string;
    lap: string;
    Time: {
      time: string;
    };
    AverageSpeed: {
      units: string;
      speed: string;
    };
  };
}

export interface QualifyingResult {
  number: string;
  position: string;
  Driver: Driver;
  Constructor: Constructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export type RaceWeekendMode = 'pre' | 'post';

export interface RecentGrandPrixResult {
  raceId: number;
  season: number;
  round: number;
  raceName: string;
  circuitId: string;
  date: string | null;
  winnerDriverId: string | null;
  winnerName: string | null;
  winnerConstructorId: string | null;
  winnerConstructorName: string | null;
  poleDriverId: string | null;
  poleName: string | null;
  podium: Array<{
    position: number;
    driverId: string;
    driverName: string;
    constructorId: string | null;
    constructorName: string | null;
  }>;
}

export interface TrackInterruptionProbability {
  type: 'SC' | 'VSC' | 'RED' | 'YELLOW';
  label: string;
  sampleSize: number;
  triggeredCount: number;
  probabilityPct: number | null;
  status: 'ok' | 'insufficient-data';
}

export interface TrackInterruptionSample {
  season: number;
  round: number;
  raceName: string;
  statusTypes: TrackInterruptionProbability['type'][];
  statusLabels: string[];
}

export interface RacePreviewSummary {
  season: number;
  round: number;
  circuitId: string;
  recentResults: RecentGrandPrixResult[];
  interruptionProbabilities: TrackInterruptionProbability[];
  interruptionSamples: TrackInterruptionSample[];
  poleWinConversionPct: number | null;
  sampleSize: number;
}

export interface DriverPostRaceTelemetrySummary {
  driver: string;
  team: string;
  lapNumber: number | null;
  lapTimeSeconds: number | null;
  maxSpeedKph: number | null;
  avgSpeedKph: number | null;
  fullThrottlePct: number | null;
  avgThrottlePct: number | null;
  brakePct: number | null;
  drsPct: number | null;
}

export interface DriverStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Constructor[];
}

export interface ConstructorStanding {
  position: string;
  positionText: string;
  points: string;
  wins: string;
  Constructor: Constructor;
}

export interface Season {
  season: string;
  url: string;
}

export interface ErgastResponse<_T> {
  readonly _responseType?: _T;
  MRData: {
    xmlns: string;
    series: string;
    url: string;
    limit: string;
    offset: string;
    total: string;
    RaceTable?: {
      season?: string;
      round?: string;
      Races: Race[];
    };
    StandingsTable?: {
      season?: string;
      StandingsLists: Array<{
        season: string;
        round: string;
        DriverStandings: DriverStanding[];
        ConstructorStandings: ConstructorStanding[];
      }>;
    };
    SeasonTable?: {
      Seasons: Season[];
    };
    CircuitTable?: {
      Circuits: Circuit[];
    };
    DriverTable?: {
      Drivers: Driver[];
    };
    ConstructorTable?: {
      Constructors: Constructor[];
    };
  };
}

export type SearchEntityType = 'driver' | 'constructor' | 'circuit' | 'race';

export interface SearchIndexEntry {
  type: SearchEntityType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
  keywords: string[];
  score?: number;
}

export interface SearchResultGroup {
  type: SearchEntityType;
  items: SearchIndexEntry[];
}

export interface HistoryCareerSummary {
  raceCount: number;
  poleCount: number;
  winCount: number;
  podiumCount: number;
  championshipCount: number;
  totalPoints: number;
}

export interface DriverSeasonHistoryItem {
  season: string;
  position: string;
  points: number;
  wins: number;
  constructorName: string;
  constructorId: string;
}

export interface ConstructorSeasonHistoryItem {
  season: string;
  position: string;
  points: number;
  wins: number;
}

export interface BestFinishSummary {
  position: string;
  seasons: string[];
}

export interface DriverHistoryProfile {
  driverId: string;
  permanentNumber: string;
  code: string;
  url: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
  recentConstructorName: string;
  recentConstructorId: string;
  careerSummary: HistoryCareerSummary;
  bestRaceFinish: BestFinishSummary | null;
  seasons: DriverSeasonHistoryItem[];
}

export interface ConstructorHistoryProfile {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
  careerSummary: HistoryCareerSummary;
  bestRaceFinish: BestFinishSummary | null;
  seasons: ConstructorSeasonHistoryItem[];
}

export interface DriverHistorySummaryRecord {
  driver_id: string;
  permanent_number: string | null;
  code: string | null;
  url: string | null;
  given_name: string | null;
  family_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  recent_constructor_name: string | null;
  recent_constructor_id: string | null;
  career_summary: unknown;
  best_race_finish: unknown;
  seasons: unknown;
  updated_at?: string | null;
}

export interface ConstructorHistorySummaryRecord {
  constructor_id: string;
  url: string | null;
  name: string | null;
  nationality: string | null;
  career_summary: unknown;
  best_race_finish: unknown;
  seasons: unknown;
  updated_at?: string | null;
}

export interface FastF1LapPoint {
  lapNumber: number;
  lapTimeSeconds: number;
  compound: string;
  stint: number;
  position: number | null;
  freshTyre?: boolean | null;
  tyreLife?: number | null;
  sector1TimeSeconds?: number | null;
  sector2TimeSeconds?: number | null;
  sector3TimeSeconds?: number | null;
}

export interface FastF1DriverLapSeries {
  driver: string;
  team: string;
  racePosition?: number;
  laps: FastF1LapPoint[];
}

export interface FastF1StrategyStint {
  stint: number;
  compound: string;
  startLap: number;
  endLap: number;
  lapCount: number;
  freshTyre?: boolean | null;
  startTyreLife?: number | null;
  endTyreLife?: number | null;
}

export interface FastF1DriverStrategy {
  driver: string;
  team: string;
  racePosition?: number;
  stints: FastF1StrategyStint[];
}

export interface FastF1FastestLap {
  driver: string;
  team: string;
  lapNumber: number;
  lapTimeSeconds: number;
  compound: string;
  position: number | null;
}

export interface FastF1TrackStatusPeriod {
  type: 'YELLOW' | 'SC' | 'VSC' | 'RED';
  label: string;
  message: string;
  rawStatus: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  startLap: number;
  endLap: number;
}

export interface FastF1RaceControlMessage {
  time: string;
  category: string;
  message: string;
  status: string;
  flag: string;
  scope: string;
  sector: number | null;
  lap: number | null;
}

export interface FastF1WeatherPoint {
  timeSeconds: number;
  lapNumber: number | null;
  airTempC: number | null;
  trackTempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  rainfall: boolean;
  windDirectionDeg: number | null;
  windSpeedMps: number | null;
}

export interface FastF1WeatherStatSummary {
  min: number | null;
  max: number | null;
  average: number | null;
}

export interface FastF1WeatherLapRange {
  startLap: number;
  endLap: number;
}

export interface FastF1WeatherSummary {
  airTempC: FastF1WeatherStatSummary;
  trackTempC: FastF1WeatherStatSummary;
  humidityPct: FastF1WeatherStatSummary;
  rainPointCount: number;
  rainLapRanges: FastF1WeatherLapRange[];
  maxWindSpeedMps: number | null;
}

export interface FastF1WeatherAnalysis {
  points: FastF1WeatherPoint[];
  summary: FastF1WeatherSummary;
}

export type FastF1QualifyingSessionType = 'QUALIFYING' | 'SPRINT_QUALIFYING' | 'SPRINT_SHOOTOUT';

export interface FastF1PhaseTime {
  time: string;
  timeSeconds: number | null;
}

export interface FastF1PhaseResult {
  driver: string;
  team: string;
  position: number;
  phases: Record<string, FastF1PhaseTime>;
}

export interface FastF1QualifyingBestLap {
  driver: string;
  team: string;
  position: number;
  lapNumber: number | null;
  lapTimeSeconds: number;
  sector1Seconds: number | null;
  sector2Seconds: number | null;
  sector3Seconds: number | null;
  compound: string;
  isDeleted: boolean;
}

export interface FastF1QualifyingPhaseCutoff {
  phase: string;
  label: string;
  cutoffPosition: number;
  cutoffDriver: string;
  cutoffTime: string;
  cutoffTimeSeconds: number;
  eliminatedDrivers: string[];
}

export interface FastF1QualifyingDeletedLap {
  driver: string;
  team: string;
  lapNumber: number | null;
  lapTimeSeconds: number | null;
  reason: string;
  position: number;
}

export interface FastF1SectorRankingLap {
  rank: number;
  driver: string;
  team: string;
  lapNumber: number | null;
  timeSeconds: number;
  deltaToBestSeconds: number;
  isDeleted: boolean;
}

export interface FastF1SectorRanking {
  sector: 's1' | 's2' | 's3' | string;
  laps: FastF1SectorRankingLap[];
}

export interface FastF1TeamMateComparison {
  team: string;
  driverA: string;
  driverB: string;
  fastestLapDeltaSeconds: number | null;
  sector1DeltaSeconds: number | null;
  sector2DeltaSeconds: number | null;
  sector3DeltaSeconds: number | null;
}

export interface FastF1QualifyingAnalysis {
  sessionType: FastF1QualifyingSessionType;
  phaseResults: FastF1PhaseResult[];
  bestLaps: FastF1QualifyingBestLap[];
  phaseCutoffs?: FastF1QualifyingPhaseCutoff[];
  lastFlyingLaps?: FastF1QualifyingBestLap[];
  deletedLaps?: FastF1QualifyingDeletedLap[];
  sectorRankings?: FastF1SectorRanking[];
  teamMateComparisons?: FastF1TeamMateComparison[];
}

export interface FastF1SessionResult {
  driver: string;
  driverNumber: string;
  driverId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  team: string;
  position: number | null;
  classifiedPosition: string;
  gridPosition: number | null;
  time: string;
  timeSeconds: number | null;
  status: string;
  points: number | null;
  laps: number | null;
}

export interface FastF1TelemetrySamples {
  distanceM: number[];
  timeSeconds: (number | null)[];
  speedKph: (number | null)[];
  rpm: (number | null)[];
  gear: (number | null)[];
  throttlePct: (number | null)[];
  brake: boolean[];
  drs: (number | null)[];
}

export interface FastF1PositionSamples {
  distanceM?: number[];
  x: (number | null)[];
  y: (number | null)[];
  z: (number | null)[];
  speedKph?: (number | null)[];
}

export interface FastF1TelemetryDriver {
  driver: string;
  team: string;
  lapNumber: number | null;
  lapTimeSeconds: number | null;
  compound: string;
  freshTyre?: boolean | null;
  tyreLife?: number | null;
  samples: FastF1TelemetrySamples;
  positionSamples: FastF1PositionSamples;
}

export interface FastF1CircuitCorner {
  number: number;
  letter: string;
  label: string;
  distanceM: number;
  x: number | null;
  y: number | null;
  angleDeg: number | null;
}

export interface FastF1CornerDriverSpeed {
  driver: string;
  entrySpeedKph: number | null;
  minSpeedKph: number | null;
  exitSpeedKph: number | null;
}

export interface FastF1CornerAnalysis {
  corner: string;
  number: number;
  letter: string;
  distanceM: number;
  drivers: FastF1CornerDriverSpeed[];
}

export interface FastF1TelemetryAnalysis {
  drivers: FastF1TelemetryDriver[];
  corners: FastF1CircuitCorner[];
  cornerAnalysis: FastF1CornerAnalysis[];
}

export type FastF1StrategyEventType = 'YELLOW' | 'SC' | 'VSC' | 'RED' | 'RAIN' | 'MESSAGE';

export interface FastF1StrategyEvent {
  type: FastF1StrategyEventType | string;
  label: string;
  message: string;
}

export interface FastF1StrategyEventTimelineItem {
  lapNumber: number;
  events: FastF1StrategyEvent[];
}

export interface FastF1PitContext extends FastF1StrategyEvent {
  lap: number;
}

export interface FastF1PitStop {
  driver: string;
  team: string;
  stopNumber: number;
  pitLap: number;
  outLap: number;
  oldCompound: string;
  newCompound: string;
  pitDurationSeconds: number | null;
  paceBeforeSeconds: number | null;
  paceAfterSeconds: number | null;
  paceDeltaSeconds: number | null;
  positionBefore: number | null;
  positionAfter: number | null;
  positionDelta: number | null;
  contexts: FastF1PitContext[];
}

export interface FastF1StrategyBattle {
  type: 'UNDERCUT' | 'OVERCUT' | string;
  driver: string;
  rival: string;
  startLap: number;
  endLap: number;
  positionDelta: number;
  summary: string;
}

export interface FastF1StrategyStatusRange {
  type: FastF1TrackStatusPeriod['type'] | string;
  label: string;
  startLap: number;
  endLap: number;
}

export interface FastF1StrategyPositionSummary {
  driver: string;
  value: number;
  pitLap: number;
}

export interface FastF1StrategyPaceSummary {
  driver: string;
  valueSeconds: number;
  pitLap: number;
}

export interface FastF1StrategySummary {
  pitStopCount: number;
  statusLapRanges: FastF1StrategyStatusRange[];
  biggestPositionGain: FastF1StrategyPositionSummary | null;
  biggestPositionLoss: FastF1StrategyPositionSummary | null;
  bestPaceGain: FastF1StrategyPaceSummary | null;
}

export interface FastF1StrategyAnalysis {
  pitStops: FastF1PitStop[];
  eventTimeline: FastF1StrategyEventTimelineItem[];
  strategyBattles: FastF1StrategyBattle[];
  summary: FastF1StrategySummary;
}

export interface FastF1RaceAnalytics {
  source: 'fastf1';
  generatedAt: string;
  season: string;
  round: string;
  session: string;
  eventName: string;
  sessionName: string;
  totalLaps?: number;
  fastestLap?: FastF1FastestLap | null;
  sessionResults?: FastF1SessionResult[];
  trackStatusPeriods?: FastF1TrackStatusPeriod[];
  raceControlMessages?: FastF1RaceControlMessage[];
  weather?: FastF1WeatherAnalysis;
  qualifyingAnalysis?: FastF1QualifyingAnalysis;
  telemetry?: FastF1TelemetryAnalysis;
  telemetrySummary?: DriverPostRaceTelemetrySummary[];
  strategyAnalysis?: FastF1StrategyAnalysis;
  lapTimeSeries: FastF1DriverLapSeries[];
  tyreStrategies: FastF1DriverStrategy[];
}

export * from './raceDetail';
export * from './supabaseRows';
export * from './diagnostics';

export interface FastF1TelemetryPayload {
  source: 'fastf1';
  generatedAt: string;
  season: string;
  round: string;
  session: string;
  eventName: string;
  telemetry: FastF1TelemetryAnalysis;
  telemetrySummary?: DriverPostRaceTelemetrySummary[];
}
