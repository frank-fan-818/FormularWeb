import { expect, test } from '@playwright/test';

test('race analysis route remains responsive across available data states', async ({ page }, testInfo) => {
  const startedAt = Date.now();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const race = {
    season: '2026',
    round: '1',
    raceName: 'Australian Grand Prix',
    date: '2026-03-08',
    time: '04:00:00Z',
    Circuit: {
      circuitId: 'albert_park',
      circuitName: 'Albert Park Grand Prix Circuit',
      Location: {
        locality: 'Melbourne',
        country: 'Australia',
        lat: '-37.8497',
        long: '144.968',
      },
    },
    Results: [{
      number: '4',
      position: '1',
      positionText: '1',
      points: '25',
      grid: '1',
      laps: '57',
      status: 'Finished',
      Driver: {
        driverId: 'norris',
        permanentNumber: '4',
        code: 'NOR',
        url: '#',
        givenName: 'Lando',
        familyName: 'Norris',
        dateOfBirth: '1999-11-13',
        nationality: 'British',
      },
      Constructor: {
        constructorId: 'mclaren',
        url: '#',
        name: 'McLaren',
        nationality: 'British',
      },
    }],
    QualifyingResults: [{
      number: '4',
      position: '1',
      Q1: '1:16.003',
      Q2: '1:15.415',
      Q3: '1:15.096',
      Driver: {
        driverId: 'norris',
        permanentNumber: '4',
        code: 'NOR',
        url: '#',
        givenName: 'Lando',
        familyName: 'Norris',
        dateOfBirth: '1999-11-13',
        nationality: 'British',
      },
      Constructor: {
        constructorId: 'mclaren',
        url: '#',
        name: 'McLaren',
        nationality: 'British',
      },
    }],
  };

  await page.route('**/f1-api/**', async (requestRoute) => {
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: '1',
          RaceTable: { season: '2026', round: '1', Races: [race] },
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
  await page.route('**/fastf1/**', async (requestRoute) => {
    await requestRoute.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{}',
    });
  });

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${message.text()} ${message.location().url}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/races/1/race?season=2026', { waitUntil: 'domcontentloaded' });
  const stateHeading = page.getByRole('heading', { name: 'Race analysis is not available yet' });
  await expect(stateHeading).toBeVisible({ timeout: 15_000 });
  expect(Date.now() - startedAt).toBeLessThan(2_500);

  await expect(page.locator('.analysis-module-state-card')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Official race classification' })).toContainText('Lando Norris');

  const dimensions = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(pageErrors).toEqual([]);
  const expectedConsoleError = (message: string) =>
    message.includes('supabase.co') ||
    message.includes('/fastf1/2026/1/R.json') ||
    (message.includes('"module":"race_detail"') &&
      (message.includes('"function":"qualifying_results"') || message.includes('"function":"race_results"')));
  const unexpectedConsoleErrors = consoleErrors.filter((message) => !expectedConsoleError(message));
  expect(unexpectedConsoleErrors).toEqual([]);

  if (testInfo.project.name === 'desktop-chromium') {
    await page.goto('/races/1/qualifying?season=2026', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: 'Official qualifying classification' })).toContainText('1:15.096');

    await page.getByRole('tab', { name: /赛事概览/ }).click();
    await expect(page).toHaveURL(/\/results\?season=2026$/);
    const raceTab = page.getByRole('tab', { name: /比赛解读/ });
    await raceTab.hover();
    const repeatStartedAt = Date.now();
    await raceTab.click();
    await expect(stateHeading).toBeVisible();
    expect(Date.now() - repeatStartedAt).toBeLessThan(750);
  }
});
