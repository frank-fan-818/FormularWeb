import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyProduction } from './verify-production-lib.mjs';

const security = { 'Content-Security-Policy': "default-src 'self'; object-src 'none'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000' };
function fixture(override = {}) {
  const replies = {
    '/': new Response('<html><div id="root"></div><script src="/assets/app-test.js"></script></html>', { headers: { ...security, 'Content-Type': 'text/html' } }),
    '/login': new Response('<div id="root"></div>', { headers: { 'Content-Type': 'text/html' } }),
    '/release.json': new Response(JSON.stringify({ version: '0.20.12', buildId: '0123456789ab' }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
    '/sw.js': new Response('self.addEventListener("fetch", () => {})', { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache, no-store, must-revalidate' } }),
    '/assets/app-test.js': new Response('export {};', { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=31536000, immutable' } }),
    '/assets/release-probe-missing.js': new Response('missing', { status: 404 }),
    '/fastf1/release-probe.json': new Response('missing', { status: 404, headers: { 'Cache-Control': 'no-store' } }),
    '/f1-api/2026.json': new Response(JSON.stringify({ MRData: { RaceTable: { season: '2026', Races: [{ season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08' }] } } }), { headers: { 'Content-Type': 'application/json' } }),
    ...override,
  };
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(new URL(url).origin, 'https://race.example');
    return replies[new URL(url).pathname]?.clone() ?? new Response('missing', { status: 404 });
  };
}

test('checks production documents, release identity, cache boundaries, private paths and the real season proxy using GET only', async () => {
  const report = await verifyProduction({ baseUrl: 'https://race.example', expectedVersion: '0.20.12', season: '2026', fetchImpl: fixture() });
  assert.equal(report.status, 'pass');
  assert.equal(report.release.version, '0.20.12');
  assert.ok(report.checks.length >= 8);
});
test('fails on a stale or absent release version rather than accepting a generic SPA response', async () => {
  const report = await verifyProduction({ baseUrl: 'https://race.example', expectedVersion: '0.20.13', season: '2026', fetchImpl: fixture() });
  assert.equal(report.status, 'fail');
  assert.equal(report.checks.find(check => check.id === 'release_identity').passed, false);
});
test('detects a private-data exposure and broken static-file fallback', async () => {
  const report = await verifyProduction({ baseUrl: 'https://race.example', season: '2026', fetchImpl: fixture({
    '/fastf1/release-probe.json': new Response('{}'),
    '/assets/release-probe-missing.js': new Response('<html>SPA</html>'),
  }) });
  assert.equal(report.checks.find(check => check.id === 'private_analysis_boundary').passed, false);
  assert.equal(report.checks.find(check => check.id === 'missing_asset_404').passed, false);
});
test('rejects an HTML API fallback, wrong season and unsafe cache or script headers', async () => {
  const report = await verifyProduction({ baseUrl: 'https://race.example', season: '2026', fetchImpl: fixture({
    '/f1-api/2026.json': new Response('<html>SPA</html>'),
    '/sw.js': new Response('worker', { headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'immutable' } }),
    '/assets/app-test.js': new Response('asset', { headers: { 'Content-Type': 'text/html' } }),
  }) });
  for (const id of ['season_proxy', 'service_worker_cache', 'hashed_asset']) assert.equal(report.checks.find(check => check.id === id).passed, false);
});
test('never persists a raw exception, credentials, query parameters or a response body', async () => {
  const report = await verifyProduction({ baseUrl: 'https://race.example', season: '2026', fetchImpl: async () => { throw new Error('private token detail'); } });
  assert.equal(report.status, 'fail');
  assert.ok(!JSON.stringify(report).includes('private token detail'));
  assert.equal(report.availability, 'unreachable');
  for (const baseUrl of ['https://user:password@race.example', 'https://race.example/?token=x', 'http://race.example', 'https://race.example/subpath']) {
    await assert.rejects(verifyProduction({ baseUrl, fetchImpl: fixture() }));
  }
});

test('cancels an oversized streamed response before buffering the entire body', async () => {
  let cancelled = false;
  let pulls = 0;
  const oversized = new Response(new ReadableStream({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array(1_100_000));
      if (pulls === 10) controller.close();
    },
    cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/html' } });
  const normal = fixture();
  const fetchImpl = (url, options) => new URL(url).pathname === '/'
    ? Promise.resolve(oversized) : normal(url, options);
  const report = await verifyProduction({ baseUrl: 'https://race.example', season: '2026', fetchImpl });
  assert.equal(report.checks.find(check => check.id === 'home_document').passed, false);
  assert.equal(cancelled, true);
  assert.ok(pulls <= 3, 'stop after the response-size limit, including one prefetched chunk');
});
