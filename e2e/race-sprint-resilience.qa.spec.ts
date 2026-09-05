import { expect, test } from '@playwright/test';

const driver = {
  driverId: 'norris',
  permanentNumber: '4',
  code: 'NOR',
  url: '#',
  givenName: 'Lando',
  familyName: 'Norris',
  dateOfBirth: '1999-11-13',
  nationality: 'British',
};

const constructor = {
  constructorId: 'mclaren',
  url: '#',
  name: 'McLaren',
  nationality: 'British',
};

const sprintResult = {
  number: '4',
  position: '1',
  positionText: '1',
  points: '8',
  grid: '1',
  laps: '19',
  status: 'Finished',
  Time: { millis: '1839965', time: '30:39.965' },
  Driver: driver,
  Constructor: constructor,
};

const race = {
  season: '2025',
  round: '2',
  raceName: 'Chinese Grand Prix',
  date: '2025-03-23',
  Circuit: {
    circuitId: 'shanghai',
    circuitName: 'Shanghai International Circuit',
    Location: {
      locality: 'Shanghai',
      country: 'China',
      lat: '31.3389',
      long: '121.2200',
    },
  },
  Results: [{ ...sprintResult, points: '25', laps: '56' }],
  QualifyingResults: [{
    number: '4',
    position: '1',
    Driver: driver,
    Constructor: constructor,
    Q1: '1:31.123',
    Q2: '1:30.456',
    Q3: '1:29.789',
  }],
  SprintResults: [sprintResult],
};

const previousRace = {
  ...race,
  round: '1',
  raceName: 'Australian Grand Prix',
  date: '2025-03-16',
  Circuit: {
    ...race.Circuit,
    circuitId: 'albert_park',
    circuitName: 'Albert Park Grand Prix Circuit',
    Location: { ...race.Circuit.Location, locality: 'Melbourne', country: 'Australia' },
  },
  SprintResults: undefined,
};

function fastF1Payload(session: 'S' | 'SQ') {
  return {
    source: 'fastf1',
    generatedAt: '2026-08-26T00:00:00Z',
    season: '2025',
    round: '2',
    session,
    eventName: 'Chinese Grand Prix',
    sessionName: session === 'S' ? 'Sprint' : 'Sprint Qualifying',
    sessionResults: [{
      driver: 'NOR',
      driverNumber: '4',
      team: 'McLaren',
      position: 1,
      classifiedPosition: '1',
      gridPosition: 1,
      points: session === 'S' ? 8 : 0,
      laps: session === 'S' ? 19 : 0,
      status: 'Finished',
      time: session === 'S' ? '30:39.965' : null,
    }],
    lapTimeSeries: [{
      driver: 'NOR',
      team: 'McLaren',
      racePosition: 1,
      laps: [{ lapNumber: 1, lapTimeSeconds: 92.123 }],
    }],
    tyreStrategies: [],
    qualifyingAnalysis: session === 'SQ' ? {
      sessionType: 'SPRINT_QUALIFYING',
      phaseResults: [{
        driver: 'NOR',
        team: 'McLaren',
        position: 1,
        phases: {
          q1: { time: '1:32.123', seconds: 92.123 },
          q2: { time: '1:31.456', seconds: 91.456 },
          q3: { time: '1:30.789', seconds: 90.789 },
        },
      }],
      bestLaps: [],
    } : undefined,
  };
}

