import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { enterAsGuest } from './auth-fixtures';

const profiles = JSON.parse(readFileSync('src/data/circuit-profiles.json', 'utf8')) as Record<string, {
  name: string; locality: string; country: string; lat: number; long: number;
}>;

const catalogue = Object.entries(profiles).map(([circuitId, profile]) => ({
  circuitId, circuitName: profile.name, url: '#',
  Location: { locality: profile.locality, country: profile.country, lat: String(profile.lat), long: String(profile.long) },
}));
const aliases = ['albert_park', 'villeneuve', 'red_bull_ring', 'spa', 'americas', 'rodriguez', 'vegas', 'losail', 'buddha', 'valencia_street',
  'boavista', 'charade', 'essarts', 'galvez', 'george', 'lemans', 'okayama', 'tremblant'];

test('all 78 circuit profiles and calendar aliases show known metadata with an empty database', async ({ page }, info) => {
  test.setTimeout(120_000);
  await enterAsGuest(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if ((message.type() === 'error' || message.type() === 'warning')
      && message.text() !== 'Service Worker registration blocked by Playwright') errors.push(message.text());
  });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: String(catalogue.length), SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: catalogue.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));

  for (const id of [...catalogue.map(circuit => circuit.circuitId), ...aliases]) {
    await page.goto(`/circuits/${id}`);
    await expect(page.locator('.stats-grid .stat-card').first()).toBeVisible();
    const values = await page.locator('.stats-grid .stat-value').allTextContents();
    expect(values.length, id).toBeGreaterThanOrEqual(6);
    expect(values.join(' '), id).not.toMatch(/资料待补|正在读取|unknown|N\/A|NaN|undefined|--/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), id).toBeLessThanOrEqual(1);
    if (['madring', 'montreal', 'spielberg', 'adelaide'].includes(id)) {
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/metadata-${id}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  await page.goto('/circuits');
  await expect(page.locator('.circuit-atlas-card')).toHaveCount(78);
  expect((await page.locator('.circuit-atlas-specs').allTextContents()).join(' ')).not.toMatch(/资料待补|unknown|N\/A|NaN|undefined|--/i);
  await page.locator('.circuit-atlas-card').filter({ hasText: 'Madring' }).click();
  await expect(page).toHaveURL(/\/circuits\/madring$/);
  await expect(page.locator('.stats-grid')).toContainText('308.399 km');
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('local metadata renders while the remote circuit request is still pending', async ({ page }) => {
  await enterAsGuest(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/circuits')) await held;
    await route.fulfill({ json: [] });
  });
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: { total: '0', RaceTable: { Races: [] }, SeasonTable: { Seasons: [] } } } }));
  try {
    await page.goto('/circuits/madring');
    await expect(page.locator('.stats-grid')).toContainText('5.414 km');
    await expect(page.locator('.stats-grid')).toContainText('26 m');
    await expect(page.getByText('资料待补', { exact: true })).toHaveCount(0);
    release();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
