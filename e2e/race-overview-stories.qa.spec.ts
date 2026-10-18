import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test('race overview shows readable names, the complete retirement list and working driver links', async ({ page }, testInfo) => {
  await enterAsMember(page);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.text() === 'Service Worker registration blocked by Playwright') return;
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });
  const result = (id: string, first: string, last: string, position: number, grid: number, status = 'Finished') => ({
    number: String(position), position: String(position), positionText: String(position),
    points: '0', grid: String(grid), laps: '57', status,
    Driver: { driverId: id, code: id.slice(0, 3).toUpperCase(), givenName: first, familyName: last,
      permanentNumber: String(position), url: '', dateOfBirth: '1990-01-01', nationality: 'British' },
    Constructor: { constructorId: 'ferrari', name: 'Ferrari', url: '', nationality: 'Italian' },
  });
  const race = {
    season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08', time: '04:00:00Z',
    Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit',
      Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.8497', long: '144.968' } },
    Results: [
      result('piastri', 'Oscar', 'Piastri', 1, 2),
      result('norris', 'Lando', 'Norris', 2, 1),
      result('leclerc', 'Charles', 'Leclerc', 3, 3),
      { ...result('russell', 'George', 'Russell', 4, 5),
        FastestLap: { rank: '1', lap: '49', Time: { time: '1:35.587' }, AverageSpeed: { units: 'kph', speed: '220' } } },
      result('bearman', 'Oliver', 'Bearman', 16, 22),
      result('sainz', 'Carlos', 'Sainz', 19, 12, 'Engine'),
      result('perez', 'Sergio', 'Pérez', 20, 15, 'Collision'),
      result('stroll', 'Lance', 'Stroll', 21, 18, 'Accident'),
      result('hamilton', 'Lewis', 'Hamilton', 22, 4, 'Engine'),
    ],
  };
  await page.route('**/f1-api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const isResults = pathname.endsWith('/results.json');
    const isQualifying = pathname.endsWith('/qualifying.json');
    return route.fulfill({ json: { MRData: {
      total: String(isResults ? race.Results.length : isQualifying ? 0 : 1),
      RaceTable: { season: '2026', round: '1', Races: isQualifying ? [] : [race] },
      StandingsTable: { StandingsLists: [] }, SeasonTable: { Seasons: [{ season: '2026' }] },
    } } });
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', route => route.fulfill({ json: {
    source: 'fastf1', season: '2026', round: '1', session: 'R', eventName: race.raceName,
    sessionName: 'Race', generatedAt: '2026-03-08T08:00:00Z', totalLaps: 57,
    drivers: [], laps: [], stints: [], lapTimeSeries: [], tyreStrategies: [], raceControlMessages: [], trackStatusPeriods: [],
  } }));
  await page.goto('/races/1/results?season=2026');
  const stories = page.locator('.race-story-grid');
  await expect(stories.locator('.race-story-card')).toHaveCount(4);
  const retired = stories.locator('.tone-neutral');
  await expect(retired.locator('strong')).toHaveText('4');
  await expect(retired.getByRole('link')).toHaveText(['Carlos Sainz', 'Sergio Pérez', 'Lance Stroll', 'Lewis Hamilton']);
  await expect(stories.locator('.tone-positive')).toContainText('发车 P22 → 赛后 P16');
  await expect(stories.locator('.tone-fastest')).toContainText('第 49 圈');
  for (const element of await stories.locator('.race-story-card, .race-story-driver').all()) {
    expect(await element.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  }
  for (const link of await stories.getByRole('link').all()) {
    await expect(link).toHaveCSS('font-size', '16px');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await stories.scrollIntoViewIfNeeded();
  await stories.screenshot({ path: `artifacts/browser-qa/screenshots/race-stories-${testInfo.project.name}.png`,
    style: '.header, .race-subpage-tabs, .race-subpage-tabs * { visibility: hidden !important; }' });
  await page.locator('.race-overview-debrief').screenshot({
    path: `artifacts/browser-qa/screenshots/race-debrief-${testInfo.project.name}.png`,
    style: '.header, .race-subpage-tabs, .race-subpage-tabs * { visibility: hidden !important; }',
  });
  const lastDriver = retired.getByRole('link', { name: 'Lewis Hamilton' });
  await lastDriver.focus();
  await expect(lastDriver).toBeFocused();
  await expect(lastDriver).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/drivers\/hamilton$/);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
