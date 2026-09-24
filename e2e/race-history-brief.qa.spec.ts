import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test.beforeEach(async ({ page }) => { await enterAsMember(page); });

const race = {
  season: '2026',
  round: '13',
  raceName: 'Italian Grand Prix',
  date: '2099-09-06',
  time: '13:00:00Z',
  Circuit: {
    circuitId: 'monza',
    circuitName: 'Autodromo Nazionale di Monza',
    Location: {
      locality: 'Monza',
      country: 'Italy',
      lat: '45.6156',
      long: '9.28111',
    },
  },
  FirstPractice: { date: '2099-09-04', time: '11:30:00Z' },
  SecondPractice: { date: '2099-09-04', time: '15:00:00Z' },
  ThirdPractice: { date: '2099-09-05', time: '10:30:00Z' },
  Qualifying: { date: '2099-09-05', time: '14:00:00Z' },
};

const races = Array.from({ length: 5 }, (_, index) => ({
  id: 500 + index, season: 2025 - index, round: 16, race_name: 'Italian Grand Prix', circuit_id: 'monza', date: `${2025 - index}-09-07`,
}));
const historyRows: Record<string, unknown[]> = {
  races,
  race_results: races.flatMap((race) => ['max_verstappen', 'norris', 'piastri'].map((driver, index) => ({ race_id: race.id, driver_id: driver, position: index + 1, constructor_id: index === 0 ? 'red_bull' : 'mclaren' }))),
  qualifying_results: races.map((race) => ({ race_id: race.id, driver_id: 'norris', position: 1, constructor_id: 'mclaren' })),
  drivers: [{ driver_id: 'max_verstappen', first_name: 'Max', last_name: 'Verstappen' }, { driver_id: 'norris', first_name: 'Lando', last_name: 'Norris' }, { driver_id: 'piastri', first_name: 'Oscar', last_name: 'Piastri' }],
  fastf1_session_analytics: races.map((race, index) => ({ season: race.season, round: race.round, payload: { eventName: 'Italian Grand Prix', trackStatusPeriods: (index < 2 ? ['SC', 'VSC', 'RED', 'YELLOW'] : ['YELLOW']).map(type => ({ type })) } })),
};

async function installHistoryFixtures(page: Page) {
  await page.route('**/f1-api/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    const isSeasonCalendar = pathname.endsWith('/2026.json');
    const isUnfinishedSession = pathname.endsWith('/results.json') || pathname.endsWith('/qualifying.json');
    const races = isSeasonCalendar
      ? [
        ...Array.from({ length: 12 }, (_, index) => ({
          ...race,
          round: String(index + 1),
          raceName: `Completed Grand Prix ${index + 1}`,
          date: `2026-${String(Math.min(index + 1, 8)).padStart(2, '0')}-01`,
        })),
        race,
      ]
      : isUnfinishedSession ? [] : [race];
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: String(races.length),
          RaceTable: { season: '2026', round: '13', Races: races },
          StandingsTable: { StandingsLists: [] },
          SeasonTable: { Seasons: [{ season: '2026' }] },
        },
      }),
    });
  });
  await page.route('**/rest/v1/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(historyRows[pathname.split('/').pop() || ''] || []),
    });
  });
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', async (requestRoute) => {
    await requestRoute.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test('history brief keeps results, risks and expanded samples readable', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
  page.on('requestfailed', request => failures.push(request.url()));
  await installHistoryFixtures(page);
  await page.goto('/races/13/info?season=2026');
  const panel = page.locator('.race-history-brief');
  await expect(panel.locator('.history-risk-row')).toHaveCount(4);
  await panel.scrollIntoViewIfNeeded();
  await expect(panel.locator('.history-results-table .ant-table-row')).toHaveCount(5);
  await expect(panel.locator('.history-risk-row.risk-sc')).toContainText('40%');
  expect(await panel.locator('.ant-table-content').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await expect(panel.locator('.history-samples')).not.toHaveAttribute('open', '');
  await panel.screenshot({ style: '.header, .race-subpage-tabs { visibility: hidden !important; }', path: `artifacts/browser-qa/screenshots/history-brief-${testInfo.project.name}.png` });
  await panel.locator('summary').click();
  await expect(panel.locator('.history-sample')).toHaveCount(5);
  for (const sample of await panel.locator('.history-sample').all()) {
    expect(await sample.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await panel.screenshot({ style: '.header, .race-subpage-tabs { visibility: hidden !important; }', path: `artifacts/browser-qa/screenshots/history-samples-${testInfo.project.name}.png` });
  await panel.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(panel.locator('.history-samples')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('history brief explains missing results and unknown status frequencies', async ({ page }) => {
  await installHistoryFixtures(page);
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.goto('/races/13/info?season=2026');
  const panel = page.locator('.race-history-brief');
  await expect(panel.locator('.history-risk-row')).toHaveCount(4);
  await expect(panel.locator('.history-results .race-weekend-empty')).toBeVisible();
  await expect(panel.locator('.history-risk-row').first()).toContainText('数据不足');
  await expect(panel.locator('.history-risk-row').first()).not.toContainText('0%');
  await panel.locator('summary').click();
  await expect(panel.locator('.history-samples .race-weekend-empty')).toBeVisible();
});

test('weekend schedule uses one surface with readable circuit facts', async ({ page }, testInfo) => {
  await installHistoryFixtures(page);
  await page.goto('/races/13/info?season=2026');
  const panel = page.locator('.weekend-brief');
  await expect(panel.locator('.weekend-session')).toHaveCount(5);
  await expect(panel.getByRole('heading', { name: '周末时间表' })).toHaveCount(1);
  await expect(panel.locator('.weekend-circuit-strip')).toContainText('4L / 7R');
  await expect(panel.locator('.ant-card')).toHaveCount(0);
  for (const item of await panel.locator('.weekend-session').all()) {
    expect(await item.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await panel.screenshot({ style: '.header, .race-subpage-tabs, .race-subpage-tabs * { visibility: hidden !important; }', path: `artifacts/browser-qa/screenshots/weekend-brief-${testInfo.project.name}.png` });
});
