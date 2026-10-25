const DHL = 'https://inmotion.dhl';
export const DHL_SOURCE = `${DHL}/en/formula-1/fastest-pit-stop-award`;
const ARCHIVE = `${DHL_SOURCE}/overview`;
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1], m[2]]));
const remoteCache = new Map();

export async function readRemote(url, json = true) {
  const parsed = new URL(url);
  if (!['inmotion.dhl', 'api.jolpi.ca', 'api.openf1.org'].includes(parsed.hostname) || parsed.protocol !== 'https:') throw Error('Invalid upstream');
  const saved = remoteCache.get(url);
  if (saved && Date.now() - saved.at < 600_000) return saved.value;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: json ? 'application/json' : 'text/html', 'User-Agent': 'FormularOneWeb (F1 pit stop statistics)' } });
  if (!response.ok) throw Error(`Upstream ${response.status}`);
  if (!(response.headers.get('content-type') || '').includes(json ? 'json' : 'text/html')) throw Error('Unexpected upstream response');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2_000_000) { await reader.cancel(); throw Error('Response too large'); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const value = json ? JSON.parse(body) : body;
  if (remoteCache.size > 150) remoteCache.delete(remoteCache.keys().next().value);
  remoteCache.set(url, { at: Date.now(), value });
  return value;
}

export function discoverDhl(html, currentYear) {
  const result = {}; let year = currentYear;
  const tokens = [...html.matchAll(/<h[12]\b[^>]*>[\s\S]*?<\/h[12]>|<section\b[^>]*>/g)];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^<h/i.test(token[0])) {
      const match = text(token[0]).match(/^(20\d{2})(?:\s+Season(?: Overview)?)?$/i);
      if (match) year = Number(match[1]);
      continue;
    }
    const attrs = attributes(token[0]);
    if (!year || attrs['data-type'] !== 'pit_stop' || !/^\/api\/f1-award-element-data\/\d+$/.test(attrs['data-url'] || '')) continue;
    const statistic = attrs['data-statistic'];
    if (!['event_info', 'season_overview'].includes(statistic)) continue;
    result[year] ??= { events: [] };
    if (statistic === 'season_overview') result[year].overview = attrs['data-url'];
    else {
      result[year].event = attrs['data-url'];
      const nextSection = tokens.slice(i + 1).find(item => item[0].startsWith('<section'));
      const section = html.slice(token.index, nextSection?.index ?? html.length);
      result[year].events = [...section.matchAll(/<input\b[^>]*>\s*<label\b[^>]*>([\s\S]*?)<\/label>/g)].flatMap(match => {
        const id = attributes(match[0].slice(0, match[0].indexOf('>') + 1)).value;
        return /^\d+$/.test(id || '') ? [{ id, label: text(match[1]) }] : [];
      });
    }
  }
  return result;
}

const number = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null;
const seconds = value => { const n = number(value); return n !== null && n > 0 ? String(value) : null; };
const positiveInt = value => { const n = number(value); return Number.isInteger(n) && n > 0 ? n : null; };

function tableRows(html) {
  return [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(match => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell => text(cell[1]))).filter(row => row.length);
}
export function parseStandings(input, officialTable) {
  if (!Array.isArray(input)) throw Error('Invalid standings');
  const seen = new Set();
  const rows = input.map(row => {
    const points = number(row.points);
    if (typeof row.team !== 'string' || !row.team.trim() || points === null || points < 0 || seen.has(row.team)) throw Error('Invalid standing');
    seen.add(row.team);
    return { team: row.team, points };
  }).sort((a, b) => b.points - a.points);
  const published = tableRows(officialTable);
  return rows.map(row => {
    const matches = published.filter(cells => cells.length === 3 && normalize(cells[1]) === normalize(row.team) && Number(cells[2]) === row.points);
    if (officialTable && (matches.length !== 1 || !positiveInt(matches[0][0]))) throw Error('Official standing mismatch');
    return { ...row, rank: matches.length === 1 ? Number(matches[0][0]) : 1 + rows.filter(other => other.points > row.points).length };
  });
}

