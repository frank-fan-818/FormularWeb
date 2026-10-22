import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const profiles = [
  { id: 'andrea_kimi_antonelli', first: 'Andrea Kimi', last: 'Antonelli', nationality: 'Italian', number: '12', code: 'ANT', team: 'mercedes', teamName: 'Mercedes' },
  { id: 'leclerc', first: 'Charles', last: 'Leclerc', nationality: 'Monegasque', number: '16', code: 'LEC', team: 'ferrari', teamName: 'Ferrari' },
  { id: 'future_driver', first: 'Future', last: 'Driver', nationality: 'Unknown', number: '99', code: 'FUT', team: 'williams', teamName: 'Williams' },
];

async function mockProfile(page: Page, profile = profiles[0]) {
  await enterAsMember(page);
  const Driver = { driverId: profile.id, givenName: profile.first, familyName: profile.last,
    nationality: profile.nationality, permanentNumber: profile.number, code: profile.code,
    url: '', dateOfBirth: '2006-08-25' };
  await page.route('**/f1-api/**', route => {
    const standings = route.request().url().includes('/driverStandings.json');
    const driverList = new URL(route.request().url()).pathname.endsWith('/drivers.json');
    return route.fulfill({ json: { MRData: {
      total: standings || driverList ? '1' : '0', RaceTable: { Races: [] }, SeasonTable: { Seasons: [{ season: '2026' }] },
      DriverTable: { Drivers: driverList ? [Driver] : [] }, ConstructorTable: { Constructors: [] }, CircuitTable: { Circuits: [] },
      StandingsTable: { StandingsLists: standings ? [{ season: '2026', round: '17', DriverStandings: [{
        position: '1', positionText: '1', points: '340', wins: '8', Driver,
        Constructors: [{ constructorId: profile.team, name: profile.teamName, url: '', nationality: 'German' }],
      }] }] : [] },
    } } });
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
}

test('driver hero shows the Italian flag, standing portrait and readable identity across viewports', async ({ page }, testInfo) => {
  await mockProfile(page);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });
  await page.goto('/drivers/andrea_kimi_antonelli');
  const hero = page.locator('.driver-profile-hero');
  await expect(hero.getByRole('heading', { name: 'Andrea Kimi Antonelli' })).toBeVisible();
  await expect(hero.locator('.driver-profile-flag')).toHaveAttribute('src', '/images/flags/it.svg');
  await expect(hero.locator('.driver-profile-team-logo')).toHaveAttribute('src', '/images/constructors/mercedes-white.webp');
  await expect(hero.locator('.driver-profile-team-logo')).toHaveCSS('height', '20px');
  await expect(hero.locator('.driver-profile-meta')).toContainText('#12');
  await expect(hero.locator('.driver-profile-portrait > img')).toHaveAttribute('src', '/images/drivers/portraits/antonelli.webp');
  await expect.poll(() => hero.locator('img').evaluateAll(images => images.every(image =>
    (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('.driver-current-stat-grid')).toContainText('P1');
  await expect(page.locator('.driver-current-stat-grid')).toContainText('340');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const copy = await hero.locator('.driver-profile-copy').boundingBox();
  const portrait = await hero.locator('.driver-profile-portrait').boundingBox();
  expect(copy).not.toBeNull();
  expect(portrait).not.toBeNull();
  if (testInfo.project.name === 'desktop-chromium') expect(copy!.x + copy!.width).toBeLessThanOrEqual(portrait!.x + 1);
  else expect(copy!.y + copy!.height).toBeLessThanOrEqual(portrait!.y + 1);
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/driver-hero-${testInfo.project.name}.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/driver-hero-dark-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('driver hero uses the driver nationality and the correct portrait for another team', async ({ page }) => {
  await mockProfile(page, profiles[1]);
  await page.goto('/drivers/leclerc');
  const hero = page.locator('.driver-profile-hero');
  await expect(hero.locator('.driver-profile-flag')).toHaveAttribute('src', '/images/flags/mc.svg');
  await expect(hero.locator('.driver-profile-portrait > img')).toHaveAttribute('src', '/images/drivers/portraits/leclerc.webp');
  await expect(hero.getByRole('heading')).toHaveText('CharlesLeclerc');
});

test('driver hero falls back cleanly for missing portraits and unknown nationality', async ({ page }) => {
  await mockProfile(page, profiles[2]);
  await page.goto('/drivers/future_driver');
  await expect(page.locator('.driver-profile-portrait.is-fallback')).toBeVisible();
  await expect(page.locator('.driver-profile-avatar')).toHaveText('FD');
  await expect(page.locator('.driver-profile-flag')).toHaveCount(0);
  await expect(page.locator('.driver-profile-nationality')).toHaveText('Unknown');
});

test('driver hero recovers from a failed portrait request', async ({ page }) => {
  await mockProfile(page);
  await page.route('**/images/drivers/portraits/antonelli.webp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/drivers/andrea_kimi_antonelli');
  await expect(page.locator('.driver-profile-portrait.is-fallback')).toBeVisible();
  await expect(page.locator('.driver-profile-avatar')).toHaveAttribute('src', '/images/drivers/kimi_antonelli.png');
  await expect(page.locator('.driver-profile-name')).toContainText('Antonelli');
});

const archiveSummary = {
  driver_id: profiles[0].id, permanent_number: '12', code: 'ANT', url: '',
  given_name: 'Andrea Kimi', family_name: 'Antonelli', date_of_birth: '2006-08-25', nationality: 'Italian',
  recent_constructor_name: 'Mercedes', recent_constructor_id: 'mercedes',
  career_summary: { raceCount: 10, winCount: 1, podiumCount: 2, poleCount: 1, championshipCount: 0, totalPoints: 50 },
  best_race_finish: { position: '1', seasons: ['2026'] },
  seasons: [{ season: '2026', position: '1', points: 50, wins: 1, constructorId: 'mercedes', constructorName: 'Mercedes' }],
};

test('global search opens a driver archive with the same flag, portrait and transparent team logo', async ({ page }, testInfo) => {
  await mockProfile(page);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.route('**/rest/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const rows = pathname.endsWith('/driver_history_summary') ? [archiveSummary] : pathname.endsWith('/drivers') ? [{
      driver_id: profiles[0].id, first_name: 'Andrea Kimi', last_name: 'Antonelli',
      nationality: '', permanent_number: '', code: '', date_of_birth: '2006-08-25',
    }] : [];
    return route.fulfill({ json: rows });
  });
  await page.goto('/');
  const label = '搜索车手、车队、赛道或赛事';
  const trigger = page.getByRole('button', { name: label });
  const input = page.getByRole('combobox', { name: label });
  await expect(trigger.or(input)).toBeVisible();
  if (await trigger.isVisible().catch(() => false)) await trigger.click();
  await input.fill('Andrea Kimi');
  const option = page.getByRole('listbox').getByRole('option').filter({ hasText: 'Andrea Kimi Antonelli' });
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/history/drivers/${profiles[0].id}$`));
  const hero = page.locator('.driver-profile-hero');
  await expect(hero.locator('.driver-profile-eyebrow')).toHaveCount(0);
  await expect(hero.locator('.driver-profile-flag')).toHaveAttribute('src', '/images/flags/it.svg');
  await expect(hero.locator('.driver-profile-portrait > img')).toHaveAttribute('src', '/images/drivers/portraits/antonelli.webp');
  await expect(hero.locator('.driver-profile-team-logo')).toHaveAttribute('src', '/images/constructors/mercedes-white.webp');
  await expect(hero.locator('.driver-profile-meta')).toContainText('#12');
  await expect(page.getByRole('heading', { name: '历史生涯概览' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/search-driver-hero-${testInfo.project.name}.png` });
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('an archive-only retired driver keeps the flag and team styling with the actual last season and avatar fallback', async ({ page }, testInfo) => {
  await mockProfile(page, profiles[2]);
  await page.route('**/rest/v1/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('/driver_history_summary') ? [{
    ...archiveSummary, driver_id: 'daniel_ricciardo', given_name: 'Daniel', family_name: 'Ricciardo',
    permanent_number: '3', code: 'RIC', nationality: 'Australian',
    recent_constructor_name: 'Racing Bulls', recent_constructor_id: 'rb',
    best_race_finish: { position: '1', seasons: ['2021'] },
    seasons: [{ season: '2024', position: '17', points: 12, wins: 0, constructorId: 'rb', constructorName: 'Racing Bulls' }],
  }] : [] }));
  await page.goto('/history/drivers/daniel_ricciardo');
  const hero = page.locator('.driver-profile-hero');
  await expect(hero.getByRole('heading', { name: 'Daniel Ricciardo' })).toBeVisible();
  await expect(hero.locator('.driver-profile-flag')).toHaveAttribute('src', '/images/flags/au.svg');
  await expect(hero.locator('.driver-profile-meta')).toContainText('2024');
  await expect(hero.locator('.driver-profile-eyebrow')).toHaveCount(0);
  await expect(hero.locator('.driver-profile-avatar')).toHaveAttribute('src', '/images/drivers/ricciardo.png');
  await expect(hero.locator('.driver-profile-portrait.is-fallback')).toBeVisible();
  await expect(hero.locator('.driver-profile-kicker')).toContainText('Racing Bulls');
  await expect(page.getByRole('heading', { name: '历史生涯概览' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await hero.screenshot({ path: `artifacts/browser-qa/screenshots/archive-driver-hero-${testInfo.project.name}.png` });
});
