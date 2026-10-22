import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));
const analyticsBundle: string = manifest['node_modules/@vercel/analytics/dist/index.mjs'].file;

test.beforeEach(async ({ page }) => {
  await enterAsMember(page);
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: '0', RaceTable: { Races: [] }, StandingsTable: { StandingsLists: [] }, SeasonTable: { Seasons: [] },
  } } }));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
});

test('optional analytics initializes once across client-side navigation', async ({ page }) => {
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/_vercel/insights/script.js') scripts.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/races');
  const script = page.locator('head script[src="/_vercel/insights/script.js"]');
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute('data-sdkn', '@vercel/analytics/react');
  await expect(page.locator('main')).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 768) await page.locator('.menu-toggle-btn').click();
  await page.locator('.sidebar-nav-button').filter({ hasText: '赛道' }).click();
  await expect(page).toHaveURL(/\/circuits$/);
  await expect(page.locator('.product-masthead h1')).toHaveText('TRACK ENGINEERING');
  await expect(script).toHaveCount(1);
  expect(scripts).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('an unavailable analytics chunk leaves the application usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(`**/${analyticsBundle}`, route => route.abort('failed'));
  await page.goto('/races');
  await expect(page.locator('.product-masthead h1')).toContainText('RACE CALENDAR');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('head script[src="/_vercel/insights/script.js"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
