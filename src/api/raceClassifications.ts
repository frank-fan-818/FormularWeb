import type { ErgastResponse, Race } from '@/types';
import { withRetry } from '@/utils/withRetry';
import { measureRequest, recordLoadMetric } from '@/utils/performance';
import { validateOrWarn } from '@/api/validation';
import { RaceSchema } from '@/api/schemas';
import { assertCompleteList, assertUniqueValues } from '@/utils/dataCompleteness';

export async function getCompleteRaceEndpoint(
  season: string,
  round: string,
  endpoint: string,
  listKey: 'Results' | 'QualifyingResults' | 'SprintResults',
  parentSignal?: AbortSignal,
): Promise<Race | null> {
  const response = await measureRequest('jolpica', `classification_${endpoint}`, () => withRetry(
    async signal => {
      const response = await fetch(`/f1-api/${season}/${round}/${endpoint}.json?limit=100`, { signal });
      if (!response.ok) throw Object.assign(new Error(`Race request failed (${response.status})`), { status: response.status, retryAfterMs: Number(response.headers.get('retry-after')) * 1000 });
      return response.json() as Promise<ErgastResponse<never>>;
    },
    { signal: parentSignal, timeoutMs: 4000, maxRetries: 1, totalTimeoutMs: 10_000, onRetry: attempt => recordLoadMetric('race_retry', 0, 'retry', { attempt }) },
  ));
  const race = response.MRData.RaceTable?.Races[0] || null;
  if (!race) return null;
  const entries = (race[listKey] || []) as Array<{ Driver: { driverId: string } }>;
  assertUniqueValues(
    assertCompleteList(entries, response.MRData.total, `Jolpica ${endpoint} results`),
    (entry) => entry.Driver.driverId,
    `Jolpica ${endpoint} results`,
  );
  return validateOrWarn(RaceSchema, race, `race-${season}-${round}-${endpoint}`) as Race;
}

export const seasonApi = {
 getRaceResults: (season: string, round: string, signal?: AbortSignal) => getCompleteRaceEndpoint(season, round, 'results', 'Results', signal),
 getQualifyingResults: (season: string, round: string, signal?: AbortSignal) => getCompleteRaceEndpoint(season, round, 'qualifying', 'QualifyingResults', signal),
};
