import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const race = {
  season: '2026', round: '1', raceName: 'Singapore Grand Prix', date: '2026-11-01', time: '20:00:00Z',
  Circuit: { circuitId: 'marina_bay', circuitName: 'Marina Bay Street Circuit',
    Location: { locality: 'Singapore', country: 'Singapore', lat: '1.29', long: '103.86' } },
  FirstPractice: { date: '2026-11-01', time: '15:30:00Z' },
  SecondPractice: { date: '2026-11-01', time: '18:00:00Z' },
  Qualifying: { date: '2026-11-01', time: '19:00:00Z' },
};

test.beforeEach(async ({ page }) => {
  await enterAsMember(page);
  await page.clock.setFixedTime(new Date('2026-10-20T04:00:00Z'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('i18nextLng')) localStorage.setItem('i18nextLng', 'zh-CN');
    if (!localStorage.getItem('f1-dashboard-storage')) {
      localStorage.setItem('f1-dashboard-storage', JSON.stringify({ version: 3, state: {
        currentSeason: '2026', theme: 'light', sidebarCollapsed: false, features: {},
      } }));
    }
  });
  await page.route('**/f1-api/**', route => {
    const session = /\/(results|qualifying|sprint)\.json$/.test(new URL(route.request().url()).pathname);
    return route.fulfill({ json: { MRData: { total: session ? '0' : '1',
      RaceTable: { Races: session ? [] : [race] }, StandingsTable: { StandingsLists: [] },
      SeasonTable: { Seasons: [{ season: '2026' }] } } } });
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', route => route.fulfill({ status: 404, json: {} }));
});

async function chooseOffset(page: Page, label: string, accessibleName = '时区') {
  const select = page.getByRole('combobox', { name: accessibleName, exact: true });
  await select.fill(label);
  await page.locator('.ant-select-dropdown').getByText(label, { exact: true }).click();
}

test('time zone setting updates race times and day groups across navigation and reloads', async ({ page }, info) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });

  await page.goto('/races/1/info?season=2026');
  const start = page.locator('.race-command-start');
  await expect(start).toContainText('2026-11-02 04:00 UTC+8');
  await expect(page.locator('.weekend-time-toggle')).toContainText('UTC+8');
  await expect(page.locator('.weekend-schedule-day')).toHaveCount(2);

  await page.goto('/settings');
  await chooseOffset(page, 'UTC+0');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('f1-dashboard-storage')!).state.timeZoneOffsetMinutes)).toBe(0);
  await page.locator('.settings-card').first().screenshot({ path: `artifacts/browser-qa/screenshots/time-zone-settings-${info.project.name}.png`, animations: 'disabled',
    style: '.header { visibility: hidden !important; }' });

  await page.goto('/races/1/info?season=2026');
  await expect(start).toContainText('2026-11-01 20:00 UTC+0');
  await expect(page.locator('.weekend-time-toggle')).toContainText('UTC+0');
  await expect(page.locator('.weekend-schedule-day')).toHaveCount(1);
  await expect(page.locator('.weekend-session-time')).toHaveText(['15:30', '18:00', '19:00', '20:00']);
  await page.reload();
  await expect(start).toContainText('2026-11-01 20:00 UTC+0');
  await page.locator('.race-command').screenshot({ path: `artifacts/browser-qa/screenshots/time-zone-race-${info.project.name}.png`, animations: 'disabled',
    style: '.header { visibility: hidden !important; }' });

  await page.goto('/');
  await expect(page.locator('.home-command-lead time')).toContainText('2026-11-01 20:00 UTC+0');
  await expect(page.locator('.home-weekend-heading')).toContainText('UTC+0');
  await page.goto('/races');
  await expect(page.locator('.race-calendar-date').first()).toContainText('11-01 20:00 UTC+0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('time zone selector supports fractional and negative offsets in English', async ({ page }) => {
  await page.goto('/settings');
  const language = page.locator('.setting-row').filter({ hasText: '语言' }).getByRole('combobox');
  await language.focus();
  await page.keyboard.press('ArrowDown');
  await page.locator('.ant-select-dropdown').getByText('English', { exact: true }).click();
  await chooseOffset(page, 'UTC+5:45', 'Time zone');
  await page.goto('/races/1/info?season=2026');
  await expect(page.locator('.race-command-start')).toContainText('2026-11-02 01:45 UTC+5:45');
  await expect(page.locator('.weekend-time-toggle')).toContainText('UTC+5:45');
  await page.goto('/settings');
  await chooseOffset(page, 'UTC-5', 'Time zone');
  await page.goto('/races/1/info?season=2026');
  await expect(page.locator('.race-command-start')).toContainText('2026-11-01 15:00 UTC-5');
});
