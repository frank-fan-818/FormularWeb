import { loadRaceWeather } from './_lib/race-weather.mjs';

export async function authorizeWeatherMember(authorization, env = process.env) {
  if (typeof authorization !== 'string' || !/^Bearer \S+$/.test(authorization)) return false;
  const origin = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const apiKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!origin || !apiKey) throw Error('Weather authentication unavailable');
  const response = await fetch(new URL('/auth/v1/user', origin), {
    headers: { apikey: apiKey, Authorization: authorization }, redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw Error('Weather authentication unavailable');
  const user = await response.json();
  return typeof user.id === 'string' && Boolean(user.id) && user.is_anonymous !== true;
}

export function createRaceWeatherHandler({ authorize, load = loadRaceWeather, env = process.env } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.writeHead(status); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body)); };
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    const params = new URL(req.url, 'https://localhost').searchParams;
    const season = params.get('season'); const round = params.get('round');
    if (!/^20\d{2}$/.test(season || '') || Number(season) < 2023 || Number(season) > new Date().getUTCFullYear() + 1 || !/^[1-9]\d?$/.test(round || '')) {
      return send(400, { code: 'INVALID_PARAMETERS', message: 'Invalid race identity' });
    }
    try {
      const member = await (authorize ? authorize(req.headers.authorization) : authorizeWeatherMember(req.headers.authorization, env));
      if (!member) return send(401, { code: 'MEMBER_REQUIRED', message: 'Sign in to read race weather' });
      return send(200, await load(season, round));
    } catch {
      return send(502, { code: 'WEATHER_UNAVAILABLE', message: 'Race weather source unavailable' });
    }
  };
}

export default createRaceWeatherHandler();
