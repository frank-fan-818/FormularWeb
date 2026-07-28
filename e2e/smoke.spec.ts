import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/races',
  '/races/1',
  '/drivers/max_verstappen',
  '/constructors/red_bull',
  '/circuits/monaco',
  '/login',
  '/privacy',
  '/settings',
  '/route-that-does-not-exist',
];
const compactViewportRoutes = new Set([
  '/',
  '/races/1',
  '/login',
  '/privacy',
  '/settings',
  '/route-that-does-not-exist',
]);

for (const route of routes) {
  test(`${route} renders without a browser error`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium' && !compactViewportRoutes.has(route),
      'Detailed data routes are covered on desktop; compact viewports focus on changed and critical flows.',
    );
    const browserErrors: string[] = [];
    const failedAppAssets: string[] = [];

    await page.route('**/f1-api/**', async (requestRoute) => {
      await requestRoute.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          MRData: {
            total: '0',
            RaceTable: { Races: [] },
            SeasonTable: { Seasons: [] },
            StandingsTable: { StandingsLists: [] },
          },
        }),
      });
    });

    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('requestfailed', (request) => {
      const url = new URL(request.url());
      if (url.origin !== 'http://127.0.0.1:4173') return;
      if (!['document', 'script', 'stylesheet', 'font'].includes(request.resourceType())) return;
      failedAppAssets.push(`${request.resourceType()}: ${url.pathname}`);
    });

    const response = await page.goto(route, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });
    expect(response?.status(), `navigation status for ${route}`).toBeLessThan(500);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('页面加载失败')).toHaveCount(0);
    await page.waitForTimeout(300);

    if (testInfo.project.name !== 'desktop-chromium') {
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontalOverflow, `horizontal overflow on ${route}`).toBeLessThanOrEqual(1);
    }

    if (['/', '/login', '/route-that-does-not-exist'].includes(route)) {
      await page.screenshot({
        path: testInfo.outputPath(`${route === '/' ? 'home' : route.slice(1)}.png`),
        fullPage: true,
      });
    }

    expect(failedAppAssets, `failed first-party assets on ${route}`).toEqual([]);
    expect(browserErrors, `console/page errors on ${route}`).toEqual([]);
  });
}

test('global search navigates to every supported entity type', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The interaction is viewport-independent.');

  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.route('**/f1-api/**', async (requestRoute) => {
    const requestUrl = new URL(requestRoute.request().url());
    const hasDriverRaceResults = requestUrl.pathname.endsWith('/drivers/max_verstappen/results.json');
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: hasDriverRaceResults ? '1' : '0',
          RaceTable: {
            Races: hasDriverRaceResults
              ? [{
                season: '2026',
                round: '1',
                raceName: 'Australian Grand Prix',
                Results: [{ points: '25' }],
              }]
              : [],
          },
          SeasonTable: { Seasons: [] },
          StandingsTable: { StandingsLists: [] },
        },
      }),
    });
  });
  await page.route('**/rest/v1/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    const rows = pathname.endsWith('/drivers')
      ? [{
        driver_id: 'max_verstappen',
        permanent_number: '1',
        first_name: 'Max',
        last_name: 'Verstappen',
        code: 'VER',
        date_of_birth: '1997-09-30',
        nationality: 'Dutch',
        total_wins: 65,
        total_podiums: 117,
        total_pole_positions: 44,
        total_fastest_laps: 35,
        total_race_starts: 225,
      }]
      : pathname.endsWith('/constructors')
        ? [{ constructor_id: 'red_bull', name: 'Red Bull', nationality: 'Austrian' }]
        : pathname.endsWith('/circuits')
          ? [{
            circuit_id: 'monaco',
            name: 'Circuit de Monaco',
            locality: 'Monte-Carlo',
            country: 'Monaco',
          }]
          : pathname.endsWith('/races')
            ? [{
              season: 2024,
              round: 6,
              race_name: 'Miami Grand Prix',
              circuit_id: 'miami',
            }]
            : [];

    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(rows),
    });
  });

  const cases = [
    { query: 'Max', name: /Max Verstappen/, path: '/history/drivers/max_verstappen' },
    { query: 'Red Bull', name: /Red Bull/, path: '/history/constructors/red_bull' },
    { query: 'Monaco', name: /Circuit de Monaco/, path: '/circuits/monaco' },
    { query: 'Miami Grand Prix', name: /Miami Grand Prix/, path: '/races/6/info?season=2024' },
  ];

  for (const searchCase of cases) {
    await page.goto('/');
    const searchLabel = '搜索车手、车队、赛道或赛事';
    const trigger = page.getByRole('button', { name: searchLabel });
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    }

    const input = page.getByRole('combobox', { name: searchLabel });
    await input.fill(searchCase.query);
    await page.getByRole('option', { name: searchCase.name }).click();
    await expect(page).toHaveURL(new RegExp(`${searchCase.path.replace(/[?]/g, '\\?')}$`));

    if (searchCase.path.includes('/history/drivers/')) {
      await expect(page.locator('canvas').first()).toBeVisible();
    }
  }

  expect(browserErrors, 'console/page errors after global search navigation').toEqual([]);
});
