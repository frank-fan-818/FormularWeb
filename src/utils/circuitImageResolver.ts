import { getSupabaseCircuitId } from './circuitIds';

export type CircuitImageStyle = 'black-outline' | 'white-outline' | 'black' | 'white';

const circuitNameMap: Record<string, string> = {
  albert_park: 'melbourne',
  bahrain: 'bahrain',
  jeddah_corniche: 'jeddah',
  suzuka: 'suzuka',
  shanghai: 'shanghai',
  miami: 'miami',
  imola: 'imola',
  monaco: 'monaco',
  catalunya: 'catalunya',
  villeneuve: 'montreal',
  red_bull_ring: 'spielberg',
  silverstone: 'silverstone',
  hungaroring: 'hungaroring',
  spa: 'spa-francorchamps',
  spa_francorchamps: 'spa-francorchamps',
  zandvoort: 'zandvoort',
  monza: 'monza',
  baku: 'baku',
  marina_bay: 'marina-bay',
  austin: 'austin',
  rodriguez: 'mexico-city',
  interlagos: 'interlagos',
  las_vegas: 'las-vegas',
  losail: 'lusail',
  yas_marina: 'yas-marina',
  sepang: 'sepang',
  yeongam: 'yeongam',
  buddh: 'buddh',
  magny_cours: 'magny-cours',
  paul_ricard: 'paul-ricard',
  estoril: 'estoril',
  istanbul_park: 'istanbul',
  valencia_street: 'valencia',
  nurburgring: 'nurburgring',
  hockenheim: 'hockenheimring',
  indianapolis: 'indianapolis',
  watkins_glen: 'watkins-glen',
  long_beach: 'long-beach',
  adelaide: 'adelaide',
  brands_hatch: 'brands-hatch',
  donington: 'donington',
  kyalami: 'kyalami',
  mugello: 'mugello',
  portimao: 'portimao',
  sochi: 'sochi',
  zolder: 'zolder',
  zeltweg: 'zeltweg',
};

const circuitImageModules = import.meta.glob('../assets/circuits/*/*.svg', {
  query: '?url',
  import: 'default',
});

function buildCircuitIdCandidates(circuitId: string): string[] {
  const normalizedId = getSupabaseCircuitId(circuitId);
  const mappedId = circuitNameMap[normalizedId] || circuitNameMap[circuitId] || normalizedId || circuitId;

  const candidates = [
    mappedId.replace(/_/g, '-'),
    mappedId,
    normalizedId.replace(/_/g, '-'),
    normalizedId,
    circuitId.replace(/_/g, '-'),
    circuitId,
    mappedId.replace('circuit', ''),
    mappedId.replace('_circuit', ''),
    mappedId.split('_')[0],
    circuitId.split('_')[circuitId.split('_').length - 1],
    normalizedId === 'las_vegas' ? 'las-vegas-strip' : '',
    normalizedId === 'austin' ? 'circuit-of-the-americas' : '',
  ].filter(Boolean);

  return [...new Set(candidates)];
}

export async function resolveCircuitImageUrl(
  circuitId: string,
  style: CircuitImageStyle = 'black-outline',
): Promise<string> {
  const versions = ['-1', '-2', '-3', '-4', ''];
  const candidates = buildCircuitIdCandidates(circuitId);

  for (const id of candidates) {
    for (const version of versions) {
      const key = `../assets/circuits/${style}/${id}${version}.svg`;
      const loader = circuitImageModules[key];

      if (!loader) {
        continue;
      }

      const resolvedUrl = await loader();
      return typeof resolvedUrl === 'string' ? resolvedUrl : '';
    }
  }

  return '';
}