test('Sprint classifications load without Supabase session discovery', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const requestedFastF1Sessions: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.route('**/rest/v1/**', async (requestRoute) => {
    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '[]',
    });
  });
  await page.route('**/f1-api/**', async (requestRoute) => {
    const isSeasonSchedule = new URL(requestRoute.request().url()).pathname.endsWith('/f1-api/2025.json');
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: isSeasonSchedule ? '2' : '1',
          RaceTable: {
            season: '2025',
            round: isSeasonSchedule ? undefined : '2',
            Races: isSeasonSchedule ? [previousRace, race] : [race],
          },
          StandingsTable: { StandingsLists: [] },
        },
      }),
    });
  });
  await page.route('**/fastf1/2025/2/*.json', async (requestRoute) => {
    const url = requestRoute.request().url();
    requestedFastF1Sessions.push(url);
    if (url.endsWith('/S.json')) {
      await requestRoute.fulfill({ contentType: 'application/json', body: JSON.stringify(fastF1Payload('S')) });
      return;
    }
    if (url.endsWith('/SQ.json')) {
      await requestRoute.fulfill({ contentType: 'application/json', body: JSON.stringify(fastF1Payload('SQ')) });
      return;
    }
    await requestRoute.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/races/2/sprint?season=2025', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('tab', { name: /冲刺排位赛/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('1:30.789', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^冲刺赛/ }).click();
  await expect(page.getByText('30:39.965', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '19', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '8', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '56', exact: true })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: '25', exact: true })).toHaveCount(0);
  await expect(page.getByText('本场比赛无冲刺赛')).toHaveCount(0);

  const dimensions = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(requestedFastF1Sessions.some((url) => url.endsWith('/SQ.json'))).toBe(true);
  expect(requestedFastF1Sessions.some((url) => url.endsWith('/S.json'))).toBe(true);
  expect(requestedFastF1Sessions.some((url) => url.endsWith('/SS.json'))).toBe(false);
  expect(consoleErrors).toEqual([]);
  await page.screenshot({
    path: `artifacts/browser-qa/screenshots/race-sprint-resilience-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('Results tabs recover practice and sprint qualifying from FastF1', async ({ page }) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) failedRequests.push(request.url());
  });
  await page.route('**/rest/v1/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/f1-api/**', (route) => {
    expect(route.request().url()).not.toContain('/practice/');
    const isSchedule = new URL(route.request().url()).pathname.endsWith('/f1-api/2025.json');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: {
      total: isSchedule ? '2' : '1', RaceTable: { season: '2025', round: '2', Races: [...(isSchedule ? [previousRace] : []), { ...race,
        FirstPractice: { date: '2025-03-21' }, SprintQualifying: { date: '2025-03-21' },
      }] }, StandingsTable: { StandingsLists: [] },
    } }) });
  });
  await page.route('**/fastf1/2025/2/*.json', (route) => {
    const isPractice = route.request().url().endsWith('/FP1.json');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      ...fastF1Payload('SQ'),
      ...(isPractice ? { session: 'FP1', sessionName: 'Practice 1', qualifyingAnalysis: undefined } : {}),
    }) });
  });
  await page.goto('/races/2/results?season=2025');
  // Focusing a tab also scrolls Ant Design's mobile tab strip into view.
  await page.getByRole('tab', { name: /FP1/ }).focus();
  await page.getByRole('tab', { name: /FP1/ }).click();
  await expect(page.getByRole('cell', { name: '1:32.123', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /SQ/ }).focus();
  await page.getByRole('tab', { name: /SQ/ }).click();
  await expect(page.getByRole('cell', { name: '1:30.789', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Recollected FastF1 files display real practice and sprint qualifying times', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) failed.push(request.url());
  });
  const australia = { ...previousRace, season: '2026', date: '2026-03-08',
    FirstPractice: { date: '2026-03-06' }, SecondPractice: { date: '2026-03-06' }, ThirdPractice: { date: '2026-03-07' } };
  const china = { ...race, season: '2026', date: '2026-03-15',
    FirstPractice: { date: '2026-03-13' }, SprintQualifying: { date: '2026-03-13' } };
  await page.route('**/rest/v1/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/f1-api/**', (route) => {
    const url = new URL(route.request().url());
    const schedule = url.pathname.endsWith('/2026.json');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: {
      total: schedule ? '2' : '1', RaceTable: { Races: schedule ? [australia, china] : [url.pathname.includes('/2026/2/') ? china : australia] },
      StandingsTable: { StandingsLists: [] },
    } }) });
  });
  // No FastF1 interception: these are the real files produced by the exporter.
  await page.goto('/races/1/results?season=2026');
  for (const [code, time] of [['FP1', '1:20.267'], ['FP2', '1:19.729'], ['FP3', '1:19.053']]) {
    await page.getByRole('tab', { name: new RegExp(code) }).focus();
    await page.getByRole('tab', { name: new RegExp(code) }).click();
    await expect(page.getByRole('cell', { name: time, exact: true })).toBeVisible();
    await expect(page.locator('.ant-tabs-tabpane-active .ant-table-tbody tr[data-row-key]')).toHaveCount(22);
  }
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/real-practice-${testInfo.project.name}.png`, fullPage: true });
  await page.goto('/races/2/results?season=2026');
  await page.getByRole('tab', { name: /SQ/ }).focus();
  await page.getByRole('tab', { name: /SQ/ }).click();
  for (const time of ['1:33.030', '1:32.241', '1:31.520']) {
    await expect(page.getByRole('cell', { name: time, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/real-sprint-qualifying-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('Race intelligence leaves skeleton state when optional APIs stall', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One viewport is enough for timeout behavior.');

  await page.route('**/rest/v1/**', async (requestRoute) => {
    const url = decodeURIComponent(requestRoute.request().url());
    const isPreviewHistory = url.includes('/rest/v1/races?')
      && url.includes('select=id,season,round,race_name,circuit_id,date');
    const isUpgradeRequest = url.includes('/rest/v1/fia_car_upgrade');

    if (isPreviewHistory || isUpgradeRequest) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }

    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '[]',
    });
  });
  await page.route('**/f1-api/**', async (requestRoute) => {
    const isSeasonSchedule = new URL(requestRoute.request().url()).pathname.endsWith('/f1-api/2025.json');
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: isSeasonSchedule ? '2' : '1',
          RaceTable: {
            season: '2025',
            round: isSeasonSchedule ? undefined : '2',
            Races: isSeasonSchedule ? [previousRace, race] : [race],
          },
          StandingsTable: { StandingsLists: [] },
        },
      }),
    });
  });
  await page.route('**/fastf1/2025/2/*.json', async (requestRoute) => {
    await requestRoute.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/races/2/info?season=2025', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('历史比赛数据请求超时，请稍后重试')).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText(/赛车升级数据请求超时，请稍后重试/)).toBeVisible();
  await expect(page.locator('.race-info-secondary-grid .ant-skeleton')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试历史样本' })).toBeVisible();
  await expect(page.getByRole('button', { name: '重试升级数据' })).toBeVisible();
});

test('Race analysis uses an available static FastF1 snapshot', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Static snapshot resolution is viewport-independent.');

  await page.route('**/rest/v1/**', async (requestRoute) => {
    await requestRoute.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '[]',
    });
  });
  await page.route('**/f1-api/**', async (requestRoute) => {
    const isSeasonSchedule = new URL(requestRoute.request().url()).pathname.endsWith('/f1-api/2025.json');
    await requestRoute.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        MRData: {
          total: isSeasonSchedule ? '2' : '1',
          RaceTable: {
            season: '2025',
            round: isSeasonSchedule ? undefined : '2',
            Races: isSeasonSchedule ? [previousRace, race] : [race],
          },
          StandingsTable: { StandingsLists: [] },
        },
      }),
    });
  });

  await page.goto('/races/2/race?season=2025', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('FASTF1 ANALYTICS ONLINE')).toBeVisible();
  await expect(page.getByText('Timing snapshot unavailable')).toHaveCount(0);
  await expect(page.getByText('Race analysis is not available yet')).toHaveCount(0);
});
