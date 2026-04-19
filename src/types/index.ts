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

export type SearchEntityType = 'driver' | 'constructor' | 'circuit';

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
  label: string;
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
  seasons: DriverSeasonHistoryItem[];
}

export interface ConstructorHistoryProfile {
  constructorId: string;
  url: string;
  name: string;
  nationality: string;
  careerSummary: HistoryCareerSummary;
  seasons: ConstructorSeasonHistoryItem[];
}
