import { logger } from '@/utils/logger';

interface PerformanceDetails {
  source: 'supabase' | 'jolpica' | 'fetch';
  name: string;
  status: 'success' | 'error';
  durationMs: number;
}

function getNow() {
  return performance.now();
}

export function recordLoadMetric(name: string, durationMs: number, outcome: 'success' | 'error' | 'retry', details: { attempt?: number; source?: string } = {}): void {
  const duration = Math.max(0, Math.round(durationMs));
  logger.info({ event: 'step', module: 'performance', function: name, durationMs: duration,
    status: outcome === 'error' ? 'failed' : 'success', attempt: details.attempt, input: details.source });
  if (typeof performance.measure === 'function') {
    const key = `f1:${name}`;
    performance.clearMeasures(key);
    performance.measure(key, { start: Math.max(0, performance.now() - duration), duration,
      detail: { outcome } });
  }
  const endpoint = import.meta.env.VITE_PERFORMANCE_ENDPOINT;
  if (endpoint && typeof navigator !== 'undefined' && typeof window !== 'undefined') {
    try {
      const target = new URL(endpoint, window.location.origin);
      if (target.origin === window.location.origin) navigator.sendBeacon?.(target.href,
        JSON.stringify({ name, durationMs: duration, outcome, ...details }));
    } catch { /* Diagnostics must never interrupt page loading. */ }
  }
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
    recordLoadMetric(name, getNow() - startedAt, hasResponseError ? 'error' : 'success', { source });
    return result;
  } catch (error) {
    recordLoadMetric(name, getNow() - startedAt, 'error', { source });
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

export async function initWebVitals() {
  const { onLCP, onINP, onCLS, onFCP, onTTFB } = await import('web-vitals');
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}
