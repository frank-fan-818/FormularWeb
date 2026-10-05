import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './artifacts/browser-qa/test-results',
  timeout: 20_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 2,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: './artifacts/browser-qa/report', open: 'never' }]]
    : 'line',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        serviceWorkers: 'block',
      },
    },
    {
      name: 'tablet-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        serviceWorkers: 'block',
      },
    },
    {
      name: 'desktop-firefox',
      grep: /guest home preserves|keyboard users|account entry|first visit|session discovery preserves|chart data|renders without a browser error|motion system|global search/,
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
      },
    },
    {
      name: 'mobile-webkit',
      grep: /guest home preserves|keyboard users|account entry|first visit|session discovery preserves|chart data|renders without a browser error|motion system|global search/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        viewport: { width: 375, height: 812 },
        serviceWorkers: 'block',
      },
    },
    {
      name: 'service-worker-chromium',
      grep: /service worker upgrades every long-lived tab/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'allow',
      },
    },
  ],
});
