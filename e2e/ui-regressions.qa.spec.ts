import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const constructors = ['Mercedes', 'Ferrari', 'McLaren'].map((name, i) => ({
  constructorId: name.toLowerCase(), name, nationality: ['German', 'Italian', 'British'][i], url: '#',
}));
const drivers = [
  ['antonelli', 'ANT', 'Andrea Kimi', 'Antonelli'],
  ['russell', 'RUS', 'George', 'Russell'],
  ['hamilton', 'HAM', 'Lewis', 'Hamilton'],
].map(([driverId, code, givenName, familyName]) => ({ driverId, code, givenName, familyName,
  permanentNumber: '1', nationality: 'British', dateOfBirth: '2000-01-01', url: '#' }));
const race = {
  season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08', time: '04:00:00Z',
  Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit',
    Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.8497', long: '144.968' } },
  Results: drivers.map((Driver, i) => ({ Driver, Constructor: constructors[0], number: String(i + 1),
    position: String(i + 1), positionText: String(i + 1), points: '25', grid: String(i + 1), laps: '12', status: 'Finished' })),
  QualifyingResults: drivers.map((Driver, i) => ({ Driver, Constructor: constructors[0], number: String(i + 1),
    position: String(i + 1), Q1: '1:30.000', Q2: '1:29.000', Q3: '1:28.000' })),
};
const analytics = {
  source: 'fastf1', generatedAt: '2026-10-07T00:00:00Z', season: '2026', round: '1',
  session: 'R', eventName: race.raceName, sessionName: 'Race',
  lapTimeSeries: drivers.map((driver, i) => ({ driver: driver.code, team: 'Mercedes', racePosition: i + 1,
    laps: Array.from({ length: 12 }, (_, lap) => ({ lapNumber: lap + 1, lapTimeSeconds: 90 + lap * 0.1 + i,
      compound: lap < 6 ? 'MEDIUM' : 'SOFT', stint: lap < 6 ? 1 : 2, position: i + 1 })) })),
  tyreStrategies: drivers.map(driver => ({ driver: driver.code, team: 'Mercedes', stints: [
    { stint: 1, compound: 'MEDIUM', startLap: 1, endLap: 6, lapCount: 6, freshTyre: true },
    { stint: 2, compound: 'SOFT', startLap: 7, endLap: 12, lapCount: 6, freshTyre: false },
  ] })),
};
const telemetry = {
  drivers: drivers.map((driver, i) => {
    const count = 81;
    return { driver: driver.code, team: 'Mercedes', lapNumber: 12, lapTimeSeconds: 90 + i, compound: 'SOFT',
      samples: {
        distanceM: Array.from({ length: count }, (_, p) => p * 60),
        timeSeconds: Array.from({ length: count }, (_, p) => p),
        speedKph: Array.from({ length: count }, (_, p) => 100 + p % 30 * 7),
        rpm: Array.from({ length: count }, () => 10000), gear: Array.from({ length: count }, () => 5),
        throttlePct: Array.from({ length: count }, () => 80), brake: Array.from({ length: count }, () => false),
        drs: Array.from({ length: count }, () => 0),
      },
      // Optimized position data has no duplicated distance or speed arrays and no corner labels.
      positionSamples: { x: Array.from({ length: count }, (_, p) => Math.cos(p / 80 * Math.PI * 2) * 4000),
        y: Array.from({ length: count }, (_, p) => Math.sin(p / 80 * Math.PI * 2) * 2000),
        z: Array.from({ length: count }, () => null) },
    };
  }), corners: [], cornerAnalysis: [],
};

