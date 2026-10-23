import { expect, test } from '@playwright/test';
import { enterAsGuest } from './auth-fixtures';

const driver = { driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', code: 'VER',
  permanentNumber: '1', url: '#', nationality: 'Dutch', dateOfBirth: '1997-09-30' };
const constructor = { constructorId: 'red_bull', name: 'Red Bull', nationality: 'Austrian', url: '#' };
const race = { season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08', time: '04:00:00Z',
  Qualifying: { date: '2026-03-07', time: '05:00:00Z' },
  Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park', url: '#',
    Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.85', long: '144.97' } } };
const result = { Driver: driver, Constructor: constructor, position: '1', positionText: '1', number: '1',
  points: '25', grid: '1', laps: '58', status: 'Finished', Time: { time: '1:20:00', millis: '4800000' } };
const qualifying = { Driver: driver, Constructor: constructor, position: '1', number: '1', Q1: '1:17.000', Q2: '1:16.000', Q3: '1:15.000' };

for (const heldSession of ['qualifying', 'results'] as const) {
  test(`race classification paints while ${heldSession} is held`, async ({ page }, info) => {
    await enterAsGuest(page);
    await page.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'zh-CN');
      localStorage.setItem('f1-dashboard-storage', JSON.stringify({ version: 3, state: { currentSeason: '2026', theme: 'light', features: {} } }));
    });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const errors: string[] = [];
    const failures: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type()) && !message.text().includes('Service Worker registration blocked by Playwright')) errors.push(message.text());
    });
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
    await page.route('**/f1-api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const isRace = path.endsWith('/results.json');
      const isQualifying = path.endsWith('/qualifying.json');
      if (path.endsWith(`/${heldSession}.json`)) await held;
      await route.fulfill({ json: { MRData: {
        total: '1', SeasonTable: { Seasons: [{ season: '2026' }] },
        RaceTable: { Races: [{ ...race, ...(isRace ? { Results: [result] } : {}), ...(isQualifying ? { QualifyingResults: [qualifying] } : {}) }] },
      } } });
    });
    try {
      await page.goto('/races/1/results?season=2026');
      const table = page.locator('.race-classification-shell');
      if (heldSession === 'results') await page.getByRole('tab', { name: 'Q 排位赛', exact: true }).click();
      await expect(table.locator('.ant-tabs-tabpane-active .ant-table-row')).toHaveCount(1);
      await expect(table.locator('.ant-tabs-tabpane-active .ant-spin-spinning')).toHaveCount(0);
      await expect(table).toContainText('Verstappen');
      if (heldSession === 'results') {
        await expect(page.getByRole('heading', { name: '正在获取正赛成绩', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: '正赛结果尚未发布', exact: true })).toHaveCount(0);
      }
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/race-progressive-${heldSession}-${info.project.name}.png`, animations: 'disabled' });
      const heldTab = page.getByRole('tab', { name: heldSession === 'results' ? 'R 正赛' : 'Q 排位赛', exact: true });
      await heldTab.click();
      await expect(table.locator('.ant-tabs-tabpane-active .ant-spin-spinning')).toBeVisible();
      release();
      await expect(table.locator('.ant-tabs-tabpane-active .ant-table-row')).toHaveCount(1);
      await expect(table.locator('.ant-spin-spinning')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}
