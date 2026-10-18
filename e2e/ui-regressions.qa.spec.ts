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

async function installFixtures(page: Page, comparisonData = false, constructorFixtures = constructors, raceFixture = race) {
  await enterAsMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/f1-api/**', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ MRData: { total: /\/(results|qualifying)\.json/.test(new URL(route.request().url()).pathname) ? '3' : '1', RaceTable: { Races: [raceFixture] },
      DriverTable: { Drivers: drivers }, ConstructorTable: { Constructors: constructorFixtures },
      CircuitTable: { Circuits: [race.Circuit] },
      StandingsTable: { StandingsLists: [{ season: '2026', round: '1',
        DriverStandings: drivers.map((Driver, i) => ({ Driver, Constructors: [constructorFixtures[i === 2 ? 1 : 0]],
          position: String(i + 1), points: String([320, 236, 214][i]), wins: '1' })),
        ConstructorStandings: constructorFixtures.map((Constructor, i) => ({ Constructor, position: String(i + 1),
          points: String([556, 405, 316][i] ?? 0), wins: '1' })),
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

test('roster cards remove driver tags and give season points clear hierarchy', async ({ page }, info) => {
  await installFixtures(page, false, [...constructors, {
    constructorId: 'aston_martin', name: 'Aston Martin Aramco Formula One Team', nationality: 'British', url: '#',
  }]);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    for (const [path, selector, expected] of [
      ['/drivers', '.driver-lineup-card', ['320', '236', '214']],
      ['/constructors', '.constructor-profile-card', ['556', '405', '316', '0']],
    ] as const) {
      await page.goto(path);
      const cards = page.locator(selector);
      await expect(cards).toHaveCount(expected.length);
      await expect(cards.locator('.roster-season-score__points dd')).toHaveText([...expected]);
      await expect(page.locator('.driver-card-meta, .driver-rank-pill, .constructor-season-chip')).toHaveCount(0);
      for (const card of await cards.all()) {
        const rank = (await card.locator('.roster-season-score dd').first().boundingBox())!;
        const points = (await card.locator('.roster-season-score__points dd').boundingBox())!;
        expect(Math.abs(points.y - rank.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(points.height - rank.height)).toBeLessThanOrEqual(1);
        const labels = await card.locator('.roster-season-score dt').all();
        const rankLabel = (await labels[0].boundingBox())!;
        const pointsLabel = (await labels[1].boundingBox())!;
        expect(Math.abs(rankLabel.y - pointsLabel.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(rankLabel.x - rank.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(pointsLabel.x - points.x)).toBeLessThanOrEqual(1);
        expect(points.x).toBeGreaterThanOrEqual(rank.x + rank.width);
        expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      }
      if (path === '/drivers') await expect(cards.locator('.driver-card-identity')).not.toContainText(['ANT', 'British']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await cards.first().screenshot({ path: `artifacts/browser-qa/screenshots/roster-${path.slice(1)}-${theme}-${info.project.name}.png`, animations: 'disabled' });
      await cards.first().click();
      await expect(page.locator(path === '/drivers' ? '.driver-profile-name' : '.constructor-profile-name')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('home overview names the leaders and shows a compact latest race name', async ({ page }, info) => {
  const raceName = 'Formula 1 Singapore Airlines Singapore Grand Prix';
  await installFixtures(page, false, constructors, { ...race, raceName,
    Circuit: { ...race.Circuit, circuitId: 'marina_bay',
      Location: { ...race.Circuit.Location, locality: 'Marina Bay', country: 'Singapore' } },
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    await page.goto('/');
    const facts = page.locator('.home-core-facts');
    const items = facts.locator(':scope > div');
    await expect(items.nth(1).locator('dt')).toHaveText('车手榜领跑');
    await expect(items.nth(1).locator('dd')).toHaveText('A. Antonelli');
    await expect(items.nth(2).locator('dt')).toHaveText('车队榜领跑');
    await expect(items.nth(2).locator('dd')).toHaveText('Mercedes');
    await expect(items.nth(1).locator('span')).toHaveCount(0);
    await expect(items.nth(2).locator('span')).toHaveCount(0);
    const raceNameElement = items.nth(3).locator('dd');
    await expect(raceNameElement).toHaveText('Singapore');
    await expect(raceNameElement).toHaveCSS('white-space', 'normal');
    expect(await raceNameElement.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await raceNameElement.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    const nameBox = (await raceNameElement.boundingBox())!;
    const resultLink = items.nth(3).getByRole('button', { name: 'R1 · 查看结果', exact: true });
    expect((await resultLink.boundingBox())!.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await facts.screenshot({ path: `artifacts/browser-qa/screenshots/home-facts-${theme}-${info.project.name}.png`, animations: 'disabled' });
    await resultLink.click();
    await expect(page).toHaveURL(/\/races\/1\/results\?season=2026$/);
  }
  expect(errors).toEqual([]);
});

test('season overview keeps only essential facts while standings retain their detail', async ({ page }, info) => {
  await installFixtures(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    await page.goto('/seasons');
    const facts = page.getByRole('region', { name: '赛季概览', exact: true });
    await expect(facts.locator('strong')).toHaveText(['1/1', 'A. Antonelli', 'Mercedes', '3 / 3']);
    await expect(facts.locator('small, time')).toHaveCount(0);
    await expect(page.locator('.season-data-notice')).toHaveCount(0);
    await expect(page.locator('.official-points-value')).toHaveText(['320', '236', '214']);
    await page.getByRole('tab', { name: '车队', exact: true }).click();
    await expect(page.locator('.ant-tabs-tabpane-active .official-points-value')).toHaveText(['556', '405', '316']);
    expect(await facts.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await facts.screenshot({ path: `artifacts/browser-qa/screenshots/season-overview-${theme}-${info.project.name}.png`, animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});

test('page mastheads follow the active theme and use consistent typography', async ({ page }, info) => {
  test.setTimeout(60_000);
  await installFixtures(page);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });
  const routes = [
    ['/seasons', '.product-masthead'], ['/races', '.product-masthead'],
    ['/drivers', '.product-masthead'], ['/constructors', '.product-masthead'],
    ['/circuits', '.product-masthead'], ['/settings', '.product-masthead'],
    ['/circuits/albert_park', '.product-masthead'],
    ['/drivers/antonelli', '.driver-profile-hero'], ['/constructors/mercedes', '.constructor-profile-hero'],
    ['/races/1/results?season=2026', '.race-command'],
    ['/history/constructors/mercedes', '.history-hero-card'],
  ];
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    for (const [path, selector] of routes) {
      await page.goto(path);
      const header = page.locator(selector);
      await expect(header).toBeVisible();
      const brandedProfile = await header.evaluate(element => element.matches('.driver-profile-hero, .team-profile-hero'));
      if (brandedProfile) {
        await expect(header).toHaveCSS('background-image', /linear-gradient/);
        await expect(header.locator('h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
      } else {
        await expect(header).toHaveCSS('background-color', theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 41, 59)');
        await expect(header).toHaveCSS('background-image', 'none');
        await expect(header.locator('h1')).toHaveCSS('color', theme === 'light' ? 'rgb(34, 34, 34)' : 'rgb(226, 232, 240)');
      }
      if (selector === '.product-masthead') {
        await expect(header.locator('.product-masthead__eyebrow')).toHaveCSS('font-family', /F1 UI Sans/);
        const readable = await header.evaluate(element => {
          const luminance = (color: string) => {
            const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
              const channel = value / 255;
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          };
          const background = luminance(getComputedStyle(element).backgroundColor);
          return [...element.querySelectorAll('h1, .product-masthead__eyebrow, .product-metric__value, .product-metric__label')].every(node => {
            const foreground = luminance(getComputedStyle(node).color);
            return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05) >= 4.5;
          });
        });
        expect(readable).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await header.screenshot({ path: `artifacts/browser-qa/screenshots/masthead-${path.split('?')[0].split('/').filter(Boolean).join('-')}-${theme}-${info.project.name}.png`, animations: 'disabled' });
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('profile typography keeps names separated and metadata readable', async ({ page }, info) => {
  const profileConstructors = [...constructors, {
    constructorId: 'aston_martin', name: 'Aston Martin Aramco Formula One Team', nationality: 'British', url: '#',
  }];
  await installFixtures(page, false, profileConstructors);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && message.text() !== 'Service Worker registration blocked by Playwright') errors.push(message.text());
  });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url());
  });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    for (const [index, driver] of drivers.entries()) {
      await page.goto(`/drivers/${driver.driverId}`);
      const name = page.locator('.driver-profile-name');
      await expect(name.locator('span')).toHaveText(driver.givenName);
      await expect(name.locator('strong')).toHaveText(driver.familyName);
      const first = (await name.locator('span').boundingBox())!;
      const last = (await name.locator('strong').boundingBox())!;
      expect(last.y - (first.y + first.height)).toBeGreaterThanOrEqual(7);
      const meta = page.locator('.driver-profile-meta');
      await expect(meta.locator('dt')).toHaveCount(4);
      await expect(meta.locator('dd')).toHaveText([driver.nationality, `#${driver.permanentNumber}`, driver.code, '2026']);
      await expect(meta.locator('.ant-tag')).toHaveCount(0);
      expect(await name.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (index === 0) await page.locator('.driver-profile-hero').screenshot({
        path: `artifacts/browser-qa/screenshots/typography-driver-${theme}-${info.project.name}.png`,
      });
    }
    for (const [index, constructor] of profileConstructors.entries()) {
      await page.goto(`/constructors/${constructor.constructorId}`);
      const name = page.locator('.constructor-profile-name');
      await expect(name).toHaveText(constructor.name);
      await expect(name).toHaveCSS('letter-spacing', /^(normal|0px)$/);
      expect(await name.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await expect(page.locator('.constructor-profile-summary')).toContainText('2026');
      await expect(page.locator('.constructor-profile-hero')).toHaveCSS('background-image', /linear-gradient/);
      await expect(page.locator('.constructor-profile-hero h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (index === 0 || index === profileConstructors.length - 1) await page.locator('.constructor-profile-hero').screenshot({
        path: `artifacts/browser-qa/screenshots/typography-constructor-${constructor.constructorId}-${theme}-${info.project.name}.png`,
      });
      if (index === 0) {
        const chart = page.locator('.constructor-profile-shell .chart-scroll-container');
        await chart.scrollIntoViewIfNeeded();
        await expect(chart.locator('canvas')).toBeVisible();
        const section = page.locator('.constructor-profile-shell > .product-section-header');
        await section.evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.evaluate(() => window.scrollBy(0, -100));
        const headingBox = (await section.boundingBox())!;
        const cardBox = (await chart.locator('xpath=ancestor::div[contains(@class,"ant-card")][1]').boundingBox())!;
        await page.screenshot({
          path: `artifacts/browser-qa/screenshots/constructor-detail-${theme}-${info.project.name}.png`, animations: 'disabled',
          clip: { x: headingBox.x, y: headingBox.y, width: headingBox.width, height: cardBox.y + cardBox.height - headingBox.y },
        });
      }
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
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
