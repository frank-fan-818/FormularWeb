import { loadPitData } from './_lib/pit-stops.mjs';

const snapshots = new Map();
const pending = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status, body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(status); res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  };
  if (!['GET', 'HEAD'].includes(req.method)) return send(405, { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  const query = new URL(req.url, 'https://localhost').searchParams;
  const kind = query.get('kind') || 'award';
  const season = query.get('season'); const round = query.get('round') || '';
  if (!['race', 'award'].includes(kind) || !/^20\d{2}$/.test(season || '') || Number(season) > new Date().getUTCFullYear() + 1 || (round && !/^[1-9]\d?$/.test(round)) || (kind === 'race' && !round)) return send(400, { code: 'INVALID_PARAMETERS', message: 'Invalid parameters' });
  const key = `${kind}:${season}:${round}`;
  const saved = snapshots.get(key);
  if (saved && Date.now() - saved.at < 600_000) return send(200, saved.value);
  try {
    if (!pending.has(key)) pending.set(key, loadPitData(kind, season, round).finally(() => pending.delete(key)));
    const result = await pending.get(key);
    const hasData = result.records?.length || result.standings?.length || result.stops?.length || result.seasonFastest?.length;
    if (!hasData && saved) throw Error('Empty update');
    if (snapshots.size > 100) snapshots.delete(snapshots.keys().next().value);
    if (hasData) snapshots.set(key, { value: result, at: Date.now() });
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
    return send(200, result);
  } catch {
    if (saved && Date.now()-saved.at < 7*86400_000) return send(200, { ...saved.value, stale: true });
    return send(502, { code: 'UPSTREAM_ERROR', message: 'Pit stop source unavailable' });
  }
}
