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

const requiredBlockingAssertions = new Set([
  'categories:performance',
  'categories:accessibility',
  'categories:best-practices',
  'categories:seo',
  'largest-contentful-paint',
  'cumulative-layout-shift',
  'total-blocking-time',
  'errors-in-console',
  'http-status-code',
  'document-title',
  'html-has-lang',
  'viewport',
]);

const requiredDiagnosticAssertions = new Set([
  'network-dependency-tree-insight',
  'unused-javascript',
  'render-blocking-insight',
  'render-blocking-resources',
]);

const failures = [];

for (const assertionId of requiredBlockingAssertions) {
  const assertion = assertions[assertionId];
  const level = Array.isArray(assertion) ? assertion[0] : assertion;

  if (level !== 'error') {
    failures.push(`${assertionId} must remain a blocking assertion`);
  }
}

for (const assertionId of requiredDiagnosticAssertions) {
  const assertion = assertions[assertionId];
  const level = Array.isArray(assertion) ? assertion[0] : assertion;

  if (level !== 'warn') {
    failures.push(`${assertionId} must remain a non-blocking diagnostic`);
  }
}

for (const [assertionId, assertion] of Object.entries(assertions)) {
  const [level, options = {}] = Array.isArray(assertion)
    ? assertion
    : [assertion, {}];

  if (level === 'error' && Object.hasOwn(options, 'maxLength')) {
    failures.push(
      `${assertionId} uses a diagnostic item count as a blocking assertion`,
    );
  }

  if (level === 'error' && !requiredBlockingAssertions.has(assertionId)) {
    failures.push(`${assertionId} is not an approved blocking assertion`);
  }

  if (level === 'error' && options.aggregationMethod !== 'median') {
    failures.push(`${assertionId} must use median aggregation across runs`);
  }
}

if (lighthouseConfig.ci.collect.numberOfRuns < 5) {
  failures.push('Lighthouse must collect at least five runs to reduce variance');
}

if (failures.length > 0) {
  throw new Error(`Lighthouse configuration verification failed:\n- ${failures.join('\n- ')}`);
}

process.stdout.write('Lighthouse configuration verification passed.\n');
