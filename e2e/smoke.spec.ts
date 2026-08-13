import { expect, test, type Page } from '@playwright/test';

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

async function mockHistoricalRaceApi(page: Page) {
  await page.route('**/f1-api/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    const isSeasonList = pathname.endsWith('/seasons.json');
    const calendarSeason = pathname.endsWith('/2024.json')
      ? '2024'
      : pathname.endsWith('/2025.json')
        ? '2025'
        : null;
    const races = calendarSeason
      ? Array.from({ length: 6 }, (_, index) => {
        const round = index + 1;
        return {
          season: calendarSeason,
          round: String(round),
          raceName: round === 6
            ? `${calendarSeason === '2025' ? '2025 ' : ''}Miami Grand Prix`
            : `${calendarSeason} Round ${round}`,
          date: round === 6 ? `${calendarSeason}-05-05` : `${calendarSeason}-0${round}-01`,
          time: '20:00:00Z',
          Circuit: {
            circuitId: round === 6 ? 'miami' : `circuit-${round}`,
            circuitName: round === 6 ? 'Miami International Autodrome' : `Circuit ${round}`,
            Location: {
              locality: round === 6 ? 'Miami' : `City ${round}`,
              country: 'USA',
              lat: '25.9581',
              long: '-80.2389',
            },
          },
        };
      })
      : [];

    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: String(isSeasonList ? 2 : races.length),
          RaceTable: { Races: races },
          SeasonTable: { Seasons: isSeasonList ? [{ season: '2024' }, { season: '2025' }] : [] },
          StandingsTable: { StandingsLists: [] },
        },
      }),
    });
  });
}

async function getControllerBuildId(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return null;

    return new Promise<string | null>((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 1_000);
      channel.port1.onmessage = (event: MessageEvent<{ buildId?: unknown }>) => {
        window.clearTimeout(timeout);
        resolve(typeof event.data?.buildId === 'string' ? event.data.buildId : null);
      };
      worker.postMessage({ type: 'GET_BUILD_ID' }, [channel.port2]);
    });
  });
}

async function ensureServiceWorkerController(page: Page, buildId: string) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (await getControllerBuildId(page) === null) {
    await page.reload();
  }
  await expect.poll(() => getControllerBuildId(page)).toBe(buildId);
}

test('missing static assets return a real 404 instead of SPA HTML', async ({ request }) => {
  const response = await request.get('/assets/removed-build-chunk.js');

  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('text/plain');
  expect(await response.text()).not.toContain('<!doctype html>');
});

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
    await page.route('**/rest/v1/**', async (requestRoute) => {
      await requestRoute.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '[]',
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
    await expect(page.getByText('\u9875\u9762\u52a0\u8f7d\u5931\u8d25')).toHaveCount(0);
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

test('historical race navigation preserves and updates the season identity', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The interaction is viewport-independent.');

  await mockHistoricalRaceApi(page);
  await page.goto('/races');
  await page.locator('.season-switcher .season-select-native').first().selectOption('2024');
  await page.getByRole('button', { name: /Miami Grand Prix/ }).click();
  await expect(page).toHaveURL(/\/races\/6\/results\?season=2024$/);
  await expect(page.getByRole('heading', { name: /Miami Grand Prix/ })).toBeVisible();
  await expect(page.locator('.season-switcher .season-select-native').first()).toHaveValue('2024');

  await page.locator('.season-switcher .season-select-native').first().selectOption('2025');
  await expect(page).toHaveURL(/\/races\/6\/results\?season=2025$/);
  await expect(page.getByRole('heading', { name: /2025 Miami Grand Prix/ })).toBeVisible();

  const copiedUrl = page.url();
  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  try {
    await mockHistoricalRaceApi(freshPage);
    await freshPage.goto(copiedUrl);
    await expect(freshPage.locator('.season-switcher .season-select-native').first()).toHaveValue('2025');
    await expect(freshPage.getByRole('heading', { name: /2025 Miami Grand Prix/ })).toBeVisible();

    await freshPage.goto('/races/6?season=2024');
    await expect(freshPage).toHaveURL(/\/races\/6\/results\?season=2024$/);
  } finally {
    await freshContext.close();
  }
});

test('settings language changes stay synchronized with the header', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The interaction is viewport-independent.');

  await page.goto('/settings');
  const headerLanguage = page.locator('.lang-switcher .season-select-native');
  await expect(headerLanguage).toHaveValue('zh-CN');
  await expect(headerLanguage).toHaveAccessibleName('语言');

  await page.locator('.settings-card').first().locator('.ant-select').click();
  const visibleEnglishOption = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option-content')
    .filter({ hasText: /^English$/ });
  await expect(visibleEnglishOption).toBeVisible();
  await visibleEnglishOption.click();

  await expect(headerLanguage).toHaveValue('en');
  await expect(headerLanguage).toHaveAccessibleName('Language');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByText('Current Season', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', {
    name: 'Search drivers, teams, circuits or races',
  })).toBeVisible();
});

test('service worker upgrades every long-lived tab before pruning the previous shell', async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One lifecycle run covers all viewports.');

  const firstBuildId = 'f1-shell-aaaaaaaaaaaa';
  const secondBuildId = 'f1-shell-bbbbbbbbbbbb';
  await context.addCookies([{
    name: 'qa-sw-version',
    value: 'aaaaaaaaaaaa',
    domain: '127.0.0.1',
    path: '/',
  }]);
  await ensureServiceWorkerController(page, firstBuildId);

  const secondPage = await context.newPage();
  await ensureServiceWorkerController(secondPage, firstBuildId);

  await context.addCookies([{
    name: 'qa-sw-version',
    value: 'bbbbbbbbbbbb',
    domain: '127.0.0.1',
    path: '/',
  }]);

  const firstReload = page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame());
  await page.evaluate(() => {
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
  });
  await firstReload;
  await expect.poll(() => getControllerBuildId(page)).toBe(secondBuildId);
  await expect.poll(() => getControllerBuildId(secondPage)).toBe(secondBuildId);
  await expect.poll(() => secondPage.evaluate(async () => (
    (await caches.keys()).filter((cacheName) => cacheName.startsWith('f1-shell-')).sort()
  ))).toEqual([firstBuildId, secondBuildId]);

  const removedChunkResponse = secondPage.waitForResponse((response) => (
    new URL(response.url()).pathname === '/assets/Settings-qa-removed.js'
      && response.status() === 404
  ));
  const secondReload = secondPage.waitForEvent('framenavigated', (frame) => frame === secondPage.mainFrame());
  await secondPage.bringToFront();
  await secondPage.getByRole('button', { name: '\u8bbe\u7f6e' }).click();
  await removedChunkResponse;
  await secondReload;
  await expect(secondPage).toHaveURL(/\/settings$/);
  await expect(secondPage.getByRole('heading', { name: 'CONTROL SETTINGS' })).toBeVisible();
  await expect(secondPage.getByText('\u9875\u9762\u52a0\u8f7d\u5931\u8d25')).toHaveCount(0);
  await expect.poll(() => getControllerBuildId(secondPage)).toBe(secondBuildId);

  await expect.poll(() => secondPage.evaluate(async () => (
    (await caches.keys()).filter((cacheName) => cacheName.startsWith('f1-shell-'))
  ))).toEqual([secondBuildId]);
});
