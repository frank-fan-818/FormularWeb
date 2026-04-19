import type { SearchEntityType, SearchIndexEntry, SearchResultGroup } from '@/types';

interface DriverSearchSource {
  driver_id: string;
  first_name: string;
  last_name: string;
  code?: string | null;
  nationality?: string | null;
}

interface ConstructorSearchSource {
  constructor_id: string;
  name: string;
  nationality?: string | null;
}

interface CircuitSearchSource {
  circuit_id: string;
  name: string;
  locality?: string | null;
  location?: string | null;
  country?: string | null;
}

interface SearchableEntry {
  entry: SearchIndexEntry;
  primaryKeywords: string[];
  aliasKeywords: string[];
}

const RESULT_LIMIT_PER_GROUP = 5;

const constructorAliases: Record<string, string[]> = {
  'mercedes': ['mercedes amg', 'mercedes-amg', 'silver arrows'],
  'red_bull': ['red bull racing', 'redbull', 'rb'],
  'ferrari': ['scuderia ferrari', 'scuderia'],
  'mclaren': ['mclaren f1 team'],
  'aston_martin': ['aston martin aramco', 'aston martin f1'],
  'alpine': ['alpine f1 team', 'renault'],
  'williams': ['williams racing'],
  'haas': ['haas f1 team'],
  'sauber': ['kick sauber', 'alfa romeo', 'stake', 'stake f1'],
  'rb': ['racing bulls', 'visa cash app rb', 'alphatauri', 'alpha tauri', 'toro rosso'],
};

const circuitAliases: Record<string, string[]> = {
  'americas': ['cota', 'circuit of the americas', 'austin'],
  'austin': ['cota', 'circuit of the americas'],
  'spa': ['spa francorchamps', 'spa-francorchamps'],
  'spa_francorchamps': ['spa', 'spa francorchamps', 'spa-francorchamps'],
  'silverstone': ['silverstone circuit'],
  'monza': ['autodromo nazionale monza'],
  'interlagos': ['sao paulo', 'sao paulo gp', 'autodromo jose carlos pace'],
  'villeneuve': ['montreal', 'gilles villeneuve'],
  'montreal': ['villeneuve', 'gilles villeneuve'],
  'rodriguez': ['mexico city', 'mexico city gp', 'hermanos rodriguez'],
  'yas_marina': ['yas marina', 'abu dhabi'],
  'losail': ['lusail', 'qatar'],
  'lusail': ['losail', 'qatar'],
  'albert_park': ['melbourne', 'albert park'],
  'red_bull_ring': ['spielberg', 'austria'],
  'marina_bay': ['singapore', 'marina bay'],
  'imola': ['autodromo enzo e dino ferrari'],
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueNormalized(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => normalizeSearchText(value ?? '')).filter(Boolean))];
}

function buildDriverEntry(driver: DriverSearchSource): SearchableEntry {
  const title = `${driver.first_name} ${driver.last_name}`.trim();
  const code = driver.code?.trim();
  const subtitle = [driver.nationality, code ? code.toUpperCase() : null].filter(Boolean).join(' · ');

  return {
    entry: {
      type: 'driver',
      id: driver.driver_id,
      title,
      subtitle,
      route: `/history/drivers/${driver.driver_id}`,
      keywords: uniqueNormalized([title, driver.first_name, driver.last_name, driver.driver_id, code]),
    },
    primaryKeywords: uniqueNormalized([title, driver.first_name, driver.last_name, driver.driver_id, code]),
    aliasKeywords: [],
  };
}

function buildConstructorEntry(constructor: ConstructorSearchSource): SearchableEntry {
  const aliases = constructorAliases[constructor.constructor_id] || [];

  return {
    entry: {
      type: 'constructor',
      id: constructor.constructor_id,
      title: constructor.name,
      subtitle: constructor.nationality || '',
      route: `/history/constructors/${constructor.constructor_id}`,
      keywords: uniqueNormalized([constructor.name, constructor.constructor_id, ...aliases]),
    },
    primaryKeywords: uniqueNormalized([constructor.name, constructor.constructor_id]),
    aliasKeywords: uniqueNormalized(aliases),
  };
}

