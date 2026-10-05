function productionOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Production URL must be a plain HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

export async function verifyProduction({ baseUrl, expectedVersion, season = String(new Date().getUTCFullYear()), fetchImpl = fetch }) {
  const origin = productionOrigin(baseUrl);
  if (!/^\d{4}$/.test(season)) throw new Error('Season must be a four-digit year.');
  const checks = [];
  const check = (id, passed) => checks.push({ id, passed: Boolean(passed) });
  const request = async (pathname) => {
    try {
      const response = await fetchImpl(`${origin}${pathname}`, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (Number(response.headers.get('content-length')) > 2_000_000) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2_000_000) { await reader.cancel(); return null; }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const body = Buffer.concat(chunks, size).toString('utf8');
      return { status: response.status, headers: response.headers, body };
    } catch { return null; } // Reports contain static checks only, never raw exceptions or bodies.
  };
  const paths = ['/', '/login', '/release.json', '/sw.js', '/assets/release-probe-missing.js',
    '/fastf1/release-probe.json', `/f1-api/${season}.json`];
  const [home, login, identity, worker, missingAsset, privateAnalysis, api] = await Promise.all(paths.map(request));
  const html = response => response?.status === 200 && response.headers.get('content-type')?.includes('text/html') && /id=["']root["']/.test(response.body);
  check('home_document', html(home));
  check('login_document', html(login));
  const csp = home?.headers.get('content-security-policy') || '';
  check('security_headers', home?.headers.get('x-content-type-options') === 'nosniff'
    && home.headers.get('x-frame-options') === 'DENY'
    && Number(home.headers.get('strict-transport-security')?.match(/max-age=(\d+)/)?.[1]) >= 31_536_000
    && csp.includes("default-src 'self'") && csp.includes("object-src 'none'")
    && csp.includes("frame-ancestors 'none'") && !csp.includes("'unsafe-eval'"));
  let release = null;
  try {
    const candidate = JSON.parse(identity?.body || '');
    if (identity.status === 200 && identity.headers.get('content-type')?.includes('application/json')
      && identity.headers.get('cache-control')?.includes('no-store')
      && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(candidate.version)
      && /^[a-f0-9]{12,64}$/.test(candidate.buildId)) {
      release = { version: candidate.version, buildId: candidate.buildId };
    }
  } catch { /* Missing identity is a failing check, not a generic SPA success. */ }
  check('release_identity', release && (!expectedVersion || release.version === expectedVersion));
  check('service_worker_cache', worker?.status === 200 && /(?:java|ecma)script/.test(worker.headers.get('content-type') || '')
    && worker.headers.get('cache-control')?.includes('no-store') && worker.body.includes('addEventListener'));
  check('missing_asset_404', missingAsset?.status === 404);
  check('private_analysis_boundary', privateAnalysis?.status === 404 && privateAnalysis.headers.get('cache-control')?.includes('no-store'));
  let validSeason = false;
  try {
    const table = JSON.parse(api?.body || '').MRData?.RaceTable;
    validSeason = api.status === 200 && api.headers.get('content-type')?.includes('application/json')
      && table?.season === season && Array.isArray(table.Races) && table.Races.length > 0
      && table.Races.every(race => race.season === season && /^\d+$/.test(race.round)
        && typeof race.raceName === 'string' && Number.isFinite(Date.parse(race.date)));
  } catch { /* A transport or upstream format failure never passes the data check. */ }
  check('season_proxy', validSeason);
  const assetPath = home?.body.match(/<script\b[^>]*\bsrc=["'](\/assets\/[\w.-]+\.js)["']/i)?.[1];
  const asset = assetPath ? await request(assetPath) : null;
  check('hashed_asset', asset?.status === 200 && /(?:java|ecma)script/.test(asset.headers.get('content-type') || '')
    && asset.headers.get('cache-control')?.includes('immutable')
    && Number(asset.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]) >= 31_536_000);
  return { checkedAt: new Date().toISOString(), origin, season, release,
    availability: home ? 'reachable' : 'unreachable',
    status: checks.every(item => item.passed) ? 'pass' : 'fail', checks };
}
