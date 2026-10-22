import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('news feeds use fixed HTTPS upstreams before the SPA fallback, with bounded shared caching', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const feeds = JSON.parse(await readFile(new URL('../config/news-feeds.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(feeds), ['motorsport', 'fia', 'reddit']);
  for (const [source, upstream] of Object.entries(feeds)) {
    assert.equal(new URL(upstream).protocol, 'https:');
    const index = config.routes.findIndex(route => route.src === `/news-feed/${source}`);
    assert.ok(index > 0 && index < config.routes.findIndex(route => route.handle === 'filesystem'));
    assert.equal(config.routes[index].dest, upstream);
    assert.equal(config.routes[index].headers['Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=86400');
  }
  const unknown = config.routes.findIndex(route => route.src === '/news-feed(?:/.*)?' && route.status === 404);
  assert.ok(unknown > config.routes.findIndex(route => route.src === '/news-feed/fia'));
  assert.ok(unknown < config.routes.findIndex(route => route.dest === '/index.html'));
  assert.ok(!config.routes.some(route => route.src?.startsWith('/news-feed') && route.dest?.includes('$')));
});

test('news links do not require extra third-party frames or scripts', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.routes[0].headers['Content-Security-Policy'];
  const directives = Object.fromEntries(csp.split(';').filter(value => value.trim()).map(value => {
    const [name, ...sources] = value.trim().split(/\s+/); return [name, sources];
  }));
  assert.deepEqual(directives['frame-src'], ['https://challenges.cloudflare.com']);
  assert.deepEqual(directives['script-src'], ["'self'", 'https://challenges.cloudflare.com']);
  assert.deepEqual(directives['frame-ancestors'], ["'none'"]);
});
