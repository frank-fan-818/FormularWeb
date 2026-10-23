import { describe, expect, it } from 'vitest';
import { parseCircuitSvg } from './circuitSvg';

describe('circuit SVG geometry', () => {
  it('preserves a supplied viewBox including a nonzero origin', () => {
    expect(parseCircuitSvg('<svg viewBox="-10 20 600 400"><path d="M10 20L30 40" /></svg>'))
      .toEqual({ viewBox: '-10 20 600 400', path: 'M10 20L30 40' });
  });
  it('supports the bundled dimension-based SVG assets and strips pixel units', () => {
    expect(parseCircuitSvg("<svg width='500px' height='400px'><path d='M1 2L3 4' /></svg>"))
      .toEqual({ viewBox: '0 0 500 400', path: 'M1 2L3 4' });
  });
  it('returns no diagram when the asset has no route path', () => {
    expect(parseCircuitSvg('<svg><text>Unavailable</text></svg>')).toBeNull();
  });
});