function buildCircuitEntry(circuit: CircuitSearchSource): SearchableEntry {
  const aliases = circuitAliases[circuit.circuit_id] || [];
  const locality = circuit.locality || circuit.location || '';
  const subtitle = [locality, circuit.country].filter(Boolean).join(', ');

  return {
    entry: {
      type: 'circuit',
      id: circuit.circuit_id,
      title: circuit.name,
      subtitle,
      route: `/circuits/${circuit.circuit_id}`,
      keywords: uniqueNormalized([
        circuit.name,
        circuit.circuit_id,
        circuit.locality,
        circuit.location,
        circuit.country,
        ...aliases,
      ]),
    },
    primaryKeywords: uniqueNormalized([
      circuit.name,
      circuit.circuit_id,
      circuit.locality,
      circuit.location,
      circuit.country,
    ]),
    aliasKeywords: uniqueNormalized(aliases),
  };
}

export function buildSearchIndex(params: {
  drivers: DriverSearchSource[];
  constructors: ConstructorSearchSource[];
  circuits: CircuitSearchSource[];
}): SearchableEntry[] {
  return [
    ...params.drivers.map(buildDriverEntry),
    ...params.constructors.map(buildConstructorEntry),
    ...params.circuits.map(buildCircuitEntry),
  ];
}

function getPrimaryKeywordScore(keyword: string, query: string): number {
  if (!keyword || !query) {
    return 0;
  }

  if (keyword === query) {
    return 1200;
  }

  if (keyword.startsWith(query)) {
    return 1000 - Math.max(keyword.length - query.length, 0);
  }

  const words = keyword.split(' ');
  if (words.some((word) => word.startsWith(query))) {
    return 800 - keyword.indexOf(query);
  }

  if (keyword.includes(query)) {
    return 600 - keyword.indexOf(query);
  }

  return 0;
}

function getAliasKeywordScore(keyword: string, query: string): number {
  if (!keyword || !query) {
    return 0;
  }

  if (keyword === query) {
    return 500;
  }

  if (keyword.startsWith(query)) {
    return 450 - Math.max(keyword.length - query.length, 0);
  }

  const words = keyword.split(' ');
  if (words.some((word) => word.startsWith(query))) {
    return 350 - keyword.indexOf(query);
  }

  if (keyword.includes(query)) {
    return 250 - keyword.indexOf(query);
  }

  return 0;
}

function scoreEntry(entry: SearchableEntry, query: string): number {
  const primaryScore = entry.primaryKeywords.reduce((bestScore, keyword) => {
    return Math.max(bestScore, getPrimaryKeywordScore(keyword, query));
  }, 0);

  const aliasScore = entry.aliasKeywords.reduce((bestScore, keyword) => {
    return Math.max(bestScore, getAliasKeywordScore(keyword, query));
  }, 0);

  return Math.max(primaryScore, aliasScore);
}

const groupLabels: Record<SearchEntityType, string> = {
  driver: 'Drivers 车手',
  constructor: 'Constructors 车队',
  circuit: 'Circuits 赛道',
};

export function searchIndex(entries: SearchableEntry[], rawQuery: string): SearchResultGroup[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) {
    return [];
  }

  const matches = entries
    .map((entry) => ({
      ...entry.entry,
      score: scoreEntry(entry, query),
    }))
    .filter((entry) => (entry.score || 0) > 0)
    .sort((left, right) => {
      const scoreDiff = (right.score || 0) - (left.score || 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const titleDiff = left.title.localeCompare(right.title, 'en');
      if (titleDiff !== 0) {
        return titleDiff;
      }

      return left.id.localeCompare(right.id, 'en');
    });

  const grouped = new Map<SearchEntityType, SearchIndexEntry[]>();

  matches.forEach((match) => {
    const group = grouped.get(match.type) || [];
    if (group.length < RESULT_LIMIT_PER_GROUP) {
      group.push(match);
      grouped.set(match.type, group);
    }
  });

  return (['driver', 'constructor', 'circuit'] as SearchEntityType[])
    .map((type) => {
      const items = grouped.get(type) || [];
      return {
        type,
        label: groupLabels[type],
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}
