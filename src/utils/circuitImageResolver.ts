import { getSupabaseCircuitId, normalizeCircuitId } from './circuitIds';

export type CircuitImageStyle = 'black-outline' | 'white-outline' | 'black' | 'white';

const preferredAssetKeys = [
  'adelaide',
  'aida',
  'ain-diab',
  'aintree',
  'anderstorp',
  'austin',
  'avus',
  'bahrain',
  'baku',
  'brands-hatch',
  'bremgarten',
  'buddh',
  'buenos-aires',
  'bugatti',
  'caesars-palace',
  'catalunya',
  'clermont-ferrand',
  'dallas',
  'detroit',
  'dijon',
  'donington',
  'east-london',
  'estoril',
  'fuji',
  'hockenheimring',
  'hungaroring',
  'imola',
  'indianapolis',
  'interlagos',
  'istanbul',
  'jacarepagua',
  'jarama',
  'jeddah',
  'jerez',
  'kyalami',
  'las-vegas',
  'long-beach',
  'lusail',
  'madring',
  'magny-cours',
  'marina-bay',
  'melbourne',
  'mexico-city',
  'miami',
  'monaco',
  'monsanto',
  'mont-tremblant',
  'montjuic',
  'montreal',
  'monza',
  'mosport',
  'mugello',
  'nivelles',
  'nurburgring',
  'paul-ricard',
  'pedralbes',
  'pescara',
  'phoenix',
  'portimao',
  'porto',
  'reims',
  'riverside',
  'rouen',
  'sebring',
  'sepang',
  'shanghai',
  'silverstone',
  'sochi',
  'spa-francorchamps',
  'spielberg',
  'suzuka',
  'valencia',
  'watkins-glen',
  'yas-marina',
  'yeongam',
  'zandvoort',
  'zeltweg',
  'zolder',
] as const;

const circuitKeyAliases: Record<string, string> = {
  'albert-park': 'melbourne',
  'bahrain-international': 'bahrain',
  'circuit-of-the-americas': 'austin',
  cota: 'austin',
  'jeddah-corniche': 'jeddah',
  'las-vegas-strip': 'las-vegas',
  losail: 'lusail',
  'marina-bay-street': 'marina-bay',
  'mexico-city': 'mexico-city',
  'monaco-circuit': 'monaco',
  'red-bull-ring': 'spielberg',
  ricard: 'paul-ricard',
  rodriguez: 'mexico-city',
  spa: 'spa-francorchamps',
  'spa-francorchamps': 'spa-francorchamps',
  villeneuve: 'montreal',
  vegas: 'las-vegas',
  'yas-marina-circuit': 'yas-marina',
};

const blackOutlineCircuitModules = import.meta.glob('../assets/circuits/black-outline/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

function toAssetKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function buildStyleMap(_style: CircuitImageStyle) {
  return Object.fromEntries(
    preferredAssetKeys.flatMap((key) => {
      const assetPath = `../assets/circuits/black-outline/${key}-1.svg`;
      const assetUrl = blackOutlineCircuitModules[assetPath];

      return assetUrl ? [[key, assetUrl]] : [];
    }),
  );
}

const circuitImageMap: Record<CircuitImageStyle, Record<string, string>> = {
  'black-outline': buildStyleMap('black-outline'),
  'white-outline': buildStyleMap('white-outline'),
  black: buildStyleMap('black'),
  white: buildStyleMap('white'),
};

function buildCircuitKeyCandidates(circuitId: string): string[] {
  const normalizedOriginal = toAssetKey(normalizeCircuitId(circuitId));
  const normalizedSupabase = toAssetKey(getSupabaseCircuitId(circuitId));
  const candidates = [
    normalizedSupabase,
    normalizedOriginal,
    circuitKeyAliases[normalizedSupabase],
    circuitKeyAliases[normalizedOriginal],
  ].filter(Boolean) as string[];

  return [...new Set(candidates)];
}

export function getCircuitImageUrl(
  circuitId: string,
  style: CircuitImageStyle = 'black-outline',
): string {
  const candidates = buildCircuitKeyCandidates(circuitId);

  for (const key of candidates) {
    const matchedUrl = circuitImageMap[style][key];
    if (matchedUrl) {
      return matchedUrl;
    }
  }

  return '';
}

export function resolveCircuitImageUrl(
  circuitId: string,
  style: CircuitImageStyle = 'black-outline',
): Promise<string> {
  return Promise.resolve(getCircuitImageUrl(circuitId, style));
}
