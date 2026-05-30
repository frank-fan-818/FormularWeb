module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'csp-xss': 'off', // CSP handled by Vercel headers
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
