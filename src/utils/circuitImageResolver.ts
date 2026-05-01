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

const blackOutlineCircuitUrlModules = import.meta.glob('../assets/circuits/black-outline/*.svg', {
  import: 'default',
  query: '?url',
}) as Record<string, () => Promise<string>>;

const blackOutlineCircuitRawModules = import.meta.glob('../assets/circuits/black-outline/*.svg', {
  import: 'default',
  query: '?raw',
}) as Record<string, () => Promise<string>>;

function toAssetKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function buildStyleMap<T>(modules: Record<string, T>) {
  return Object.fromEntries(
    preferredAssetKeys.flatMap((key) => {
      const assetPath = `../assets/circuits/black-outline/${key}-1.svg`;
      const asset = modules[assetPath];

      return asset ? [[key, asset]] : [];
    }),
  );
}

const circuitImageUrlLoaderMap: Record<CircuitImageStyle, Record<string, () => Promise<string>>> = {
  'black-outline': buildStyleMap(blackOutlineCircuitUrlModules),
  'white-outline': buildStyleMap(blackOutlineCircuitUrlModules),
  black: buildStyleMap(blackOutlineCircuitUrlModules),
  white: buildStyleMap(blackOutlineCircuitUrlModules),
};

const circuitImageRawLoaderMap: Record<CircuitImageStyle, Record<string, () => Promise<string>>> = {
  'black-outline': buildStyleMap(blackOutlineCircuitRawModules),
  'white-outline': buildStyleMap(blackOutlineCircuitRawModules),
  black: buildStyleMap(blackOutlineCircuitRawModules),
  white: buildStyleMap(blackOutlineCircuitRawModules),
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

function findCircuitAssetLoader(
  circuitId: string,
  style: CircuitImageStyle,
  loaderMap: Record<CircuitImageStyle, Record<string, () => Promise<string>>>,
): (() => Promise<string>) | null {
  const candidates = buildCircuitKeyCandidates(circuitId);

  for (const key of candidates) {
    const matchedLoader = loaderMap[style][key];
    if (matchedLoader) {
      return matchedLoader;
    }
  }

  return null;
}

export function getCircuitImageUrl(
  _circuitId: string,
  _style: CircuitImageStyle = 'black-outline',
): string {
  return '';
}

export function resolveCircuitImageUrl(
  circuitId: string,
  style: CircuitImageStyle = 'black-outline',
): Promise<string> {
  const loader = findCircuitAssetLoader(circuitId, style, circuitImageUrlLoaderMap);
  return loader ? loader() : Promise.resolve('');
}

export function resolveCircuitImageSvg(
  circuitId: string,
  style: CircuitImageStyle = 'black-outline',
): Promise<string> {
  const loader = findCircuitAssetLoader(circuitId, style, circuitImageRawLoaderMap);
  return loader ? loader() : Promise.resolve('');
}
