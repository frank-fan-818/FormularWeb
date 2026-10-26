import { matchOpenSession, readRemote } from './pit-stops.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const range = values => values.length ? { min: Math.min(...values), max: Math.max(...values), average: values.reduce((a, b) => a + b, 0) / values.length }
  : { min: null, max: null, average: null };

export function summarizeWeather(rows, session, now = Date.now()) {
  if (!Array.isArray(rows)) throw Error('Invalid weather observations');
  const start = Date.parse(session.date_start); const end = Math.min(Date.parse(session.date_end), now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const points = rows.filter(row => row && Number(row.session_key) === Number(session.session_key)
    && Date.parse(row.date) >= start && Date.parse(row.date) <= end
    && (row.rainfall === 0 || row.rainfall === 1));
  const values = key => points.map(row => row[key]).filter(finite);
  const air = values('air_temperature'); const track = values('track_temperature');
  if (!air.length && !track.length) return null;
  const wind = values('wind_speed').filter(value => value >= 0);
  return { airTempC: range(air), trackTempC: range(track), humidityPct: range(values('humidity').filter(value => value >= 0 && value <= 100)),
    rainPointCount: points.filter(row => row.rainfall === 1).length, rainLapRanges: [], maxWindSpeedMps: wind.length ? Math.max(...wind) : null };
}

export async function loadRaceWeather(season, round, read = readRemote, now = Date.now()) {
  const base = { season, round, source: 'openf1', updatedAt: new Date(now).toISOString(), sessionKey: null, summary: null };
  const metadata = await read(`https://api.jolpi.ca/ergast/f1/${season}/${round}.json?limit=1`);
  const race = metadata.MRData?.RaceTable?.Races?.[0];
  if (!race) return base;
  if (String(race.season) !== season || String(race.round) !== round) throw Error('Race identity mismatch');
  const start = Date.parse(`${race.date}T${race.time || '00:00:00Z'}`);
  if (!Number.isFinite(start) || start > now) return base;
  const sessions = await read(`https://api.openf1.org/v1/sessions?year=${season}&session_name=Race`);
  if (!Array.isArray(sessions)) throw Error('Invalid weather sessions');
  const session = matchOpenSession(sessions, race, season);
  if (!session || !Number.isInteger(session.session_key) || session.session_key <= 0) return base;
  const rows = await read(`https://api.openf1.org/v1/weather?session_key=${session.session_key}`);
  return { ...base, sessionKey: session.session_key, summary: summarizeWeather(rows, session, now) };
}
