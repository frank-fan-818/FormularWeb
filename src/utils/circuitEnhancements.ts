export interface CircuitEnhancement {
  leftTurns?: number;
  rightTurns?: number;
  elevationChangeM?: number;
  direction?: 'CLOCKWISE' | 'ANTI_CLOCKWISE' | 'COUNTER_CLOCKWISE';
}

const CIRCUIT_ENHANCEMENTS: Record<string, CircuitEnhancement> = {
  albert_park: { leftTurns: 9, rightTurns: 5, elevationChangeM: 2, direction: 'CLOCKWISE' },
  austin: { leftTurns: 11, rightTurns: 9, elevationChangeM: 41, direction: 'ANTI_CLOCKWISE' },
  bahrain: { leftTurns: 6, rightTurns: 9, elevationChangeM: 18, direction: 'CLOCKWISE' },
  baku: { leftTurns: 8, rightTurns: 12, elevationChangeM: 26, direction: 'ANTI_CLOCKWISE' },
  catalunya: { leftTurns: 8, rightTurns: 6, elevationChangeM: 30, direction: 'CLOCKWISE' },
  hungaroring: { leftTurns: 6, rightTurns: 8, elevationChangeM: 36, direction: 'CLOCKWISE' },
  imola: { leftTurns: 9, rightTurns: 12, elevationChangeM: 30, direction: 'ANTI_CLOCKWISE' },
  interlagos: { leftTurns: 10, rightTurns: 5, elevationChangeM: 43, direction: 'ANTI_CLOCKWISE' },
  jeddah: { leftTurns: 16, rightTurns: 11, elevationChangeM: 0, direction: 'ANTI_CLOCKWISE' },
  las_vegas: { leftTurns: 7, rightTurns: 10, elevationChangeM: 2, direction: 'ANTI_CLOCKWISE' },
  lusail: { leftTurns: 6, rightTurns: 10, elevationChangeM: 8, direction: 'CLOCKWISE' },
  marina_bay: { leftTurns: 12, rightTurns: 7, elevationChangeM: 3, direction: 'ANTI_CLOCKWISE' },
  melbourne: { leftTurns: 9, rightTurns: 5, elevationChangeM: 2, direction: 'CLOCKWISE' },
  mexico_city: { leftTurns: 7, rightTurns: 10, elevationChangeM: 2, direction: 'CLOCKWISE' },
  miami: { leftTurns: 8, rightTurns: 11, elevationChangeM: 2, direction: 'ANTI_CLOCKWISE' },
  monaco: { leftTurns: 7, rightTurns: 12, elevationChangeM: 42, direction: 'CLOCKWISE' },
  monza: { leftTurns: 4, rightTurns: 7, elevationChangeM: 13, direction: 'CLOCKWISE' },
  montreal: { leftTurns: 6, rightTurns: 8, elevationChangeM: 5, direction: 'CLOCKWISE' },
  red_bull_ring: { leftTurns: 3, rightTurns: 7, elevationChangeM: 63, direction: 'CLOCKWISE' },
  shanghai: { leftTurns: 7, rightTurns: 9, elevationChangeM: 11, direction: 'CLOCKWISE' },
  silverstone: { leftTurns: 8, rightTurns: 10, elevationChangeM: 11, direction: 'CLOCKWISE' },
  spa: { leftTurns: 9, rightTurns: 10, elevationChangeM: 102, direction: 'CLOCKWISE' },
  spa_francorchamps: { leftTurns: 9, rightTurns: 10, elevationChangeM: 102, direction: 'CLOCKWISE' },
  suzuka: { leftTurns: 10, rightTurns: 8, elevationChangeM: 40, direction: 'CLOCKWISE' },
  suzuka_circuit: { leftTurns: 10, rightTurns: 8, elevationChangeM: 40, direction: 'CLOCKWISE' },
  valencia_street: { leftTurns: 11, rightTurns: 14, elevationChangeM: 0, direction: 'CLOCKWISE' },
  yas_marina: { leftTurns: 7, rightTurns: 9, elevationChangeM: 11, direction: 'COUNTER_CLOCKWISE' },
  zandvoort: { leftTurns: 4, rightTurns: 10, elevationChangeM: 8, direction: 'CLOCKWISE' },
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
  const normalized = String(direction || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'CLOCKWISE' || normalized === 'CW') {
    return '\u987a\u65f6\u9488';
  }

  if (
    normalized === 'ANTI_CLOCKWISE'
    || normalized === 'ANTICLOCKWISE'
    || normalized === 'COUNTER_CLOCKWISE'
    || normalized === 'COUNTERCLOCKWISE'
    || normalized === 'CCW'
  ) {
    return '\u9006\u65f6\u9488';
  }

  return '\u8d44\u6599\u5f85\u8865';
}
