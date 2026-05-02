const circuitIdAliases: Record<string, string> = {
  albert_park: 'melbourne',
  melbourne: 'melbourne',
  red_bull_ring: 'spielberg',
  spielberg: 'spielberg',
  spa: 'spa_francorchamps',
  spa_francorchamps: 'spa_francorchamps',
  villeneuve: 'montreal',
  montreal: 'montreal',
  rodriguez: 'mexico_city',
  mexico_city: 'mexico_city',
  monaco_circuit: 'monaco',
  monaco: 'monaco',
  losail: 'lusail',
  lusail: 'lusail',
  vegas: 'las_vegas',
  las_vegas: 'las_vegas',
  americas: 'austin',
  austin: 'austin',
  cota: 'austin',
  circuit_of_the_americas: 'austin',
  paul_ricard: 'paul_ricard',
  ricard: 'paul_ricard',
};

export function normalizeCircuitId(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

export function getSupabaseCircuitId(value: string | null | undefined): string {
  const normalizedId = normalizeCircuitId(value);
  return circuitIdAliases[normalizedId] || normalizedId;
}

export function getCircuitIdCandidates(value: string | null | undefined): string[] {
  const normalizedId = normalizeCircuitId(value);
  const canonicalId = getSupabaseCircuitId(normalizedId);
  const aliases = Object.entries(circuitIdAliases)
    .filter(([, target]) => target === canonicalId)
    .map(([alias]) => alias);

  return [...new Set([normalizedId, canonicalId, ...aliases].filter(Boolean))];
}

export function areCircuitIdsEquivalent(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return getSupabaseCircuitId(left) === getSupabaseCircuitId(right);
}
