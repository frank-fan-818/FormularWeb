import { expect, test, type Page } from '@playwright/test';

const drivers = [
  ['albon', 'Alexander', 'Albon', 'ALB', '23', 'williams', 'Williams'],
  ['antonelli', 'Kimi', 'Antonelli', 'ANT', '12', 'mercedes', 'Mercedes'],
  ['lindblad', 'Arvid', 'Lindblad', 'LIN', '41', 'racing_bulls', 'Racing Bulls'],
].map(([driverId, givenName, familyName, code, permanentNumber, constructorId, constructorName], index) => ({
  position: String(index + 1),
  positionText: String(index + 1),
  points: String(30 - index),
  wins: '0',
  Driver: {
    driverId,
    permanentNumber,
    code,
    url: '#',
    givenName,
    familyName,
    dateOfBirth: '2000-01-01',
    nationality: 'Test',
  },
  Constructors: [{ constructorId, url: '#', name: constructorName, nationality: 'Test' }],
}));

const constructors = [
  ['audi', 'Audi'],
  ['cadillac', 'Cadillac F1 Team'],
  ['williams', 'Williams'],
].map(([constructorId, name], index) => ({
  position: String(index + 1),
  positionText: String(index + 1),
  points: String(20 - index),
  wins: '0',
  Constructor: { constructorId, url: '#', name, nationality: 'Test' },
}));

async function mockStandings(page: Page) {
  await page.route('**/f1-api/**', async (requestRoute) => {
    const pathname = new URL(requestRoute.request().url()).pathname;
    const isDriverStandings = pathname.endsWith('/driverStandings.json');
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          StandingsTable: {
            StandingsLists: [{
              season: '2026',
              round: '12',
              DriverStandings: isDriverStandings ? drivers : undefined,
              ConstructorStandings: isDriverStandings ? undefined : constructors,
            }],
          },
        },
      }),
    });
  });
  await page.route('**/rest/v1/**', (requestRoute) => requestRoute.fulfill({
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: '[]',
  }));
}

async function expectLoadedImages(page: Page, selector: string, expectedCount: number) {
  const images = page.locator(selector);
  await expect(images).toHaveCount(expectedCount);
  await expect.poll(() => images.evaluateAll((elements) => elements.every((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }))).toBe(true);
}

test('current driver headshots and constructor logos load locally', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'service-worker-chromium', 'Covered by visual viewport projects.');
  await mockStandings(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const mediaFailures: string[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/images/') && response.status() >= 400) {
      mediaFailures.push(`${response.status()} ${url.pathname}`);
    }
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/images/')) mediaFailures.push(`failed ${url.pathname}`);
  });

  await page.goto('/drivers');
  await expect(page.getByText('Arvid', { exact: true })).toBeVisible();
  await expectLoadedImages(page, 'img[src*="/images/drivers/"]', drivers.length);
  await page.screenshot({
    path: `artifacts/browser-qa/screenshots/f1-media-drivers-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.goto('/constructors');
  await expect(page.getByText('Cadillac F1 Team', { exact: true })).toBeVisible();
  await expectLoadedImages(page, 'img[src*="/images/constructors/"]', constructors.length);
  await page.screenshot({
    path: `artifacts/browser-qa/screenshots/f1-media-constructors-${testInfo.project.name}.png`,
    fullPage: true,
  });

  expect(mediaFailures).toEqual([]);
});