export function parseAwardStops(input, officialTable) {
  if (!Array.isArray(input)) throw Error('Invalid award records');
  const seen = new Set();
  const rows = input.map(row => {
    const duration = seconds(row.duration); const points = number(row.points);
    if (!duration || !row.team || !row.lastName || row.id == null || seen.has(String(row.id)) || points === null || points < 0) throw Error('Invalid award record');
    seen.add(String(row.id));
    return { id: String(row.id), team: String(row.team), driver: `${row.firstName || ''} ${row.lastName}`.trim(), code: String(row.tla || ''), duration, lap: positiveInt(row.lap), points, irregular: row.irregular === true, notes: typeof row.notes === 'string' ? row.notes : '' };
  }).sort((a,b) => Number(a.duration) - Number(b.duration));
  const published = tableRows(officialTable);
  return rows.map(row => {
    const matches = published.filter(cells => cells.length === 6 && normalize(cells[1]) === normalize(row.team) && normalize(row.driver).endsWith(normalize(cells[2])) && Number(cells[3]) === Number(row.duration) && Number(cells[5]) === row.points);
    if (officialTable && (matches.length !== 1 || !positiveInt(matches[0][0]))) throw Error('Official stop mismatch');
    return { ...row, rank: matches.length === 1 ? Number(matches[0][0]) : 1 + rows.filter(other => Number(other.duration) < Number(row.duration)).length };
  });
}

const VENUES = {
  albert_park: ['Albert Park Grand Prix Circuit'], shanghai: ['Shanghai International Circuit'], suzuka: ['Suzuka Circuit'],
  bahrain: ['Bahrain International Circuit'], jeddah: ['Jeddah Corniche Circuit'], miami: ['Miami International Autodrome'],
  imola: ['Autodromo Enzo e Dino Ferrari'], monaco: ['Circuit de Monaco'], catalunya: ['Circuit de Barcelona-Catalunya'],
  villeneuve: ['Circuit Gilles-Villeneuve'], red_bull_ring: ['Red Bull Ring'], silverstone: ['Silverstone Circuit'],
  spa: ['Circuit de Spa-Francorchamps'], hungaroring: ['Hungaroring'], zandvoort: ['Circuit Zandvoort'],
  monza: ['Autodromo Nazionale Monza'], baku: ['Baku City Circuit'], marina_bay: ['Marina Bay Street Circuit'],
  americas: ['Circuit of The Americas'], rodriguez: ['Autódromo Hermanos Rodríguez'], interlagos: ['Autódromo José Carlos Pace'],
  vegas: ['Las Vegas Strip Circuit', 'Las Vegas Street Circuit'], losail: ['Lusail International Circuit', 'Losail International Circuit'],
  yas_marina: ['Yas Marina Circuit'], sepang: ['Sepang International Circuit'], madring: ['Madring'],
};
export function matchEvent(events, race) {
  const names = [race.Circuit?.circuitName, ...(VENUES[race.Circuit?.circuitId] || [])].filter(Boolean).map(normalize);
  const matches = events.filter(event => names.includes(normalize(event.label)));
  return matches.length === 1 ? matches[0] : null;
}

export async function getPitRecords(season, round, read = readRemote) {
  const rows = []; let total = null;
  for (let page = 0; page < 20; page++) {
    const data = await read(`https://api.jolpi.ca/ergast/f1/${season}/${round}/pitstops.json?limit=100&offset=${rows.length}`);
    const expected = number(data.MRData?.total);
    if (expected === null || expected < 0 || !Number.isInteger(expected) || (total !== null && total !== expected)) throw Error('Invalid pit pagination');
    total = expected;
    const entries = data.MRData?.RaceTable?.Races?.[0]?.PitStops || [];
    if (!Array.isArray(entries) || (!entries.length && rows.length < total)) throw Error('Incomplete pit records');
    for (const row of entries) {
      if (!row.driverId || !positiveInt(row.lap) || !positiveInt(row.stop) || !seconds(row.duration)) throw Error('Invalid pit record');
      rows.push({ driverId: row.driverId, lap: Number(row.lap), stop: Number(row.stop), laneDuration: String(row.duration), laneSource: 'Jolpica' });
    }
    if (rows.length === total) {
      if (new Set(rows.map(row => `${row.driverId}:${row.stop}`)).size !== rows.length) throw Error('Duplicate pit records');
      return rows;
    }
    if (rows.length > total) throw Error('Inconsistent pit pagination');
  }
  throw Error('Pit pagination limit exceeded');
}

export function mergeStops(lane, open) {
  return lane.map(row => {
    const matches = open.filter(item => Number(item.driver_number) === row.driverNumber && Number(item.lap_number) === row.lap);
    const duration = matches.length === 1 ? seconds(matches[0].stop_duration) : null;
    return { ...row, stopDuration: duration, stopSource: duration ? 'OpenF1' : null };
  });
}

