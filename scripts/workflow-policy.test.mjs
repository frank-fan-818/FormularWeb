import assert from 'node:assert/strict';
import test from 'node:test';
import { hasWritePermission } from './workflow-policy.mjs';

test('detects GitHub write-all shorthand', () => {
  assert.equal(hasWritePermission('write-all'), true);
});

test('detects scoped write permission', () => {
  assert.equal(hasWritePermission({ contents: 'read', pull_requests: 'write' }), true);
});

test('allows read-only permission forms', () => {
  assert.equal(hasWritePermission('read-all'), false);
  assert.equal(hasWritePermission({ contents: 'read' }), false);
});
