import { getSupabaseCircuitId } from './circuitIds';
import {
  normalizeSearchText,
  type DriverSearchSource,
  type SearchSources,
} from './search';

// These source-specific IDs cannot be inferred from names (ATS is also the
// separate 1963 constructor). Keep the database IDs used by profile routes.
const jolpicaConstructorIds: Record<string, string> = { ats: 'ats_wheels' };
const jolpicaDriverIds: Record<string, string> = {
  bira: 'birabongse_bhanudej',
  nelleman: 'jac_nellemann',
};
const jolpicaCircuitIds: Record<string, string> = {
  boavista: 'porto',
  charade: 'clermont_ferrand',
  essarts: 'rouen',
  galvez: 'buenos_aires',
  george: 'east_london',
  lemans: 'bugatti',
  okayama: 'aida',
  tremblant: 'mont_tremblant',
  valencia: 'valencia_street',
};

function driverMatches(
  database: DriverSearchSource, upstream: DriverSearchSource, identity: (value: string) => string,
): boolean {
  if (identity(database.driver_id) === identity(jolpicaDriverIds[upstream.driver_id] || upstream.driver_id)) return true;
  const sameBirthday = Boolean(database.date_of_birth && upstream.date_of_birth
    && database.date_of_birth === upstream.date_of_birth);
  const databaseName = identity(`${database.first_name} ${database.last_name}`);
  const upstreamName = identity(`${upstream.first_name} ${upstream.last_name}`);
  if (database.date_of_birth && upstream.date_of_birth && !sameBirthday) {
    // Some historical birth dates disagree between F1DB and Jolpica. Accept
    // only an exact full name corroborated by the full-name/surname ID scheme.
    return Boolean(databaseName && databaseName === upstreamName
      && identity(database.driver_id) === databaseName
      && databaseName.endsWith(` ${identity(upstream.driver_id)}`));
  }
  if (databaseName && databaseName === upstreamName) return true;
  if (!sameBirthday) return false;

  // Handle expanded given names, nicknames and Jr. suffixes only with a
  // corroborating birth date and surname/ID token, never a reused timing code.
  const surnameTokens = identity(database.last_name).split(' ').filter(token => token.length > 2);
  const upstreamTokens = identity(`${upstream.last_name} ${upstream.driver_id}`).split(' ');
  return surnameTokens.some(token => upstreamTokens.includes(token));
}

interface WithAliases { aliases?: string[] }

function mergeMetadata<T extends WithAliases>(database: T, upstream: T, aliases: string[]): T {
  const merged = { ...upstream, ...database };
  for (const key of Object.keys(upstream) as Array<keyof T>) {
    if (database[key] == null || database[key] === '') merged[key] = upstream[key];
  }
  return {
    ...merged,
    aliases: [...new Set([...(database.aliases || []), ...(upstream.aliases || []), ...aliases].filter(Boolean))],
  };
}

function mergeCatalog<T extends WithAliases>(
  database: T[], upstream: T[], getId: (row: T) => string,
  getName: (row: T) => string, matches: (database: T, upstream: T) => boolean,
  getCandidates: (upstream: T) => T[] = () => database,
): T[] {
  const merged = new Map(database.map(row => [getId(row), row]));
  for (const row of upstream) {
    const candidates = getCandidates(row).filter(primary => matches(primary, row));
    // Ambiguous names must stay separate; selecting the first can route to a
    // different historical person or constructor.
    const primary = candidates.length === 1 ? candidates[0] : undefined;
    const key = getId(primary || row);
    const existing = merged.get(key);
    merged.set(key, existing
      ? mergeMetadata(existing, row, [getId(row), getName(row)])
      : row);
  }
  return [...merged.values()];
}

export function mergeSearchSources(
  supabaseSources: SearchSources | null,
  jolpicaSources: SearchSources | null,
): SearchSources {
  const database = supabaseSources || { drivers: [], constructors: [], circuits: [], races: [] };
  const upstream = jolpicaSources || { drivers: [], constructors: [], circuits: [], races: [] };
  // Each full historical catalogue compares the same names/IDs many times.
  // Normalize once per distinct value instead of repeating Unicode work.
  const normalized = new Map<string, string>();
  const identity = (value: string): string => {
    let result = normalized.get(value);
    if (result === undefined) {
      result = normalizeSearchText(value).replace(/[^a-z0-9]+/g, ' ').trim();
      normalized.set(value, result);
    }
    return result;
  };
  const constructorIds = new Set(database.constructors.map(team => identity(team.constructor_id)));
  const circuitIds = new Set(database.circuits.map(circuit => identity(circuit.circuit_id)));
  const driverKeys = (driver: DriverSearchSource, upstream = false): string[] => [
    `id:${identity((upstream && jolpicaDriverIds[driver.driver_id]) || driver.driver_id)}`,
    `name:${identity(`${driver.first_name} ${driver.last_name}`)}`,
    ...(driver.date_of_birth ? [`birth:${driver.date_of_birth}`] : []),
  ];
  const driversByKey = new Map<string, DriverSearchSource[]>();
  database.drivers.forEach(driver => {
    driverKeys(driver).forEach(key => driversByKey.set(key, [...(driversByKey.get(key) || []), driver]));
  });
  const races = new Map(upstream.races.map(race => [`${race.season}:${race.round}`, race]));
  database.races.forEach(race => races.set(`${race.season}:${race.round}`, race));
  return {
    drivers: mergeCatalog(database.drivers, upstream.drivers,
      driver => driver.driver_id, driver => `${driver.first_name} ${driver.last_name}`,
      (primary, fallback) => driverMatches(primary, fallback, identity),
      driver => [...new Set(driverKeys(driver, true).flatMap(key => driversByKey.get(key) || []))]),
    constructors: mergeCatalog(database.constructors, upstream.constructors,
      team => team.constructor_id, team => team.name, (primary, fallback) => {
        const id = jolpicaConstructorIds[fallback.constructor_id] || fallback.constructor_id;
        if (identity(primary.constructor_id) === identity(id)) return true;
        // An ID match wins over name matching; historical Lotus and ATS share names.
        if (constructorIds.has(identity(id))) return false;
        return Boolean(identity(primary.name) && identity(primary.name) === identity(fallback.name));
      }),
    circuits: mergeCatalog(database.circuits, upstream.circuits,
      circuit => circuit.circuit_id, circuit => circuit.name, (primary, fallback) => {
        const id = jolpicaCircuitIds[fallback.circuit_id] || getSupabaseCircuitId(fallback.circuit_id);
        return identity(primary.circuit_id) === identity(id)
          || (!circuitIds.has(identity(id))
            && Boolean(identity(primary.name) && identity(primary.name) === identity(fallback.name)));
      }),
    races: [...races.values()],
    cacheable: Boolean(supabaseSources && jolpicaSources?.cacheable !== false),
  };
}
