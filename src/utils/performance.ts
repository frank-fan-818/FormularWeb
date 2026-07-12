import { logger } from '@/utils/logger';
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';

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

// Report Web Vitals (LCP, INP, CLS, FCP, TTFB) to analytics
function sendToAnalytics(metric: { name: string; value: number; rating: string }) {
  const body = {
    name: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
  };
  const endpoint = import.meta.env.VITE_PERFORMANCE_ENDPOINT;
  if (endpoint && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(endpoint, JSON.stringify(body));
    return;
  }
  logger.debug({
    event: 'step',
    module: 'performance',
    function: 'webVitals',
    status: metric.rating === 'poor' ? 'failed' : 'success',
    ...body,
  });
}

export function initWebVitals() {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
