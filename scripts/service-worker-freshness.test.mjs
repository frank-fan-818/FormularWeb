import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
const json = (total) => new Response(JSON.stringify({ MRData: { total } }), {
  headers: { 'content-type': 'application/json' },
});

async function requestWithCache(network, cached, failWrite = false, failOpen = false) {
  const handlers = {};
  let stored = cached;
  const cache = {
    match: async () => stored?.clone(),
    put: async (_request, response) => {
      if (failWrite) throw new Error('storage quota exceeded');
      stored = response;
    },
    keys: async () => [],
  };
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => {
      if (failOpen) throw new Error('cache unavailable');
      return cache;
    } },
    fetch: network,
    URL,
  });
  let response;
  const background = [];
  handlers.fetch({
    request: new Request('https://example.test/f1-api/2026/13/results.json?limit=100'),
    respondWith: (value) => { response = value; },
    waitUntil: (value) => background.push(value),
  });
  const result = await response;
  await Promise.all(background);
  return result;
}

test('first visit after the race returns fresh results despite a cached empty classification', async () => {
  const response = await requestWithCache(async () => json('22'), json('0'));
  assert.equal((await response.json()).MRData.total, '22');
});

test('corrected results replace an older nonempty classification immediately', async () => {
  const response = await requestWithCache(async () => json('22'), json('20'));
  assert.equal((await response.json()).MRData.total, '22');
});

test('offline access retains cached results', async () => {
  const response = await requestWithCache(async () => { throw new Error('offline'); }, json('22'));
  assert.equal((await response.json()).MRData.total, '22');
});

test('upstream failure retains cached results', async () => {
  const response = await requestWithCache(async () => new Response('unavailable', { status: 503 }), json('22'));
  assert.equal((await response.json()).MRData.total, '22');
});

test('cache write failures do not hide successful network results', async () => {
  const response = await requestWithCache(async () => json('22'), json('0'), true);
  assert.equal((await response.json()).MRData.total, '22');
});

test('an uncached upstream failure preserves its HTTP status', async () => {
  const response = await requestWithCache(async () => new Response('unavailable', { status: 503 }));
  assert.equal(response.status, 503);
});

test('unavailable cache storage does not break online classifications', async () => {
  const response = await requestWithCache(async () => json('22'), undefined, false, true);
  assert.equal((await response.json()).MRData.total, '22');
});
