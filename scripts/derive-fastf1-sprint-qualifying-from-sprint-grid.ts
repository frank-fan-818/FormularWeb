import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface FastF1SessionResult {
  driver?: string;
  driverNumber?: string;
  driverId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  team?: string;
  position?: number;
  classifiedPosition?: string;
  gridPosition?: number;
}

interface FastF1Payload {
  source?: string;
  generatedAt?: string;
  season?: string;
  round?: string;
  session?: string;
  eventName?: string;
  sessionName?: string;
  sessionResults?: FastF1SessionResult[];
}

const sprintWeekends = [
  [2021, 10], [2021, 14], [2021, 19],
  [2022, 4], [2022, 11], [2022, 21],
  [2023, 4], [2023, 9], [2023, 12], [2023, 17], [2023, 18], [2023, 20],
  [2024, 5], [2024, 6], [2024, 11], [2024, 19], [2024, 21], [2024, 23],
  [2025, 2], [2025, 6], [2025, 13], [2025, 19], [2025, 21], [2025, 23],
] as const;

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function hasUsableResults(filePath: string): Promise<boolean> {
  const payload = await readJson<FastF1Payload>(filePath);
  return Boolean(payload?.sessionResults?.length);
}

async function deriveOne(outputRoot: string, season: number, round: number) {
  const directory = path.join(outputRoot, String(season), String(round));
  const sprintPath = path.join(directory, 'S.json');
  const sprintQualifyingPath = path.join(directory, 'SQ.json');
  const sprintShootoutPath = path.join(directory, 'SS.json');

  if (await hasUsableResults(sprintQualifyingPath) || await hasUsableResults(sprintShootoutPath)) {
    return null;
  }

  const sprintPayload = await readJson<FastF1Payload>(sprintPath);
  const sprintResults = sprintPayload?.sessionResults || [];
  const gridResults = sprintResults
    .filter((result) => Number.isFinite(result.gridPosition) && Number(result.gridPosition) > 0)
    .map((result) => ({
      ...result,
      position: Number(result.gridPosition),
      classifiedPosition: String(result.gridPosition),
      points: 0,
      laps: undefined,
      status: '',
      time: '',
      timeSeconds: undefined,
    }))
    .sort((first, second) => Number(first.position) - Number(second.position));

  if (!sprintPayload || gridResults.length === 0) {
    return null;
  }

  const payload = {
    ...sprintPayload,
    generatedAt: new Date().toISOString(),
    session: 'SQ',
    sessionName: 'Sprint Qualifying',
    totalLaps: 0,
    fastestLap: null,
    trackStatusPeriods: [],
    raceControlMessages: [],
    lapTimeSeries: [],
    tyreStrategies: [],
    weather: undefined,
    qualifying: {
      sessionType: 'SPRINT_QUALIFYING',
      phaseResults: [],
      phaseCutoffs: {},
      bestLaps: [],
      lastFlyingLaps: [],
      deletedLaps: [],
      sectorRankings: [],
      teamMateComparisons: [],
    },
    sessionResults: gridResults,
  };

  await mkdir(directory, { recursive: true });
  await writeFile(sprintQualifyingPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return sprintQualifyingPath;
}

async function main() {
  const outputRoot = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : 'public/fastf1';

  const written: string[] = [];
  for (const [season, round] of sprintWeekends) {
    const filePath = await deriveOne(outputRoot, season, round);
    if (filePath) {
      written.push(filePath);
    }
  }

  console.log(`Derived ${written.length} sprint qualifying file(s).`);
  for (const filePath of written) {
    console.log(`- ${filePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
