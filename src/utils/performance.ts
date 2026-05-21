import { logger } from '@/utils/logger';

interface PerformanceDetails {
  source: 'supabase' | 'jolpica' | 'fetch';
  name: string;
  status: 'success' | 'error';
  durationMs: number;
}

function getNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export async function measureRequest<T>(
  source: PerformanceDetails['source'],
  name: string,
  request: () => Promise<T>,
): Promise<T> {
  if (import.meta.env.MODE === 'test') {
    return request();
  }

  const startedAt = getNow();

  try {
    const result = await request();
    const hasResponseError = typeof result === 'object'
      && result !== null
      && 'error' in result
      && Boolean((result as { error?: unknown }).error);
    logger.debug({
      event: 'step',
      module: source,
      function: name,
      status: hasResponseError ? 'failed' : 'success',
      durationMs: Math.round(getNow() - startedAt),
    });
    return result;
  } catch (error) {
    logger.debug({
      event: 'step',
      module: source,
      function: name,
      status: 'failed',
      durationMs: Math.round(getNow() - startedAt),
    });
    throw error;
  }
}
