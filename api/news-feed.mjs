import feeds from '../config/news-feeds.json' with { type: 'json' };

// Only public, fixed feeds cross this boundary. Upstream cookies are never forwarded.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const source = new URL(req.url, 'https://localhost').searchParams.get('source');
  const fail = status => { res.writeHead(status); res.end(); };
  if (!['GET', 'HEAD'].includes(req.method)) return fail(405);
  if (!Object.hasOwn(feeds, source)) return fail(404);
  try {
    const response = await fetch(feeds[source], { signal: AbortSignal.timeout(4000), redirect: 'error',
      headers: { Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml', 'User-Agent': 'FormularOneWeb/1.2 (public F1 feed reader)' } });
    if (!response.ok) return fail(response.status === 429 ? 503 : 502);
    const contentType = response.headers.get('content-type') || '';
    if (!/^(?:application|text)\/(?:atom\+xml|rss\+xml|xml)(?:;|$)/i.test(contentType)) return fail(502);
    const reader = response.body?.getReader();
    if (!reader) return fail(502);
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) { await reader.cancel(); return fail(502); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    if (/<!DOCTYPE/i.test(body.toString()) || !/<(?:rss|feed)(?:\s|>)/i.test(body.toString())) return fail(502);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : body);
  } catch { return fail(504); }
}
