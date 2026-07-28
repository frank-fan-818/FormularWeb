module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 5,
      settings: {
        chromeFlags: '--disable-gpu --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': [
          'error',
          { minScore: 0.9, aggregationMethod: 'median' },
        ],
        'categories:accessibility': [
          'error',
          { minScore: 0.95, aggregationMethod: 'median' },
        ],
        'categories:best-practices': [
          'error',
          { minScore: 0.9, aggregationMethod: 'median' },
        ],
        'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'largest-contentful-paint': [
          'error',
          { maxNumericValue: 2500, aggregationMethod: 'median' },
        ],
        'cumulative-layout-shift': [
          'error',
          { maxNumericValue: 0.1, aggregationMethod: 'median' },
        ],
        'total-blocking-time': [
          'error',
          { maxNumericValue: 250, aggregationMethod: 'median' },
        ],
        'errors-in-console': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'http-status-code': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'document-title': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'html-has-lang': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'meta-viewport': ['error', { minScore: 1, aggregationMethod: 'pessimistic' }],
        'first-contentful-paint': [
          'warn',
          { maxNumericValue: 2000, aggregationMethod: 'median' },
        ],
        'speed-index': [
          'warn',
          { maxNumericValue: 3000, aggregationMethod: 'median' },
        ],
        interactive: [
          'warn',
          { maxNumericValue: 3500, aggregationMethod: 'median' },
        ],
        'total-byte-weight': ['warn', { maxNumericValue: 700000 }],
        'network-dependency-tree-insight': ['warn', { minScore: 1 }],
        'unused-javascript': ['warn', { maxLength: 0 }],
        'render-blocking-insight': ['warn', { maxLength: 0 }],
        'render-blocking-resources': ['warn', { maxLength: 0 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci/reports',
    },
  },
};
