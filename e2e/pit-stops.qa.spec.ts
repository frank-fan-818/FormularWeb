import { expect, test } from '@playwright/test';
import { enterAsGuest } from './auth-fixtures';

const race = { season: '2025', round: '4', raceName: 'Bahrain Grand Prix', date: '2025-04-13', time: '15:00:00Z', Circuit: { circuitId: 'bahrain', circuitName: 'Bahrain International Circuit', Location: { locality: 'Sakhir', country: 'Bahrain', lat: '26', long: '50' } } };
const base = { season: '2025', updatedAt: '2026-10-25T07:00:00.000Z', stale: false };
const seasonFastest = [
  { id: '1', rank: 1, driver: 'Oscar Piastri', team: 'McLaren', event: 'Autodromo Nazionale Monza', eventAbbreviation: 'ITA', duration: '1.91' },
  { id: '2', rank: 2, driver: 'Charles Leclerc', team: 'Ferrari', event: 'Circuit de Monaco', eventAbbreviation: 'MON', duration: '2.00' },
  { id: '3', rank: 3, driver: 'Charles Leclerc', team: 'Ferrari', event: 'Jeddah Corniche Circuit', eventAbbreviation: 'SAU', duration: '2.00' },
];
const award = { ...base, seasons: [2026, 2025, 2024], source: 'https://inmotion.dhl/en/formula-1/fastest-pit-stop-award', standings: [{ rank: 1, team: 'Ferrari', points: 559 }, { rank: 2, team: 'McLaren', points: 410 }], stops: [], seasonFastest };
const event = { ...award, standings: [], stops: [{ id: '7362', rank: 1, driver: 'Lewis Hamilton', code: 'HAM', team: 'Ferrari', duration: '2.16', lap: 32, points: 25, irregular: false, notes: '' }] };
const records = [{ driverId: 'hamilton', driver: 'Lewis Hamilton', code: 'HAM', team: 'Ferrari', constructorId: 'ferrari', lap: 32, stop: 1, laneDuration: '24.229', stopDuration: '2.16', laneSource: 'Jolpica', stopSource: 'OpenF1' }, { driverId: 'norris', driver: 'Lando Norris', code: 'NOR', team: 'McLaren', constructorId: 'mclaren', lap: 34, stop: 1, laneDuration: '25.265', stopDuration: null, laneSource: 'Jolpica', stopSource: null }];

test.beforeEach(async ({ page }) => {
  await enterAsGuest(page);
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'zh-CN'));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const result = { number:'44',position:'1',positionText:'1',points:'25',grid:'1',laps:'57',status:'Finished',Driver:{driverId:'hamilton',code:'HAM',givenName:'Lewis',familyName:'Hamilton',nationality:'British',dateOfBirth:'1985-01-07'},Constructor:{constructorId:'ferrari',name:'Ferrari',nationality:'Italian'} };
    const calendar = Array.from({length:4}, (_,index) => ({...race,round:String(index+1)}));
    const entries = /qualifying|sprint|practice/.test(path) ? [] : path.endsWith('/results.json') ? [{...race,Results:[result]}] : calendar;
    return route.fulfill({ json: { MRData: { total: String(entries.length), RaceTable: { Races: entries }, SeasonTable: { Seasons: [{ season: '2025' }] }, StandingsTable: { StandingsLists: [] } } } });
  });
  await page.route('**/api/pit-stops?**', route => {
    const query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: query.get('kind') === 'race' ? { ...base, records } : query.has('round') ? event : award });
  });
});

