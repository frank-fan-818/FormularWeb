// Offline fixture: the real Supabase SDK still serializes requests and errors.
import assert from 'node:assert/strict';
const scenario = process.env.FASTF1_TEST_SCENARIO;
const calls = new Map();
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  assert.equal(url.origin, 'https://example.supabase.co');
  assert.equal(url.pathname, '/rest/v1/fastf1_session_analytics');
  assert.equal(url.searchParams.get('on_conflict'), 'season,round,session');
  assert.equal(init.method, 'POST');
  assert.ok(new Headers(init.headers).get('Prefer').includes('resolution=merge-duplicates'));
  assert.ok(init.signal instanceof AbortSignal, 'Every attempt must have a timeout');
  const row = JSON.parse(init.body);
  const previous = calls.get(row.session);
  if (previous) assert.equal(init.body, previous.body, 'Retry payload must be unchanged');
  const attempt = (previous?.attempt || 0) + 1;
  calls.set(row.session, { attempt, body: init.body });
  if (row.session === 'FP2') {
    if (scenario === 'network' && attempt === 1) throw new TypeError('private-network-detail');
    if (scenario === '503' && attempt === 1) return new Response('private-upstream-body', { status: 503 });
    if (scenario === '403') return Response.json({ code: '42501', message: 'private-permission-detail' }, { status: 403 });
  }
  return new Response(null, { status: 201 });
};
