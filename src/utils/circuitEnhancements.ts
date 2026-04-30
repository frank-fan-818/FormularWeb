export interface CircuitEnhancement {
  leftTurns?: number;
  rightTurns?: number;
  elevationChangeM?: number;
}

const CIRCUIT_ENHANCEMENTS: Record<string, CircuitEnhancement> = {
  austin: { leftTurns: 11, rightTurns: 9, elevationChangeM: 41 },
  bahrain: { leftTurns: 6, rightTurns: 9, elevationChangeM: 18 },
  baku: { leftTurns: 8, rightTurns: 12, elevationChangeM: 26 },
  catalunya: { leftTurns: 8, rightTurns: 6, elevationChangeM: 30 },
  hungaroring: { leftTurns: 6, rightTurns: 8, elevationChangeM: 36 },
  imola: { leftTurns: 9, rightTurns: 12, elevationChangeM: 30 },
  interlagos: { leftTurns: 10, rightTurns: 5, elevationChangeM: 43 },
  jeddah: { leftTurns: 16, rightTurns: 11, elevationChangeM: 0 },
  las_vegas: { leftTurns: 7, rightTurns: 10, elevationChangeM: 2 },
  lusail: { leftTurns: 6, rightTurns: 10, elevationChangeM: 8 },
  marina_bay: { leftTurns: 12, rightTurns: 7, elevationChangeM: 3 },
  melbourne: { leftTurns: 9, rightTurns: 5, elevationChangeM: 2 },
  mexico_city: { leftTurns: 7, rightTurns: 10, elevationChangeM: 2 },
  miami: { leftTurns: 8, rightTurns: 11, elevationChangeM: 2 },
  monaco: { leftTurns: 7, rightTurns: 12, elevationChangeM: 42 },
  monza: { leftTurns: 4, rightTurns: 7, elevationChangeM: 13 },
  montreal: { leftTurns: 6, rightTurns: 8, elevationChangeM: 5 },
  red_bull_ring: { leftTurns: 3, rightTurns: 7, elevationChangeM: 63 },
  shanghai: { leftTurns: 7, rightTurns: 9, elevationChangeM: 11 },
  silverstone: { leftTurns: 8, rightTurns: 10, elevationChangeM: 11 },
  spa: { leftTurns: 9, rightTurns: 10, elevationChangeM: 102 },
  spa_francorchamps: { leftTurns: 9, rightTurns: 10, elevationChangeM: 102 },
  suzuka: { leftTurns: 10, rightTurns: 8, elevationChangeM: 40 },
  yas_marina: { leftTurns: 7, rightTurns: 9, elevationChangeM: 11 },
  zandvoort: { leftTurns: 4, rightTurns: 10, elevationChangeM: 8 },
};

function normalizeCircuitId(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

export function getCircuitEnhancement(circuitId: string | null | undefined): CircuitEnhancement {
  return CIRCUIT_ENHANCEMENTS[normalizeCircuitId(circuitId)] || {};
}

export function formatCircuitDirection(direction: string | null | undefined): string {
  const normalized = String(direction || '').toUpperCase();

  if (normalized === 'CLOCKWISE') {
    return '顺时针';
  }

  if (normalized === 'ANTI_CLOCKWISE' || normalized === 'COUNTER_CLOCKWISE') {
    return '逆时针';
  }

  return '未知';
}
