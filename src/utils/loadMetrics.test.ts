import { afterEach, expect, it, vi } from 'vitest';
import { recordLoadMetric } from './performance';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); performance.clearMeasures(); });
it('retains one latest browser timing per metric instead of growing indefinitely', () => {
  recordLoadMetric('news_first_content', 10, 'success');
  recordLoadMetric('news_first_content', 20, 'success');
  const entries = performance.getEntriesByName('f1:news_first_content');
  expect(entries).toHaveLength(1);
  expect(entries[0].duration).toBe(20);
});
it('only sends optional metrics to a configured same-origin collector', () => {
  vi.stubGlobal('window', { location: { origin: 'https://f1.test' } });
  const sendBeacon = vi.fn(); vi.stubGlobal('navigator', { sendBeacon });
  vi.stubEnv('VITE_PERFORMANCE_ENDPOINT', 'https://other.test/metrics');
  recordLoadMetric('classification_results', 100, 'success');
  expect(sendBeacon).not.toHaveBeenCalled();
  vi.stubEnv('VITE_PERFORMANCE_ENDPOINT', '/metrics');
  recordLoadMetric('classification_results', 100, 'success');
  expect(sendBeacon).toHaveBeenCalledTimes(1);
});
