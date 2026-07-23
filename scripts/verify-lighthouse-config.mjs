import lighthouseConfig from '../.lighthouserc.cjs';

const assertConfig = lighthouseConfig?.ci?.assert;
const assertions = assertConfig?.assertions;

if (!assertions || typeof assertions !== 'object') {
  throw new Error('Lighthouse assertions must be configured explicitly.');
}

if (assertConfig.preset) {
  throw new Error(
    'Lighthouse assertion presets are forbidden because their implicit rules change between releases.',
  );
}

const expectedAssertions = {
  'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
  'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
  'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
  'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
  'total-blocking-time': ['error', { maxNumericValue: 250, aggregationMethod: 'median' }],
  'errors-in-console': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
  'http-status-code': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
  'document-title': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
  'html-has-lang': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
  viewport: ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
  'first-contentful-paint': ['warn', { maxNumericValue: 2000, aggregationMethod: 'median' }],
  'speed-index': ['warn', { maxNumericValue: 3000, aggregationMethod: 'median' }],
  interactive: ['warn', { maxNumericValue: 3500, aggregationMethod: 'median' }],
  'total-byte-weight': ['warn', { maxNumericValue: 700000 }],
  'network-dependency-tree-insight': ['warn', { minScore: 1 }],
  'unused-javascript': ['warn', { maxLength: 0 }],
  'render-blocking-insight': ['warn', { maxLength: 0 }],
  'render-blocking-resources': ['warn', { maxLength: 0 }],
};

const failures = [];

for (const [assertionId, [expectedLevel, expectedOptions]] of Object.entries(
  expectedAssertions,
)) {
  const assertion = assertions[assertionId];

  if (!assertion) {
    failures.push(`${assertionId} is missing`);
    continue;
  }

  const [level, options = {}] = Array.isArray(assertion)
    ? assertion
    : [assertion, {}];

  if (level !== expectedLevel) {
    failures.push(`${assertionId} must use the ${expectedLevel} level`);
  }

  for (const [optionName, expectedValue] of Object.entries(expectedOptions)) {
    if (options[optionName] !== expectedValue) {
      failures.push(
        `${assertionId}.${optionName} must equal ${expectedValue}`,
      );
    }
  }

  if (level === 'error' && Object.hasOwn(options, 'maxLength')) {
    failures.push(
      `${assertionId} uses a diagnostic item count as a blocking assertion`,
    );
  }
}

for (const [assertionId, assertion] of Object.entries(assertions)) {
  const level = Array.isArray(assertion) ? assertion[0] : assertion;

  if (level === 'error' && !Object.hasOwn(expectedAssertions, assertionId)) {
    failures.push(`${assertionId} is not an approved blocking assertion`);
  }
}

const numberOfRuns = lighthouseConfig?.ci?.collect?.numberOfRuns;

if (!Number.isInteger(numberOfRuns) || numberOfRuns < 5) {
  failures.push('Lighthouse must collect at least five runs to reduce variance');
}

if (failures.length > 0) {
  throw new Error(`Lighthouse configuration verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write('Lighthouse configuration verification passed.\n');
