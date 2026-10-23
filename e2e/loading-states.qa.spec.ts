import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test.beforeEach(async ({ page }) => { await enterAsMember(page); });

test('race calendar loading state is responsive and motion-safe', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/f1-api/**', async (requestRoute) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await requestRoute.abort('timedout');
  });

  await page.goto('/races', { waitUntil: 'domcontentloaded' });
  const beacon = page.getByRole('status', { name: /Synchronising race calendar/i });
  await expect(beacon).toBeVisible();
  await expect(beacon).toHaveAttribute('data-loading-variant', 'panel');

  const dimensions = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(beacon.locator('.loading-indicator')).toHaveCSS('animation-name', 'none');

  await page.screenshot({
    path: `artifacts/browser-qa/screenshots/loading-races-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

for (const path of ['/', '/seasons', '/drivers/max_verstappen', '/constructors/mercedes', '/history/drivers/max_verstappen', '/history/constructors/mercedes']) {
  test(`compact content loading replaces skeletons on ${path}`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/f1-api/**', async route => {
      await held;
      await route.fulfill({ json: { MRData: { total: '0', RaceTable: { Races: [] },
        DriverTable: { Drivers: [] }, ConstructorTable: { Constructors: [] },
        SeasonTable: { Seasons: [] }, StandingsTable: { StandingsLists: [] } } } });
    });
    await page.route('**/rest/v1/**', async route => { await held; await route.fulfill({ json: [] }); });
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const loading = page.locator('.timing-beacon').first();
      await expect(loading).toBeVisible();
      await expect(loading).toHaveAttribute('aria-label', /.+/);
      await expect(loading.locator('.loading-indicator')).toHaveCSS('animation-name', 'loading-indicator-turn');
      await expect(page.locator('.ant-skeleton, [class*="skeleton"], .timing-beacon__stages')).toHaveCount(0);
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/loading-${path.replaceAll('/', '-') || 'home'}-${info.project.name}.png`, animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      release();
      await expect(page.locator('.timing-beacon')).toHaveCount(0);
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}

test('race weekend modules use compact motion-safe loaders and finish without skeletons', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const race = { season: '2026', round: '1', raceName: 'Italian Grand Prix', date: '2099-09-06', time: '13:00:00Z',
    Circuit: { circuitId: 'monza', circuitName: 'Autodromo Nazionale di Monza',
      Location: { locality: 'Monza', country: 'Italy', lat: '45.6156', long: '9.28111' } } };
  await page.route('**/f1-api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const isRaceInfo = /\/2026(?:\/1)?\.json$/.test(pathname);
    return route.fulfill({ json: { MRData: { total: isRaceInfo ? '1' : '0',
      RaceTable: { Races: isRaceInfo ? [race] : [] }, SeasonTable: { Seasons: [] }, StandingsTable: { StandingsLists: [] } } } });
  });
  await page.route('**/rest/v1/**', async route => { await held; await route.fulfill({ json: [] }); });
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', route => route.fulfill({ status: 404, json: {} }));
  try {
    await page.goto('/races/1/info?season=2026');
    const prediction = page.locator('.race-prediction-card');
    const history = page.locator('.race-history-brief');
    await expect(prediction.getByRole('status', { name: '正在加载冠军预测' })).toBeVisible();
    await expect(history.locator('.loading-indicator')).toBeVisible();
    await expect(prediction.locator('.loading-indicator')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.ant-skeleton, .timing-beacon__track, .timing-beacon__stages')).toHaveCount(0);
    await prediction.scrollIntoViewIfNeeded();
    for (const theme of ['light-mode', 'dark-mode']) {
      await page.evaluate(value => {
        document.documentElement.classList.remove('light-mode', 'dark-mode');
        document.documentElement.classList.add(value);
      }, theme);
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/loading-weekend-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
    }
    release();
    await expect(prediction.getByRole('status')).toHaveCount(0);
    await expect(prediction).toContainText('等待可用的赛前数据');
    await expect(history.locator('.timing-beacon')).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