async function installFixtures(page: Page, comparisonData = false) {
  await enterAsMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/f1-api/**', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ MRData: { total: /\/(results|qualifying)\.json/.test(new URL(route.request().url()).pathname) ? '3' : '1', RaceTable: { Races: [race] },
      StandingsTable: { StandingsLists: [{ season: '2026', round: '1',
        DriverStandings: drivers.map((Driver, i) => ({ Driver, Constructors: [constructors[i === 2 ? 1 : 0]],
          position: String(i + 1), points: String([320, 236, 214][i]), wins: '1' })),
        ConstructorStandings: constructors.map((Constructor, i) => ({ Constructor, position: String(i + 1),
          points: String([556, 405, 316][i]), wins: '1' })),
      }] }, SeasonTable: { Seasons: [{ season: '2026' }] } } }),
  }));
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const qualifyingAnalysis = { bestLaps: drivers.map((driver, i) => ({ driver: driver.code, team: 'Mercedes',
      position: i + 1, lapNumber: 1, lapTimeSeconds: 90 + i, sector1Seconds: 30 + i,
      sector2Seconds: 30, sector3Seconds: 30, compound: 'SOFT', isDeleted: false })) };
    const cornerAnalysis = [{ corner: 'T1', distanceM: 100,
      drivers: drivers.map((driver, i) => ({ driver: driver.code, minSpeedKph: 100 + i * 10 })) }];
    const payload = name?.includes('telemetry') ? { ...analytics, telemetry: comparisonData ? { ...telemetry, cornerAnalysis } : telemetry }
      : { ...analytics, session: name?.replace('.json', '') || 'R' };
    if (comparisonData && name === 'Q.json') Object.assign(payload, { qualifyingAnalysis });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
  });
}

test('populated standings keep compact aligned rows', async ({ page }, info) => {
  await installFixtures(page);
  await page.goto('/');
  const section = page.locator('.standings-section');
  await expect(section.locator('.official-standings-row')).toHaveCount(6);
  await section.scrollIntoViewIfNeeded();
  const heights = await section.locator('.official-standings-row').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
  expect(Math.max(...heights)).toBeLessThan(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await section.screenshot({ path: `artifacts/browser-qa/screenshots/fixed-standings-${info.project.name}.png` });
});

test('driver duel displays stint comparison and telemetry paints the full track', async ({ page }, info) => {
  await installFixtures(page, true);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && message.text() !== 'Service Worker registration blocked by Playwright') errors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });
  await page.goto('/races/1/race?season=2026');
  const duel = page.locator('#analysis-duel');
  await expect(duel).toBeVisible();
  await duel.locator('button.driver-legend-item', { hasText: 'ANT' }).click();
  await duel.locator('button.driver-legend-item', { hasText: 'RUS' }).click();
  await expect(duel.locator('.duel-stint-table')).toHaveCount(2);
  await expect(duel).toContainText('+0.300s');
  await expect(duel.locator('.duel-sector-gap-card')).toHaveCount(4);
  // Both datasets must arrive without visiting qualifying or scrolling to telemetry.
  await expect(duel.locator('.duel-corner-card')).toHaveCount(1);
  await expect(duel.locator('.ant-card-head')).not.toContainText('MEDIUM');
  await duel.screenshot({ path: `artifacts/browser-qa/screenshots/fixed-duel-${info.project.name}.png` });
  await duel.locator('button.driver-legend-item', { hasText: 'HAM' }).click();
  await expect(duel.locator('.duel-stint-driver h4')).toHaveText(['RUS', 'HAM']);
  await duel.getByRole('button', { name: '收起', exact: true }).click();
  await expect(duel.locator('#analysis-duel-body')).toBeHidden();
  await duel.getByRole('button', { name: '展开', exact: true }).click();
  await expect(duel.locator('.duel-stint-table')).toHaveCount(2);

  const panel = page.locator('#analysis-telemetry');
  await panel.scrollIntoViewIfNeeded();
  await expect(panel.locator('.telemetry-driver-strip button')).toHaveCount(3);
  await panel.locator('.telemetry-driver-strip button', { hasText: 'ANT' }).click();
  const heatmap = panel.locator('.telemetry-heatmap-panel');
  await heatmap.scrollIntoViewIfNeeded();
  // A canvas alone is insufficient: inspect actual colored pixels to catch off-screen tracks.
  await expect.poll(() => heatmap.locator('canvas').evaluateAll(canvases => {
    return canvases.reduce((sum, canvas) => {
      const ctx = (canvas as HTMLCanvasElement).getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted += 1;
      return sum + painted;
    }, 0);
  })).toBeGreaterThan(1000);
  await heatmap.screenshot({ path: `artifacts/browser-qa/screenshots/fixed-heatmap-${info.project.name}.png` });
  await panel.locator('.telemetry-driver-strip button', { hasText: 'RUS' }).click();
  await expect(panel.locator('.telemetry-driver-strip button[aria-pressed="true"]')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('driver duel explains missing sector and corner channels', async ({ page }) => {
  await installFixtures(page);
  await page.goto('/races/1/race?season=2026');
  const duel = page.locator('#analysis-duel');
  await duel.locator('button.driver-legend-item', { hasText: 'ANT' }).click();
  await duel.locator('button.driver-legend-item', { hasText: 'RUS' }).click();
  await expect(duel.locator('.duel-stint-table')).toHaveCount(2);
  await expect(duel).toContainText('暂无所选车手的排位分段数据');
  await expect(duel).toContainText('暂无所选车手的弯速数据');
});
