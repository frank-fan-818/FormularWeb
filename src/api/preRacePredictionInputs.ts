import type { PredictionPreRaceObservation } from '@/types/predictionData';
import { normalizeConstructorId } from '@/utils/teamColors';

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown) => typeof value === 'string' ? value : '';
const identity = (value: unknown) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const id = (value: unknown) => text(value).replace(/_/g, '-');

export async function fetchPreRacePredictionObservation(target: { season: number; raceStartAt: string; expectedFieldSize?: number }, options: {
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>; clock?: () => number;
} = {}): Promise<{ reason: string; observation?: PredictionPreRaceObservation }> {
  const fetcher = options.fetcher || fetch;
  const clock = options.clock || Date.now;
  const start = Date.parse(target.raceStartAt);
  if (!Number.isFinite(start) || clock() >= start) return { reason: 'race-started' };
  const read = async (url: string) => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error(`Pre-race provider HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  };
  try {
    const sessionsUrl = new URL('https://api.openf1.org/v1/sessions');
    sessionsUrl.searchParams.set('year', String(target.season));
    sessionsUrl.searchParams.set('session_type', 'Race');
    sessionsUrl.searchParams.set('date_start>=', new Date(start - 6 * 3600_000).toISOString());
    sessionsUrl.searchParams.set('date_start<=', new Date(start + 6 * 3600_000).toISOString());
    const sessions = rows(await read(sessionsUrl.href)).filter((row) => row.session_type === 'Race' && row.session_name === 'Race' &&
      Math.abs(Date.parse(text(row.date_start)) - start) <= 6 * 3600_000 && Number.isInteger(Number(row.session_key)));
    if (sessions.length !== 1) return { reason: 'no-session' };
    const sessionKey = Number(sessions[0].session_key);
    const [driverData, constructorData, entryData, gridData] = await Promise.all([
      read(`https://api.jolpi.ca/ergast/f1/${target.season}/drivers.json?limit=100`),
      read(`https://api.jolpi.ca/ergast/f1/${target.season}/constructors.json?limit=100`),
      read(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
      read(`https://api.openf1.org/v1/starting_grid?session_key=${sessionKey}`).catch(() => []),
    ]);
    const driverMr = record(record(driverData).MRData);
    const constructorMr = record(record(constructorData).MRData);
    const drivers = rows(record(driverMr.DriverTable).Drivers);
    const constructors = rows(record(constructorMr.ConstructorTable).Constructors);
    if (Number(driverMr.total) !== drivers.length || Number(constructorMr.total) !== constructors.length) return { reason: 'partial-directory' };
    const entries = rows(entryData);
    const grids = rows(gridData);
    if (entries.length < 15 || (target.expectedFieldSize && entries.length !== target.expectedFieldSize) ||
      new Set(entries.map((row) => row.driver_number)).size !== entries.length) return { reason: 'incomplete-field' };
    const positiveGridPositions = grids.filter((row) => Number(row.position) > 0).map((row) => row.position);
    const completeGrid = grids.length === entries.length && grids.every((row) => entries.some((entry) => entry.driver_number === row.driver_number) &&
      Number.isInteger(row.position) && Number(row.position) >= 0 && Number(row.position) <= entries.length) &&
      new Set(positiveGridPositions).size === positiveGridPositions.length;
    const mapped: PredictionPreRaceObservation['entries'] = [];
    for (const entry of entries) {
      let matches = drivers.filter((driver) => entry.name_acronym && driver.code === entry.name_acronym);
      if (!matches.length) matches = drivers.filter((driver) => Number(driver.permanentNumber) === Number(entry.driver_number));
      if (!matches.length && entry.first_name && entry.last_name) matches = drivers.filter((driver) =>
        identity(`${text(driver.givenName)} ${text(driver.familyName)}`) === identity(`${text(entry.first_name)} ${text(entry.last_name)}`));
      const team = identity(entry.team_name);
      if (team.length < 3) return { reason: 'unmapped-field' };
      const constructorAlias = identity(normalizeConstructorId(text(entry.team_name)));
      let teams = constructors.filter((constructor) => identity(constructor.name) === team || identity(constructor.constructorId) === team || identity(constructor.constructorId) === constructorAlias);
      if (!teams.length) teams = constructors.filter((constructor) => {
        const name = identity(constructor.name);
        return name.length >= 4 && (team.startsWith(name) || name.startsWith(team));
      });
      if (matches.length !== 1 || teams.length !== 1 || !id(matches[0].driverId) || !id(teams[0].constructorId)) return { reason: 'unmapped-field' };
      const grid = completeGrid ? grids.find((row) => row.driver_number === entry.driver_number) : undefined;
      mapped.push({ driverId: id(matches[0].driverId), constructorId: id(teams[0].constructorId), ...(grid ? { gridPosition: Number(grid.position) } : {}) });
    }
    if (new Set(mapped.map((row) => row.driverId)).size !== mapped.length || clock() >= start) return { reason: 'unmapped-field' };
    return { reason: 'confirmed', observation: { observedAt: new Date(clock()).toISOString(), source: `https://api.openf1.org/v1/drivers?session_key=${sessionKey}`, entries: mapped } };
  } catch {
    return { reason: 'provider-unavailable' };
  }
}
