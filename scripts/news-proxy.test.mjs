import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/news-feed.mjs';
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
async function call(url = '/api/news-feed?source=reddit', method = 'GET') {
  const headers = {}; let status; let body;
  await handler({ url, method }, { setHeader: (key, value) => { headers[key] = value; },
    writeHead: code => { status = code; }, end: value => { body = value; } });
  return { status, headers, body };
}
test('successful fixed feeds are shared-cacheable and never forward upstream cookies', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://www.reddit.com/r/formula1/.rss?limit=50');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>', { headers: { 'Content-Type': 'application/atom+xml', 'Set-Cookie': 'upstream=private' } });
  };
  const result = await call();
  assert.equal(result.status, 200);
  assert.match(result.headers['Vercel-CDN-Cache-Control'], /s-maxage=300/);
  assert.equal(result.headers['Set-Cookie'], undefined);
});
test('unknown sources, non-read methods and upstream errors never enter CDN cache', async () => {
  globalThis.fetch = async () => new Response('', { status: 429 });
  assert.equal((await call('/api/news-feed?source=https://evil.test')).status, 404);
  assert.equal((await call(undefined, 'POST')).status, 405);
  const result = await call();
  assert.equal(result.status, 503);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['Vercel-CDN-Cache-Control'], 'no-store');
});
test('HTML and oversized upstream bodies are rejected without caching', async () => {
  for (const response of [new Response('<html>blocked</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('x'.repeat(1_000_001), { headers: { 'Content-Type': 'application/xml' } })]) {
    globalThis.fetch = async () => response;
    assert.equal((await call()).status, 502);
  }
});
