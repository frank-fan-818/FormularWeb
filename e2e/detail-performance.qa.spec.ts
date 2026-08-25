import { expect, test, type Page } from '@playwright/test';

const driverStanding = {
  position: '1',
  positionText: '1',
  points: '51',
  wins: '2',
  Driver: {
    driverId: 'max_verstappen',
    permanentNumber: '1',
    code: 'VER',
    url: '#',
    givenName: 'Max',
    familyName: 'Verstappen',
    dateOfBirth: '1997-09-30',
    nationality: 'Dutch',
  },
  Constructors: [{ constructorId: 'red_bull', url: '#', name: 'Red Bull', nationality: 'Austrian' }],
};

const australianGrandPrix = {
  season: '2026',
  round: '1',
  raceName: 'Australian Grand Prix',
  date: '2026-03-08',
  Circuit: {
    circuitId: 'albert_park',
    circuitName: 'Albert Park Grand Prix Circuit',
    Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.8497', long: '144.968' },
  },
};

async function mockFastDetailData(page: Page) {
  await page.route('**/f1-api/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    const isDriverResults = pathname.endsWith('/drivers/max_verstappen/results.json');
    const isDriverStandings = pathname.endsWith('/driverStandings.json');
    const isCalendar = pathname.endsWith('/2026.json');
    const races = isDriverResults
      ? [
          { ...australianGrandPrix, Results: [{ points: '25' }] },
          { ...australianGrandPrix, round: '2', raceName: 'Chinese Grand Prix', Results: [{ points: '26' }] },
        ]
      : isCalendar
        ? [australianGrandPrix]
        : [];

    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: String(races.length || (isDriverStandings ? 1 : 0)),
          RaceTable: { Races: races },
          StandingsTable: {
            StandingsLists: isDriverStandings ? [{ DriverStandings: [driverStanding] }] : [],
          },
        },
      }),
    });
  });

  await page.route('**/rest/v1/**', async (requestRoute) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '[]',
    });
  });
}

test('driver points chart paints before slower profile metadata', async ({ page }, testInfo) => {
  await mockFastDetailData(page);
  const startedAt = Date.now();

  await page.goto('/drivers/max_verstappen', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.chart-scroll-container canvas')).toBeVisible({ timeout: 2_000 });
  expect(Date.now() - startedAt).toBeLessThan(1_500);
  await expect(page.getByText('正在加载图表...')).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('driver-points-chart-fast.png'),
    fullPage: true,
  });
});

test('circuit atlas renders local engineering specs before remote metadata', async ({ page }, testInfo) => {
  await mockFastDetailData(page);
  const startedAt = Date.now();

  await page.goto('/circuits', { waitUntil: 'domcontentloaded' });
  const firstCard = page.locator('.circuit-atlas-card').first();
  await expect(firstCard).toContainText('5.278 km', { timeout: 1_000 });
  await expect(firstCard).toContainText('14');
  await expect(firstCard).toContainText('1996');
  expect(Date.now() - startedAt).toBeLessThan(800);

  await page.screenshot({
    path: testInfo.outputPath('circuit-atlas-first-screen.png'),
    fullPage: true,
  });
});
