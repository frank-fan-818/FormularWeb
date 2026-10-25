import { describe, expect, it } from 'vitest';
import { filterPitRecords } from './pitStops';
import type { PitRecord } from '@/types/pitStops';

const base: PitRecord = { driverId: 'a', driver: 'A', code: 'AAA', team: 'Ferrari', constructorId: 'ferrari', lap: 20, stop: 1, laneDuration: '24.12', stopDuration: null, laneSource: 'Jolpica', stopSource: null };
describe('pit record filtering and independent timing sort', () => {
  const rows = [base, { ...base, driverId: 'b', lap: 10, laneDuration: '26.2', stopDuration: '2.1' }, { ...base, driverId: 'c', lap: 12, constructorId: 'mclaren', stopDuration: '3.2' }];
  it('sorts null static times last without replacing them with lane timing', () => {
    expect(filterPitRecords(rows, '', '', 'stop').map(row => row.driverId)).toEqual(['b','c','a']);
    expect(filterPitRecords(rows, '', '', 'lane')[0].driverId).toBe('c');
    expect(rows[0].stopDuration).toBeNull();
  });
  it('combines driver and team filters without mutating input', () => {
    expect(filterPitRecords(rows, 'c', 'ferrari', 'lap')).toEqual([]);
    expect(filterPitRecords(rows, '', 'ferrari', 'lap').map(row => row.driverId)).toEqual(['b','a']);
    expect(rows[0]).toBe(base);
  });
});
