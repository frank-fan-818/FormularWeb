import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRaceWeather, summarizeWeather } from '../api/_lib/race-weather.mjs';
import { authorizeWeatherMember, createRaceWeatherHandler } from '../api/race-weather.mjs';

const session = { session_key: 11396, year: 2026, session_name: 'Race', country_name: 'United States', location: 'Austin',
  date_start: '2026-10-25T20:00:00Z', date_end: '2026-10-25T22:00:00Z' };
const observation = { session_key: 11396, date: '2026-10-25T20:15:00Z', air_temperature: 27, track_temperature: 36, humidity: 40, rainfall: 0, wind_speed: 2 };
const race = { season: '2026', round: '18', date: '2026-10-25', time: '20:00:00Z', Circuit: { Location: { country: 'USA', locality: 'Austin' } } };

test('weather uses only matching race-session observations inside the session window', () => {
  const result = summarizeWeather([
    observation, { ...observation, date: '2026-10-25T20:16:00Z', air_temperature: 0, track_temperature: 35, humidity: 0, rainfall: 1, wind_speed: 3 },
    { ...observation, date: '2026-10-25T19:59:00Z', track_temperature: 99 },
    { ...observation, date: '2026-10-25T22:01:00Z', track_temperature: 99 },
    { ...observation, session_key: 11392, track_temperature: 99 },
  ], session, Date.parse('2026-10-26T00:00:00Z'));
  assert.deepEqual(result.airTempC, { min: 0, max: 27, average: 13.5 });
  assert.equal(result.trackTempC.max, 36);
  assert.equal(result.humidityPct.min, 0);
  assert.equal(result.rainPointCount, 1);
  assert.equal(result.maxWindSpeedMps, 3);
  assert.deepEqual(result.rainLapRanges, []); // Never invent lap ranges without lap timing.
  assert.equal(summarizeWeather([], session), null);
});

test('latest race weather resolves season, date and venue instead of treating round as session_key', async () => {
  const urls = [];
  const result = await loadRaceWeather('2026', '18', async url => {
    urls.push(url);
    if (url.includes('jolpi')) return { MRData: { RaceTable: { Races: [race] } } };
    if (url.includes('/sessions?')) return [session, { ...session, session_key: 11280, date_start: '2026-05-03T17:00:00Z' }];
    return [observation];
  }, Date.parse('2026-10-26T00:00:00Z'));
  assert.equal(result.sessionKey, 11396);
  assert.equal(result.summary.trackTempC.min, 36);
  assert.ok(urls.at(-1).endsWith('session_key=11396'));
  await assert.rejects(() => loadRaceWeather('2025', '18', async () => ({ MRData: { RaceTable: { Races: [race] } } })), /identity/);
});

test('future and ambiguous race sessions cannot produce weather for the requested race', async () => {
  const read = async url => url.includes('jolpi') ? { MRData: { RaceTable: { Races: [race] } } } : [session, session];
  assert.equal((await loadRaceWeather('2026', '18', read, Date.parse('2026-10-24T00:00:00Z'))).summary, null);
  assert.equal((await loadRaceWeather('2026', '18', read, Date.parse('2026-10-26T00:00:00Z'))).summary, null);
});

test('weather API checks real member identity before accessing sources and never caches a private response publicly', async () => {
  let loads = 0;
  const handler = createRaceWeatherHandler({ authorize: async token => token === 'Bearer valid-member', load: async () => { loads++; return { summary: null }; } });
  for (const [authorization, status] of [[undefined, 401], ['Bearer anonymous', 401], ['Bearer valid-member', 200]]) {
    const headers = {}; let actual;
    await handler({ method: 'GET', url: '/api/race-weather?season=2026&round=18', headers: { authorization } }, {
      setHeader(key, value) { headers[key] = value; }, writeHead(value) { actual = value; }, end() {},
    });
    assert.equal(actual, status);
    assert.equal(headers['Cache-Control'], 'private, no-store');
    assert.equal(headers.Vary, 'Authorization');
  }
  assert.equal(loads, 1);
});

test('weather authorization verifies the token with Supabase and rejects anonymous users', async t => {
  const urls = [];
  const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-public-key' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(String(url));
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return new Response(JSON.stringify({ id: 'member-1', is_anonymous: false }));
  });
  assert.equal(await authorizeWeatherMember('Bearer test-token', env), true);
  assert.deepEqual(urls, ['https://example.supabase.co/auth/v1/user']);
  globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ id: 'anonymous-1', is_anonymous: true })));
  assert.equal(await authorizeWeatherMember('Bearer test-token', env), false);
  globalThis.fetch.mock.mockImplementation(async () => new Response('', { status: 401 }));
  assert.equal(await authorizeWeatherMember('Bearer test-token', env), false);
  assert.equal(await authorizeWeatherMember(undefined, env), false);
});

test('weather API rejects invalid routes/methods before auth and reports upstream failures', async () => {
  let authorizations = 0;
  const handler = createRaceWeatherHandler({ authorize: async () => { authorizations++; return true; }, load: async () => { throw Error('source timeout'); } });
  for (const [method, query, status] of [['POST', 'season=2026&round=18', 405], ['GET', 'season=2022&round=18', 400],
    ['GET', 'season=2026&round=https://evil.test', 400], ['GET', 'season=2026&round=18', 502]]) {
    let actual; let body;
    await handler({ method, url: `/api/race-weather?${query}`, headers: { authorization: 'Bearer valid-member' } }, {
      setHeader() {}, writeHead(value) { actual = value; }, end(value) { body = JSON.parse(value); },
    });
    assert.equal(actual, status);
    assert.equal(typeof body.code, 'string');
    assert.ok(!JSON.stringify(body).includes('source timeout'));
  }
  assert.equal(authorizations, 1);
});
