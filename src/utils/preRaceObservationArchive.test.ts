import { describe, expect, it } from 'vitest';
import { appendPreRaceObservation } from './preRaceObservationArchive';

describe('pre-race observation availability archive', () => {
  it('preserves the first observed timestamp for an unchanged field', () => {
    const first = { observedAt: '2026-10-18T00:00:00Z', source: 'provider', entries: [{ driverId: 'a', constructorId: 'x' }] };
    const next = { ...first, observedAt: '2026-10-18T01:00:00Z' };
    expect(appendPreRaceObservation([first], next)).toEqual([first]);
    const grid = { ...next, entries: [{ ...first.entries[0], gridPosition: 2 }] };
    expect(appendPreRaceObservation([first], grid)).toEqual([first, grid]);
  });

  it('keeps a confirmed grid when the same field temporarily loses grid data', () => {
    const first = { observedAt: '2026-10-18T00:00:00Z', source: 'provider', entries: [{ driverId: 'a', constructorId: 'x', gridPosition: 2 }] };
    const missingGrid = { ...first, observedAt: '2026-10-18T01:00:00Z', entries: [{ driverId: 'a', constructorId: 'x' }] };
    expect(appendPreRaceObservation([first], missingGrid)).toEqual([first]);
  });
});
