const circuitIdAliases: Record<string, string> = {
  albert_park: 'melbourne',
  red_bull_ring: 'spielberg',
  spa: 'spa_francorchamps',
  villeneuve: 'montreal',
  rodriguez: 'mexico_city',
  monaco_circuit: 'monaco',
  losail: 'lusail',
  vegas: 'las_vegas',
  americas: 'austin',
  cota: 'austin',
  circuit_of_the_americas: 'austin',
  ricard: 'paul_ricard',
  buddha: 'buddh',
  valencia_street: 'valencia',
  boavista: 'porto',
  charade: 'clermont_ferrand',
  essarts: 'rouen',
  galvez: 'buenos_aires',
  george: 'east_london',
  lemans: 'bugatti',
  okayama: 'aida',
  tremblant: 'mont_tremblant',
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
