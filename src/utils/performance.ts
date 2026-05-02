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
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') {
    return request();
  }

  const startedAt = getNow();

  try {
    const result = await request();
    const hasResponseError = typeof result === 'object'
      && result !== null
      && 'error' in result
      && Boolean((result as { error?: unknown }).error);
    console.debug('[perf]', {
      source,
      name,
      status: hasResponseError ? 'error' : 'success',
      durationMs: Math.round(getNow() - startedAt),
    } satisfies PerformanceDetails);
    return result;
  } catch (error) {
    console.debug('[perf]', {
      source,
      name,
      status: 'error',
      durationMs: Math.round(getNow() - startedAt),
    } satisfies PerformanceDetails);
    throw error;
  }
}
