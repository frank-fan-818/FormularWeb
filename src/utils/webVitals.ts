import { logger } from '@/utils/logger';

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