export function matchOpenSession(sessions, race, season) {
  const countryAliases = { usa: 'unitedstates', uk: 'unitedkingdom', uae: 'unitedarabemirates' };
  const country = value => countryAliases[normalize(value)] || normalize(value);
  const matches = sessions.filter(item => !item.is_cancelled && item.session_name === 'Race' && Number(item.year) === Number(season)
    && Math.abs(Date.parse(item.date_start) - Date.parse(race.date + 'T12:00:00Z')) < 36*3_600_000
    && (country(item.country_name) === country(race.Circuit?.Location?.country)
      || normalize(item.location) === normalize(race.Circuit?.Location?.locality)));
  return matches.length === 1 ? matches[0] : null;
}

let catalogCache;
async function catalog() {
  if (catalogCache && Date.now() - catalogCache.at < 3_600_000) return catalogCache.value;
  const current = await readRemote(DHL_SOURCE, false);
  const year = Number(text(current.match(/<h2[^>]*>\s*20\d{2} Season\s*<\/h2>/)?.[0]).match(/20\d{2}/)?.[0]);
  if (!year) throw Error('Missing DHL season');
  const historical = await readRemote(ARCHIVE, false);
  const all = { ...discoverDhl(historical), ...discoverDhl(current, year) };
  const value = Object.fromEntries(Object.entries(all).filter(([, entry]) => entry.overview && entry.event));
  if (!Object.keys(value).length) throw Error('Missing DHL components');
  catalogCache = { at: Date.now(), value };
  return value;
}

async function raceDetails(season, round) {
  const data = await readRemote(`https://api.jolpi.ca/ergast/f1/${season}/${round}/results.json?limit=100`);
  const race = data.MRData?.RaceTable?.Races?.[0];
  if (!race || String(race.season) !== season || String(race.round) !== round) return null;
  return race;
}

export async function loadPitData(kind, season, round) {
  const updatedAt = new Date().toISOString();
  if (kind === 'award') {
    const all = await catalog();
    const seasons = Object.keys(all).map(Number).sort((a,b) => b-a);
    const entry = all[season];
    const base = { season, seasons, source: DHL_SOURCE, updatedAt, stale: false };
    if (!entry) return { ...base, standings: [], stops: [], unavailable: true };
    if (!round) {
      const raw = await readRemote(`${DHL}${entry.overview}`);
      return { ...base, standings: parseStandings(raw.data?.chart?.standings, raw.htmlList?.table), stops: [] };
    }
    const race = await raceDetails(season, round);
    const event = race && matchEvent(entry.events, race);
    if (!event) return { ...base, standings: [], stops: [], unavailable: true };
    const raw = await readRemote(`${DHL}${entry.event}?event=${event.id}`);
    if (String(raw.data?.event_id) !== event.id) throw Error('DHL event mismatch');
    return { ...base, standings: [], stops: parseAwardStops(raw.data?.chart, raw.htmlList?.table), event: event.label };
  }
  const race = await raceDetails(season, round);
  if (!race) return { season, records: [], updatedAt, stale: false };
  const drivers = race.Results || [];
  const lane = (await getPitRecords(season, round)).map(row => {
    const result = drivers.find(item => item.Driver?.driverId === row.driverId);
    return { ...row, driverNumber: Number(result?.number || result?.Driver?.permanentNumber), driver: result ? `${result.Driver.givenName} ${result.Driver.familyName}` : row.driverId, code: result?.Driver?.code || '', team: result?.Constructor?.name || '', constructorId: result?.Constructor?.constructorId || '' };
  });
  let open = []; let partial = false;
  if (Number(season) >= 2024 && lane.length) {
    try {
      const sessions = await readRemote(`https://api.openf1.org/v1/sessions?year=${season}&session_name=Race`);
      if (!Array.isArray(sessions)) throw Error('Invalid sessions');
      const session = matchOpenSession(sessions, race, season);
      if (!session || !positiveInt(session.session_key)) throw Error('Ambiguous session');
      open = await readRemote(`https://api.openf1.org/v1/pit?session_key=${session.session_key}`);
      if (!Array.isArray(open) || open.some(item => !item || !positiveInt(item.driver_number) || !positiveInt(item.lap_number))) throw Error('Invalid pit data');
    } catch { open = []; partial = true; }
  }
  return { season, records: mergeStops(lane, open).sort((a,b) => a.lap-b.lap || a.stop-b.stop), updatedAt, stale: false, partial };
}
