import { z } from 'zod';

export const DriverSchema = z.object({
  driverId: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  code: z.string().optional(),
  permanentNumber: z.string().optional(),
  nationality: z.string().optional(),
  url: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export const ConstructorSchema = z.object({
  constructorId: z.string(),
  name: z.string(),
  nationality: z.string().optional(),
  url: z.string().optional(),
});

export const ResultSchema = z.object({
  number: z.string().optional(),
  position: z.string(),
  positionText: z.string(),
  points: z.string(),
  grid: z.string(),
  laps: z.string(),
  status: z.string(),
  Time: z.object({
    millis: z.string().optional(),
    time: z.string(),
  }).optional(),
  FastestLap: z.object({
    rank: z.string(),
    lap: z.string(),
    Time: z.object({ time: z.string() }),
    AverageSpeed: z.object({
      units: z.string(),
      speed: z.string(),
    }).optional(),
  }).optional(),
  Driver: DriverSchema,
  Constructor: ConstructorSchema,
});

export const QualifyingResultSchema = z.object({
  number: z.string().optional(),
  position: z.string(),
  Driver: DriverSchema,
  Constructor: ConstructorSchema,
  Q1: z.string().optional(),
  Q2: z.string().optional(),
  Q3: z.string().optional(),
});

export const CircuitSchema = z.object({
  circuitId: z.string(),
  circuitName: z.string(),
  url: z.string().optional(),
  Location: z.object({
    country: z.string(),
    locality: z.string(),
    lat: z.string(),
    long: z.string(),
  }),
});

const SessionScheduleSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
});

export const RaceSchema = z.object({
  season: z.string(),
  round: z.string(),
  raceName: z.string(),
  url: z.string().optional(),
  date: z.string(),
  time: z.string().optional(),
  Circuit: CircuitSchema,
  Results: z.array(ResultSchema).optional(),
  QualifyingResults: z.array(QualifyingResultSchema).optional(),
  SprintResults: z.array(ResultSchema).optional(),
  FirstPractice: SessionScheduleSchema.optional(),
  SecondPractice: SessionScheduleSchema.optional(),
  ThirdPractice: SessionScheduleSchema.optional(),
  Qualifying: SessionScheduleSchema.optional(),
  Sprint: SessionScheduleSchema.optional(),
  SprintQualifying: SessionScheduleSchema.optional(),
  isSprintWeekend: z.boolean().optional(),
});

export type ValidatedRace = z.infer<typeof RaceSchema>;

// Imported classifications do not contain complete schedule/circuit metadata.
export const RaceSessionClassificationSchema = RaceSchema.pick({
  season: true, round: true, Results: true, QualifyingResults: true, SprintResults: true,
});

export const RaceTableSchema = z.object({
  season: z.string().optional(),
  round: z.string().optional(),
  Races: z.array(RaceSchema),
});

export const MRDataSchema = z.object({
  RaceTable: RaceTableSchema,
});

export const QualifyingMRDataSchema = z.object({
  RaceTable: z.object({
    Races: z.array(z.object({
      QualifyingResults: z.array(QualifyingResultSchema).optional(),
    })),
  }),
});

export const FastF1AnalyticsEnvelopeSchema = z.object({
  source: z.literal('fastf1'),
  generatedAt: z.string().min(1),
  season: z.string().min(1),
  round: z.string().min(1),
  session: z.string().min(1),
  eventName: z.string(),
  sessionName: z.string(),
  lapTimeSeries: z.array(z.unknown()),
  tyreStrategies: z.array(z.unknown()),
}).passthrough();

export const FastF1TelemetryEnvelopeSchema = z.object({
  source: z.literal('fastf1'),
  generatedAt: z.string().min(1),
  season: z.string().min(1),
  round: z.string().min(1),
  session: z.string().min(1),
  eventName: z.string(),
  telemetry: z.object({}).passthrough(),
}).passthrough();
