import { expect, test, type Page } from '@playwright/test';

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

const prediction = {
  run_id: '7f078598-828a-4f50-99fb-3224805f027d',
  season: 2026,
  round: 13,
  race_name: 'Italian Grand Prix',
  phase: 'post_quali',
  model_version: 'winner-linear-head-2026-09-04',
  generated_at: new Date().toISOString(),
  data_cutoff_at: new Date().toISOString(),
  candidates: [
    {
      driver_id: 'kimi_antonelli',
      constructor_id: 'mercedes',
      rank: 1,
      probability: 0.48,
      factors: [
        { feature: 'qualifyingPole', contribution: 0.34 },
        { feature: 'driverRecentWinRate', contribution: 0.21 },
      ],
    },
    {
      driver_id: 'max_verstappen',
      constructor_id: 'red_bull',
      rank: 2,
      probability: 0.31,
      factors: [
        { feature: 'gridFrontRow', contribution: 0.27 },
        { feature: 'constructorRecentWinRate', contribution: 0.18 },
      ],
    },
    {
      driver_id: 'lando_norris',
      constructor_id: 'mclaren',
      rank: 3,
      probability: 0.14,
      factors: [
        { feature: 'gridTop3', contribution: 0.22 },
        { feature: 'driverStandingAdvantage', contribution: 0.16 },
      ],
    },
  ],
};

async function installPredictionFixtures(page: Page) {
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
      body: pathname.endsWith('/race_prediction_current') ? JSON.stringify([prediction]) : '[]',
    });
  });
  await page.route('**/fastf1/**', async (requestRoute) => {
    await requestRoute.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

test('winner prediction is readable and responsive on home and race info', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  await installPredictionFixtures(page);

  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Kimi Antonelli/ })).toContainText('48%');
  await expect(page.getByRole('button', { name: /Kimi Antonelli/ })).toContainText('排位赛后');

  await page.goto('/races/13/info?season=2026', { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: '冠军预测' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toContainText('Kimi Antonelli');
  await expect(panel).toContainText('Max Verstappen');
  await expect(panel).toContainText('Lando Norris');
  await expect(panel).toContainText('概率反映模型对当前数据的判断');

  const headingCopyFits = await panel.locator('.race-info-section-heading small').evaluate((element) => (
    element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight
  ));
  expect(headingCopyFits, `prediction heading copy clipping in ${testInfo.project.name}`).toBe(true);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);
  const unexpectedBrowserErrors = browserErrors.filter((message) => (
    !message.includes('Failed to load resource: the server responded with a status of 404')
  ));
  expect(unexpectedBrowserErrors, `console/page errors in ${testInfo.project.name}`).toEqual([]);
  expect(failedRequests, `failed network requests in ${testInfo.project.name}`).toEqual([]);

  await panel.screenshot({
    path: `artifacts/browser-qa/screenshots/race-prediction-${testInfo.project.name}.png`,
  });
});
