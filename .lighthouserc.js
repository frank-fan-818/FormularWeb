module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'csp-xss': 'off', // CSP handled by Vercel headers
        'categories:performance': ['error', { minScore: 0.9 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 250 }],
        'total-byte-weight': ['warn', { maxNumericValue: 700000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
