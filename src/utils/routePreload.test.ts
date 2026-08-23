import { describe, expect, it } from 'vitest';
import { canPreloadRoutes, getRoutePreloadKeys } from './routePreload';

describe('route preload policy', () => {
  it('maps direct and nested routes to the smallest useful module set', () => {
    expect(getRoutePreloadKeys('/seasons')).toEqual(['seasons']);
    expect(getRoutePreloadKeys('/drivers/max_verstappen')).toEqual(['driverDetail']);
    expect(getRoutePreloadKeys('/races/7')).toEqual(['raceLayout', 'raceResults']);
    expect(getRoutePreloadKeys('/races/7/info')).toEqual(['raceLayout', 'raceInfo']);
    expect(getRoutePreloadKeys('/races/7/race')).toEqual(['raceLayout', 'raceAnalysis']);
  });

  it('does not prefetch the eager home route and uses not-found only for unknown paths', () => {
    expect(getRoutePreloadKeys('/')).toEqual([]);
    expect(getRoutePreloadKeys('/definitely-unknown')).toEqual(['notFound']);
  });

  it('respects explicit data-saving and constrained network signals', () => {
    expect(canPreloadRoutes(undefined)).toBe(true);
    expect(canPreloadRoutes({ saveData: true })).toBe(false);
    expect(canPreloadRoutes({ effectiveType: '2g' })).toBe(false);
    expect(canPreloadRoutes({ effectiveType: 'slow-2g' })).toBe(false);
    expect(canPreloadRoutes({ effectiveType: '4g' })).toBe(true);
  });
});
