import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface FastF1Payload {
  season?: string;
  round?: string;
  session?: string;
  eventName?: string;
  sessionResults?: unknown[];
  lapTimeSeries?: unknown[];
  fastestLap?: unknown;
}

const sprintWeekends = [
  [2021, 10], [2021, 14], [2021, 19],
  [2022, 4], [2022, 11], [2022, 21],
  [2023, 4], [2023, 9], [2023, 12], [2023, 17], [2023, 18], [2023, 20],
  [2024, 5], [2024, 6], [2024, 11], [2024, 19], [2024, 21], [2024, 23],
  [2025, 2], [2025, 6], [2025, 13], [2025, 19], [2025, 21], [2025, 23],
] as const;

async function readJson(filePath: string): Promise<FastF1Payload | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as FastF1Payload;
  } catch {
    return null;
  }
}

async function main() {
  const outputRoot = process.argv.includes('--input')
    ? process.argv[process.argv.indexOf('--input') + 1]
    : 'public/fastf1';

  const rows = [];
  for (const [season, round] of sprintWeekends) {
    const filePath = path.join(outputRoot, String(season), String(round), 'S.json');
    const payload = await readJson(filePath);
    rows.push({
      season,
      round,
      event: payload?.eventName || '',
      results: payload?.sessionResults?.length || 0,
      lapSeries: payload?.lapTimeSeries?.length || 0,
      fastestLap: payload?.fastestLap ? 'yes' : 'no',
    });
  }

  const withLaps = rows.filter((row) => row.lapSeries > 0);
  console.table(rows);
  console.log(`Sprint sessions with lap timing: ${withLaps.length}/${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
