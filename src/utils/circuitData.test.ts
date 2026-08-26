import { describe, expect, it } from 'vitest';
import { getCircuitDetails, getCircuitDetailsSync } from '@/utils/circuitData';

describe('circuitData', () => {
  it('returns atlas-ready metadata synchronously for circuit aliases', () => {
    expect(getCircuitDetailsSync('albert_park')).toMatchObject({
      firstRace: 1996,
      raceLaps: 58,
      length: '5.278',
    });
  });

  it('keeps the asynchronous detail API compatible', async () => {
    await expect(getCircuitDetails('melbourne')).resolves.toEqual(
      getCircuitDetailsSync('melbourne'),
    );
  });

  it('returns null for circuits without a local fallback', () => {
    expect(getCircuitDetailsSync('unknown_circuit')).toBeNull();
  });
});
