import manifest from './circuit-detailed-maps.json';
import { getSupabaseCircuitId } from '@/utils/circuitIds';

const aliases: Record<string, string> = {
  jeddah_corniche: 'jeddah',
  marina_bay_street: 'marina_bay',
  yas_marina_circuit: 'yas_marina',
  bahrain_international: 'bahrain',
  las_vegas_strip: 'las_vegas',
  okayama: 'aida',
  magnycours: 'magny_cours',
  brands_hatch_circuit: 'brands_hatch',
  donington_park: 'donington',
  canadian_tire_motorsport_park: 'mosport',
  kuala_lumpur: 'sepang',
  boavista: 'porto',
  scandinavian_raceway: 'anderstorp',
};

export function getCircuitDetailedMap(circuitId: string) {
  const canonical = getSupabaseCircuitId(circuitId);
  return manifest.maps.find(map => map.circuitId === (aliases[canonical] || canonical));
}
