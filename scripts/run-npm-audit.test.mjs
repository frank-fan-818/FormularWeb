import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuditFailureDisposition, isTransientAuditFailure } from './run-npm-audit.mjs';

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

test('warns only after transient retries are exhausted', () => {
  const transient = { output: 'npm warn audit 503 Service Unavailable', signal: null, timedOut: false };
  assert.equal(getAuditFailureDisposition({ attempt: 1, ...transient }, 4), 'retry');
  assert.equal(getAuditFailureDisposition({ attempt: 4, ...transient }, 4), 'warn');
  assert.equal(getAuditFailureDisposition({
    attempt: 4,
    output: '3 high severity vulnerabilities',
    signal: null,
    timedOut: false,
  }, 4), 'fail');
});