test('pit stops support guest standings, deep links, precise timing and compact layouts', async ({ page }, info) => {
  const errors: string[] = []; const failures: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (['warning','error'].includes(message.type()) && !message.text().includes('Service Worker registration blocked')) errors.push(message.text()); });
  page.on('requestfailed', req => { if (req.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(req.url()); });
  await page.goto('/pit-stops?season=2025');
  await expect(page.getByRole('heading', { name: 'DHL Pit Stop Award' })).toBeVisible();
  await expect(page.locator('.pit-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.pit-table tbody tr').first()).toContainText('559');
  await expect(page.getByRole('button', { name: '赛季换胎积分', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/pit-season-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: '赛季最快换胎', exact: true }).click();
  await expect(page).toHaveURL(/view=fastest/);
  await expect(page.locator('.pit-fastest-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.pit-fastest-table tbody tr').first()).toContainText('Oscar Piastri');
  await expect(page.locator('.pit-fastest-table tbody tr').first()).toContainText('1.91 s');
  await expect(page.locator('.pit-fastest-table tbody tr').nth(1)).toContainText('2.00 s');
  await expect(page.locator('.pit-fastest-table tbody tr').nth(2).locator('td').first()).toHaveText('3');
  await expect(page.getByRole('combobox', { name: '分站赛事', exact: true })).toHaveCount(0);
  const tabTops = await page.locator('.pit-view-tabs button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
  expect(Math.max(...tabTops) - Math.min(...tabTops)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/pit-fastest-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '单站最快进站' }).click();
  await expect(page.locator('.pit-award-table')).toContainText('2.16 s');
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/pit-event-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: '进站明细 →', exact: true }).click();
  const module = page.locator('.pit-module');
  await expect(module.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('#race-pit-title')).toBeInViewport();
  await expect(module).toContainText('24.229 s');
  await expect(module).toContainText('—');
  await expect(module.getByText(/已收录|记录数|中位数/)).toHaveCount(0);
  await module.getByRole('combobox', { name: '车手', exact: true }).selectOption('hamilton');
  await expect(module.locator('tbody tr')).toHaveCount(1);
  await module.getByRole('combobox', { name: '车手', exact: true }).selectOption('');
  await module.getByRole('combobox', { name: '排序', exact: true }).selectOption('stop');
  await expect(module.locator('tbody tr').last()).toContainText('NOR');
  await module.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/pit-records-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await module.getByRole('link', { name: 'DHL 榜单 →' }).click();
  await expect(page).toHaveURL(/view=event/);
  await expect(page.locator('.pit-award-table')).toContainText('2.16 s');
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test('season fastest supports direct links, season changes and an independent empty state', async ({ page }) => {
  const requestedRounds: boolean[] = [];
  await page.route('**/api/pit-stops?**', route => {
    const query = new URL(route.request().url()).searchParams;
    requestedRounds.push(query.has('round'));
    return route.fulfill({ json: { ...award, season: query.get('season'), seasonFastest: query.get('season') === '2024' ? [] : seasonFastest } });
  });
  await page.goto('/pit-stops?season=2025&view=fastest&round=4');
  await expect(page.getByRole('button', { name: '赛季最快换胎', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pit-fastest-table')).toContainText('1.91 s');
  expect(requestedRounds[0]).toBe(false);
  await page.getByRole('combobox', { name: '赛季', exact: true }).selectOption('2024');
  await expect(page).toHaveURL(/season=2024&view=fastest$/);
  await expect(page.getByText('暂无已发布数据', { exact: true })).toBeVisible();
  await expect(page.locator('.pit-fastest-table')).toHaveCount(0);
  await page.getByRole('button', { name: '赛季换胎积分', exact: true }).click();
  await expect(page.locator('.pit-table')).toContainText('559');
});

test('DHL standings, season fastest and event stops update while the page stays open', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T06:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let overviewCalls = 0; let eventCalls = 0;
  await page.route('**/api/pit-stops?**', route => {
    const eventView = new URL(route.request().url()).searchParams.has('round');
    if (eventView) {
      eventCalls++;
      return route.fulfill({ json: { ...event, stops: event.stops.map(row => ({ ...row, duration: eventCalls > 1 ? '2.10' : '2.16' })) } });
    }
    overviewCalls++;
    return route.fulfill({ json: { ...award, standings: [{ rank: 1, team: 'Ferrari', points: 559 + (overviewCalls - 1) * 25 }],
      seasonFastest: seasonFastest.map((row, i) => i === 0 ? { ...row, duration: overviewCalls > 2 ? '1.88' : overviewCalls > 1 ? '1.89' : '1.91' } : row) } });
  });
  await page.goto('/pit-stops?season=2025');
  await expect(page.locator('.pit-table')).toContainText('559');
  await page.clock.runFor(300_000);
  await expect(page.locator('.pit-table')).toContainText('584');
  await page.getByRole('button', { name: '赛季最快换胎', exact: true }).click();
  await expect(page.locator('.pit-fastest-table')).toContainText('1.89 s');
  await page.clock.runFor(300_000);
  await expect(page.locator('.pit-fastest-table')).toContainText('1.88 s');
  await page.getByRole('button', { name: '单站最快进站', exact: true }).click();
  await expect(page.locator('.pit-award-table')).toContainText('2.16 s');
  await page.clock.runFor(300_000);
  await expect(page.locator('.pit-award-table')).toContainText('2.10 s');
  expect(overviewCalls).toBe(3);
  expect(eventCalls).toBe(2);
});

test('pit stops distinguish loading, empty data, and errors with retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/pit-stops?**', async route => {
    calls++;
    if (calls === 1) { await new Promise(resolve => setTimeout(resolve, 600)); return route.fulfill({ json: { ...award, standings: [] } }); }
    return route.fulfill({ json: award });
  });
  await page.goto('/pit-stops?season=2025');
  await expect(page.getByText('正在加载进站数据', { exact: true })).toBeVisible();
  await expect(page.getByText('暂无已发布数据', { exact: true })).toBeVisible();
  await page.route('**/api/pit-stops?**', route => route.fulfill({ status: 502, json: { code: 'UPSTREAM_ERROR', message: 'Unavailable' } }));
  await page.goto('/pit-stops?season=2024');
  await expect(page.getByText('进站数据加载失败', { exact: true })).toBeVisible();
  await page.route('**/api/pit-stops?**', route => route.fulfill({ json: { ...award, season: '2024' } }));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.pit-table tbody tr')).toHaveCount(2);
});
