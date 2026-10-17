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
        { feature: 'driverRecentReliability', contribution: -0.12 },
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
    ...[
      'george_russell', 'charles_leclerc', 'lewis_hamilton', 'oscar_piastri', 'fernando_alonso',
      'lance_stroll', 'carlos_sainz', 'alex_albon', 'pierre_gasly', 'franco_colapinto',
      'esteban_ocon', 'oliver_bearman', 'liam_lawson', 'arvid_lindblad', 'nico_hulkenberg',
      'gabriel_bortoleto', 'sergio_perez', 'valtteri_bottas', 'jack_doohan',
    ].map((driverId, index) => ({
      driver_id: driverId, constructor_id: index === 0 ? 'mercedes' : 'test_team', rank: index + 4,
      probability: index === 18 ? 0.00004 : (0.07 - 0.00004) / 18,
      factors: index === 0 ? [{ feature: 'driverRecentPodiumRate', contribution: 0.1 }] : [],
    })),
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
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', async (requestRoute) => {
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
  await page.getByRole('button', { name: /Kimi Antonelli/ }).click();
  await expect(page.getByRole('dialog', { name: '夺冠概率与预测依据' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('list', { name: '全部已发布车手夺冠概率' }).locator(':scope > li')).toHaveCount(22);
  await expect.poll(() => page.getByRole('dialog').evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/races/13/info?season=2026', { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('region', { name: '冠军预测' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toContainText('Kimi Antonelli');
  await expect(panel).toContainText('Max Verstappen');
  await expect(panel).toContainText('Lando Norris');
  await expect(panel).not.toContainText('qualifyingPole');
  await expect(panel).not.toContainText(prediction.model_version);
  await expect(panel.locator('time, .ant-tag')).toHaveCount(0);
  await panel.screenshot({ path: `artifacts/browser-qa/screenshots/race-prediction-${testInfo.project.name}.png` });
  const favourite = panel.getByRole('button', { name: /Kimi Antonelli/ });
  await favourite.click();
  const dialog = page.getByRole('dialog', { name: '夺冠概率与预测依据' });
  await expect(dialog).toBeVisible();
  const roster = dialog.getByRole('list', { name: '全部已发布车手夺冠概率' });
  await expect(roster.locator(':scope > li')).toHaveCount(22);
  await expect(roster.getByRole('button', { name: /Kimi Antonelli/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByText('排位赛杆位', { exact: true })).toBeVisible();
  await expect(dialog.getByText('车手近期完赛可靠性', { exact: true })).toBeVisible();
  await expect(dialog.getByText('不利因素', { exact: true })).toBeVisible();
  await dialog.screenshot({ path: `artifacts/browser-qa/screenshots/prediction-details-${testInfo.project.name}.png`, animations: 'disabled' });
  await roster.getByRole('button', { name: /George Russell/ }).click();
  await expect(dialog.getByText('车手近期领奖台率', { exact: true })).toBeVisible();
  await expect(roster.getByRole('button', { name: /Kimi Antonelli/ })).toHaveAttribute('aria-expanded', 'false');
  const lastDriver = roster.getByRole('button', { name: /Jack Doohan/ });
  await expect(lastDriver).toContainText('<0.1%');
  await lastDriver.click();
  await expect(roster.locator('.is-expanded').getByText('本次发布未提供该车手的具体评分因素，暂时无法展示预测依据。')).toBeVisible();
  await dialog.locator('summary').click();
  await expect(dialog.getByText(prediction.model_version)).toBeVisible();
  const detailsOverflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(detailsOverflow).toBeLessThanOrEqual(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(favourite).toBeFocused();
  await panel.getByRole('button', { name: '查看全部概率与依据 →' }).click();
  await expect(dialog).toBeVisible();
  await expect(roster.getByRole('button', { name: /Kimi Antonelli/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.getByText('排位赛杆位', { exact: true })).toBeInViewport();
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow in ${testInfo.project.name}`).toBeLessThanOrEqual(1);
  const unexpectedBrowserErrors = browserErrors.filter((message) => (
    !message.includes('Failed to load resource: the server responded with a status of 404')
  ));
  expect(unexpectedBrowserErrors, `console/page errors in ${testInfo.project.name}`).toEqual([]);
  expect(failedRequests, `failed network requests in ${testInfo.project.name}`).toEqual([]);

});

test('prediction details follow dark theme and preserve stale-data context', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
    version: 3, state: { currentSeason: '2026', theme: 'dark', sidebarCollapsed: false, features: {} },
  })));
  await installPredictionFixtures(page);
  await page.route('**/rest/v1/race_prediction_current?**', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify([{ ...prediction, generated_at: '2026-01-01T00:00:00Z' }]),
  }));
  await page.goto('/races/13/info?season=2026');
  const panel = page.getByRole('region', { name: '冠军预测' });
  await expect(panel.getByText('数据待更新')).toBeVisible();
  await panel.getByRole('button', { name: /Max Verstappen/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('头排发车', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/数据待更新/)).toBeVisible();
  await dialog.screenshot({ path: `artifacts/browser-qa/screenshots/prediction-details-dark-${testInfo.project.name}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('prediction handles loading, empty data and service failures with retry', async ({ page }) => {
  await installPredictionFixtures(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/rest/v1/race_prediction_current?**', async route => {
    await pending;
    await route.fulfill({ contentType: 'application/json', body: '[]' });
  });
  await page.goto('/races/13/info?season=2026');
  const panel = page.getByRole('region', { name: '冠军预测' });
  await expect(panel.locator('.ant-card-loading')).toBeVisible();
  release();
  await expect(panel.getByText('等待可用的赛前数据')).toBeVisible();
  await expect(panel.getByRole('button', { name: '查看全部概率与依据 →' })).toHaveCount(0);
  await page.route('**/rest/v1/race_prediction_current?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.reload();
  await expect(panel.getByRole('alert')).toContainText('预测服务暂时不可用');
  await page.route('**/rest/v1/race_prediction_current?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([prediction]) }));
  await panel.getByRole('button', { name: '重试预测' }).click();
  await expect(panel.getByRole('button', { name: /Kimi Antonelli/ })).toBeVisible();
});
