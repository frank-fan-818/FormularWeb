import test from 'node:test';
import assert from 'node:assert/strict';
import { isTransientAuditFailure } from './run-npm-audit.mjs';

test('retries npm registry service failures', () => {
  assert.equal(isTransientAuditFailure(
    'npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
  ), true);
  assert.equal(isTransientAuditFailure('npm error code ECONNRESET'), true);
});

test('does not retry a real vulnerability report', () => {
  assert.equal(isTransientAuditFailure(
    'high severity vulnerability\nfix available via npm audit fix\n3 high severity vulnerabilities',
  ), false);
});
