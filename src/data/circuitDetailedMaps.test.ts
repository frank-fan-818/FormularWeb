import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from './circuit-detailed-maps.json';
import { getCircuitDetailedMap } from './circuitDetailedMaps';

describe('detailed circuit map coverage', () => {
  const circuits = ['melbourne', 'shanghai', 'suzuka', 'bahrain', 'jeddah', 'miami', 'montreal', 'monaco',
    'catalunya', 'spielberg', 'silverstone', 'spa_francorchamps', 'hungaroring', 'zandvoort', 'monza',
    'madring', 'baku', 'marina_bay', 'austin', 'mexico_city', 'interlagos', 'las_vegas', 'lusail', 'yas_marina', 'imola',
    'paul_ricard', 'portimao', 'sochi', 'istanbul', 'mugello', 'hockenheimring', 'nurburgring',
    'sepang', 'buddh', 'yeongam', 'brands_hatch', 'donington', 'magny_cours', 'aida', 'porto',
    'bugatti', 'estoril', 'mosport', 'sebring', 'watkins_glen', 'fuji', 'jerez', 'kyalami', 'dijon', 'anderstorp'];
  it.each(circuits)('%s has a verified local detailed map and official provenance', circuitId => {
    const map = getCircuitDetailedMap(circuitId);
    expect(map).toBeDefined();
    if (!map) throw new Error(`Missing map: ${circuitId}`);
    expect(new URL(map.sourcePage).protocol).toBe('https:');
    expect(new URL(map.sourceUrl).protocol).toBe('https:');
    expect(map.width).toBeGreaterThanOrEqual(800);
    expect(map.publisher).toBeTruthy();
    expect(map.layout).toBeTruthy();
    const bytes = readFileSync(resolve('public', map.asset.slice(1)));
    if (map.asset.endsWith('.webp')) expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    else if (map.asset.endsWith('.png')) expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    else expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
    expect(bytes.length).toBe(map.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(map.sha256);
  });
  it.each([['albert_park', 'melbourne'], ['spa', 'spa_francorchamps'], ['villeneuve', 'montreal'],
    ['rodriguez', 'mexico_city'], ['losail', 'lusail'], ['jeddah-corniche', 'jeddah'], ['vegas', 'las_vegas'],
    ['americas', 'austin'], ['red_bull_ring', 'spielberg'], ['yas-marina-circuit', 'yas_marina'],
    ['okayama', 'aida'], ['magnycours', 'magny_cours'], ['brands-hatch', 'brands_hatch'],
    ['donington-park', 'donington'], ['canadian-tire-motorsport-park', 'mosport'],
    ['kuala-lumpur', 'sepang'], ['boavista', 'porto'], ['scandinavian-raceway', 'anderstorp']])('resolves %s to %s', (alias, canonical) => {
    expect(getCircuitDetailedMap(alias)).toBe(getCircuitDetailedMap(canonical));
  });
  it('keeps Sepang and Sakhir distinct despite the reused official 2026 page slug', () => {
    expect(getCircuitDetailedMap('sepang')?.asset).toContain('sepang');
    expect(getCircuitDetailedMap('bahrain')?.asset).toContain('bahrain');
    expect(getCircuitDetailedMap('sepang')).not.toBe(getCircuitDetailedMap('bahrain'));
  });
  it('does not invent annotations for unsupported circuits or duplicate entries', () => {
    expect(getCircuitDetailedMap('adelaide')).toBeUndefined();
    expect(getCircuitDetailedMap('unknown')).toBeUndefined();
    expect(new Set(manifest.maps.map(map => map.circuitId)).size).toBe(manifest.maps.length);
  });
});
