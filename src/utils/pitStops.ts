import type { PitRecord } from '@/types/pitStops';

export function filterPitRecords(records: PitRecord[], driver: string, team: string, sort: string): PitRecord[] {
  return records.filter(row => (!driver || row.driverId === driver) && (!team || row.constructorId === team)).sort((a,b) => {
    if (sort === 'stop' || sort === 'lane') {
      const av = sort === 'stop' ? a.stopDuration : a.laneDuration;
      const bv = sort === 'stop' ? b.stopDuration : b.laneDuration;
      if (av === null && bv !== null) return 1;
      if (bv === null && av !== null) return -1;
      const delta = Number(av) - Number(bv);
      if (delta) return delta;
    }
    return a.lap - b.lap || a.stop - b.stop || a.driverId.localeCompare(b.driverId);
  });
}
