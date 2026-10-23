import { describe, expect, it, vi } from 'vitest';

const vitals = vi.hoisted(() => ({
  loaded: vi.fn(),
  onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn(), onFCP: vi.fn(), onTTFB: vi.fn(),
}));

vi.mock('web-vitals', () => {
  vitals.loaded();
  return vitals;
});

import { measureRequest } from './performance';
import { initWebVitals } from './webVitals';

describe('optional performance monitoring', () => {
  it('loads Web Vitals only when monitoring starts, preserving normal request results', async () => {
    expect(vitals.loaded).not.toHaveBeenCalled();
    const response = { data: ['race'] };
    await expect(measureRequest('fetch', 'season', async () => response)).resolves.toBe(response);
    expect(vitals.loaded).not.toHaveBeenCalled();

    await initWebVitals();
    expect(vitals.loaded).toHaveBeenCalledOnce();
    for (const register of [vitals.onCLS, vitals.onINP, vitals.onLCP, vitals.onFCP, vitals.onTTFB]) {
      expect(register).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
    }
  });
});
