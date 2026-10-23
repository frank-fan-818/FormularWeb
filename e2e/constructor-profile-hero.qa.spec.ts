import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const constructor = { constructorId: 'mercedes', name: 'Mercedes', nationality: 'German', url: '' };
const summary = {
  constructor_id: 'mercedes', name: 'Mercedes', nationality: 'German', url: '',
  career_summary: { raceCount: 20, poleCount: 8, winCount: 10, podiumCount: 16, championshipCount: 1, totalPoints: 500 },
  best_race_finish: { position: '1', seasons: ['2025'] },
  seasons: [
    { season: '2026', position: '1', points: 578, wins: 11 },
    { season: '2025', position: '2', points: 400, wins: 2 },
  ],
};

async function installFixtures(page: Page) {
  await enterAsMember(page);
  await page.route('**/f1-api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const standings = pathname.endsWith('/constructorStandings.json');
    const constructors = pathname.endsWith('/constructors.json');
    return route.fulfill({ json: { MRData: {
      total: standings || constructors ? '1' : '0', RaceTable: { Races: [] },
      ConstructorTable: { Constructors: constructors ? [constructor] : [] }, DriverTable: { Drivers: [] },
      CircuitTable: { Circuits: [] }, SeasonTable: { Seasons: [{ season: '2026' }] },
      StandingsTable: { StandingsLists: standings ? [{ season: '2026', round: '17',
        ConstructorStandings: [{ position: '1', positionText: '1', points: '578', wins: '11', Constructor: constructor }],
      }] : [] },
    } } });
  });
  await page.route('**/rest/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const rows = pathname.endsWith('/constructor_history_summary') ? [summary]
      : pathname.endsWith('/constructors') ? [{ constructor_id: 'mercedes', name: 'Mercedes', nationality: 'German' }] : [];
    return route.fulfill({ json: rows });
  });
}

test('team profile combines the official car, transparent logo, registered flag and season facts', async ({ page }, testInfo) => {
  await installFixtures(page);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.goto('/constructors/mercedes');
  const hero = page.locator('.team-profile-hero');
  await expect(hero.getByRole('heading', { name: 'Mercedes', exact: true })).toBeVisible();
  await expect(hero.locator('.team-profile-flag')).toHaveAttribute('src', '/images/flags/de.svg');
  await expect(hero.locator('.team-profile-kicker img')).toHaveAttribute('src', '/images/constructors/mercedes-white.webp');
  await expect(hero.locator('.team-profile-car')).toHaveAttribute('src', '/images/constructors/cars/mercedes.webp');
  await expect(hero.locator('.team-profile-meta')).toContainText('P1');
  await expect(page.locator('.constructor-current-stat-grid')).toContainText('578');
  await expect.poll(() => hero.locator('img').evaluateAll(images => images.every(image =>
    (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const copy = (await hero.locator('.team-profile-copy').boundingBox())!;
  const art = (await hero.locator('.team-profile-art').boundingBox())!;
  if (testInfo.project.name === 'desktop-chromium') expect(copy.x + copy.width).toBeLessThanOrEqual(art.x + 1);
  else expect(copy.y + copy.height).toBeLessThanOrEqual(art.y + 1);
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/team-hero-${testInfo.project.name}.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(hero.getByRole('heading')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/team-hero-dark-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('search opens the constructor archive with the same branded hero and preserved timeline', async ({ page }, testInfo) => {
  await installFixtures(page);
  await page.goto('/');
  const label = '搜索车手、车队、赛道或赛事';
  const input = page.getByRole('combobox', { name: label });
  const trigger = page.getByRole('button', { name: label });
  await expect(trigger.or(input)).toBeVisible();
  if (await trigger.isVisible().catch(() => false)) await trigger.click();
  await input.fill('Mercedes');
  await page.getByRole('listbox').getByRole('option').filter({ hasText: 'Mercedes' }).click();
  await expect(page).toHaveURL(/\/history\/constructors\/mercedes$/);
  const hero = page.locator('.team-profile-hero');
  await expect(hero.locator('.team-profile-eyebrow')).toHaveCount(0);
  await expect(hero.locator('.team-profile-car')).toBeVisible();
  await expect(hero.locator('.team-profile-meta')).toContainText('2025–2026');
  await expect(page.getByText('Season Timeline', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/team-archive-hero-${testInfo.project.name}.png` });
});

test('historical constructors retain their own identity without borrowing a Mercedes logo or modern car', async ({ page }, testInfo) => {
  await installFixtures(page);
  await page.route('**/rest/v1/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/constructor_history_summary') ? [{
    ...summary, constructor_id: 'alfa_romeo', name: 'Alfa Romeo', nationality: 'Swiss',
    seasons: [{ season: '2023', position: '9', points: 16, wins: 0 }],
  }] : [] }));
  await page.goto('/history/constructors/alfa_romeo');
  const hero = page.locator('.team-profile-hero');
  await expect(hero.getByRole('heading', { name: 'Alfa Romeo' })).toBeVisible();
  await expect(hero.locator('.team-profile-flag')).toHaveAttribute('src', '/images/flags/ch.svg');
  await expect(hero.locator('.team-profile-meta')).toContainText('2023');
  await expect(hero.locator('.team-profile-eyebrow')).toHaveCount(0);
  await expect(hero.locator('.team-profile-car')).toHaveCount(0);
  await expect(hero.locator('img[src*="mercedes"]')).toHaveCount(0);
  await expect(hero.locator('.team-profile-logo-fallback')).toHaveText('AR');
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/historical-team-hero-${testInfo.project.name}.png` });
});

test('team profile recovers from an unavailable car image', async ({ page }) => {
  await installFixtures(page);
  await page.route('**/images/constructors/cars/mercedes.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/constructors/mercedes');
  await expect(page.locator('.team-profile-art.is-fallback')).toBeVisible();
  await expect(page.locator('.team-profile-logo-fallback')).toHaveAttribute('src', '/images/constructors/mercedes-white.webp');
  await expect(page.locator('.constructor-current-stat-grid')).toContainText('578');
});

test('team points and wins stay readable after a circuit page is visited', async ({ page }, info) => {
  await installFixtures(page);
  await page.addInitScript(() => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
    version: 3, state: { currentSeason: '2026', theme: 'light', sidebarCollapsed: false, features: {} },
  })));
  await page.goto('/constructors/mercedes');
  const values = page.locator('.constructor-current-stat-grid .stat-value');
  await expect(values).toHaveText(['P1', '578 分', '11']);
  // Keep the SPA document alive so the circuit route's CSS remains loaded.
  await page.evaluate(() => {
    history.pushState(null, '', '/circuits');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.circuit-atlas-page')).toBeVisible();
  await page.goBack();
  await expect(values).toHaveText(['P1', '578 分', '11']);
  for (const [theme, color] of [['light-mode', 'rgb(34, 34, 34)'], ['dark-mode', 'rgb(226, 232, 240)']]) {
    await page.evaluate(value => {
      document.documentElement.classList.remove('light-mode', 'dark-mode');
      document.documentElement.classList.add(value);
    }, theme);
    await expect(values.nth(1)).toHaveCSS('color', color);
    await expect(values.nth(2)).toHaveCSS('color', color);
    await page.locator('.constructor-profile-shell').screenshot({
      path: `artifacts/browser-qa/screenshots/team-stats-${theme}-${info.project.name}.png`, animations: 'disabled',
    });
  }
});
