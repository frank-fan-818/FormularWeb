import { expect, test, type Page } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const teams = ['Mercedes', 'McLaren', 'Ferrari'].map(name => ({ constructorId: name.toLowerCase(), name, nationality: 'British', url: '#' }));
const drivers = [
  ['russell', 'George', 'Russell'], ['antonelli', 'Andrea Kimi', 'Antonelli'],
  ['norris', 'Lando', 'Norris'], ['leclerc', 'Charles', 'Leclerc'],
].map(([driverId, givenName, familyName]) => ({ driverId, givenName, familyName, code: driverId.slice(0, 3).toUpperCase(), permanentNumber: '1', dateOfBirth: '2000-01-01', nationality: 'British', url: '#' }));
const points = [[25, 18, 15, 0], [25, 51, 25, 0], [43, 63, 43, 0]];
const calendar = ['Australian', 'Chinese', 'Japanese'].map((name, i) => ({ season: '2026', round: String(i + 1), raceName: `Formula 1 Official Sponsor ${name} Grand Prix 2026`, date: `2026-0${i + 3}-08`, time: '04:00:00Z',
  Circuit: { circuitId: ['albert_park', 'shanghai', 'suzuka'][i], circuitName: `${name} Circuit`, Location: { locality: name, country: name, lat: '0', long: '0' } },
}));

function roundPoints(round: number) {
  return points[round - 1] || points[2].map((value, i) => value + (round - 3) * [18, 20, 14, 8][i]);
}

function standings(round: number) {
  return { season: '2026', round: String(round),
    DriverStandings: drivers.map((Driver, i) => ({ Driver, Constructors: [teams[i < 2 ? 0 : i - 1]], position: String(i + 1), positionText: String(i + 1), points: String(roundPoints(round)[i]), wins: '1' })),
    ConstructorStandings: teams.map((Constructor, i) => ({ Constructor, position: String(i + 1), positionText: String(i + 1), points: String(i === 0 ? roundPoints(round)[0] + roundPoints(round)[1] : roundPoints(round)[i + 1]), wins: '1' })),
  };
}

async function fixtures(page: Page, raceCalendar = calendar) {
  await enterAsMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/f1-api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const round = Number(/\/2026\/(\d+)\//.exec(path)?.[1] || raceCalendar.length);
    const isStandings = /\/(driverStandings|constructorStandings)\.json$/.test(path);
    const isCalendar = path.endsWith('/2026.json');
    const isSprint = path.endsWith('/sprint.json');
    const isWinner = path.endsWith('/results/1.json');
    const driverId = /\/drivers\/([^/]+)\/results/.exec(path)?.[1];
    const constructorId = /\/constructors\/([^/]+)\/results/.exec(path)?.[1];
    const races = isCalendar ? raceCalendar : isSprint ? [] : raceCalendar.map((race, roundIndex) => ({ ...race,
      Results: drivers.map((Driver, i) => ({ Driver, Constructor: teams[i < 2 ? 0 : i - 1], number: String(i + 1), position: String(i + 1), positionText: String(i + 1),
        points: String(roundPoints(roundIndex + 1)[i] - (roundIndex ? roundPoints(roundIndex)[i] : 0)), grid: String(i + 1), laps: '56', status: 'Finished' }))
        .filter(result => (!driverId || result.Driver.driverId === driverId) && (!constructorId || result.Constructor.constructorId === constructorId)
          && (!isWinner || result.position === '1')),
    }));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: {
      total: String(isStandings ? path.includes('constructorStandings') ? teams.length : drivers.length : races.length),
      RaceTable: { season: '2026', Races: races }, StandingsTable: { StandingsLists: isStandings ? [standings(round)] : [] },
      SeasonTable: { Seasons: [{ season: '2026' }] }, DriverTable: { Drivers: drivers }, ConstructorTable: { Constructors: teams },
    } }) });
  });
}

async function choose(page: Page, name: string, kind: 'driver' | 'constructor' = 'driver') {
  await page.getByRole('combobox', { name: kind === 'driver' ? '选择对比车手' : '选择对比车队' }).selectOption({ label: name });
}

for (const kind of ['driver', 'constructor'] as const) {
  test(`${kind} points comparison shows aligned curves, official gaps and readable controls`, async ({ page }, info) => {
    await fixtures(page);
    const errors: string[] = [];
    const failedRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['error', 'warning'].includes(message.type()) && message.text() !== 'Service Worker registration blocked by Playwright') errors.push(message.text()); });
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(request.url()); });
    const own = kind === 'driver' ? 'George Russell' : 'Mercedes';
    const opponent = kind === 'driver' ? 'Andrea Kimi Antonelli' : 'McLaren';
    let snapshotRequests = 0;
    page.on('request', request => { if (/\/2026\/\d+\/(driverStandings|constructorStandings)\.json/.test(request.url())) snapshotRequests += 1; });
    for (const theme of ['light', 'dark']) {
      await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({ version: 3,
        state: { currentSeason: '2026', theme, features: {}, sidebarCollapsed: false },
      })), theme);
      await page.goto(kind === 'driver' ? '/drivers/russell' : '/constructors/mercedes');
      const card = page.locator('.season-points-card');
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('canvas')).toBeVisible();
      const requestsBefore = snapshotRequests;
      await card.getByRole('button', { name: '对比', exact: true }).click();
      await expect(card.getByRole('combobox')).toBeVisible();
      expect(snapshotRequests).toBe(requestsBefore);
      await expect(page.getByRole('option', { name: own, exact: true })).toHaveCount(0);
      if (kind === 'driver' && theme === 'light') {
        const selector = card.getByRole('combobox', { name: '选择对比车手' });
        await selector.focus();
        await selector.press('ArrowDown');
        await expect(selector).toHaveValue('antonelli');
      } else await choose(page, opponent, kind);
      const summary = card.getByRole('status', { name: '当前积分对比' });
      await expect(summary).toHaveCount(0);
      await expect(card.locator('.points-comparison-controls')).not.toContainText(/领先|落后|积分持平/);
      await expect(card).toContainText('截至第 3 站');
      await expect(card.getByRole('img', { name: `${own} 与 ${opponent} 本赛季逐站累计积分对比图。` }).locator('canvas')).toBeVisible();
      const canvas = card.locator('canvas');
      const plot = (await canvas.boundingBox())!;
      await canvas.hover({ position: { x: plot.width / 2, y: plot.height / 3 } });
      await expect(card.getByText(`R2 · Chinese`, { exact: true })).toBeVisible();
      const gapTooltip = card.getByText(`${own} ${kind === 'driver' ? '落后 26 分' : '领先 51 分'}`, { exact: true });
      await expect(gapTooltip).toBeVisible();
      if (info.project.name === 'desktop-chromium' && theme === 'light') {
        await expect.poll(async () => (await gapTooltip.boundingBox())?.x ?? 0).toBeGreaterThan(plot.x + plot.width / 3);
        await card.screenshot({ path: `artifacts/browser-qa/screenshots/points-comparison-${kind}-hover-desktop.png`, animations: 'disabled', style: '.header { visibility: hidden; }' });
      }
      await page.mouse.move(0, 0);
      await expect(gapTooltip).toBeHidden();
      await card.locator('.chart-data-view > summary').click();
      const dataSeries = card.locator('.chart-data-view__toolbar select');
      await expect(dataSeries.locator('option')).toHaveText([own, opponent]);
      await dataSeries.selectOption({ label: opponent });
      await expect(card.locator('.chart-data-view tbody tr').last()).toContainText(kind === 'driver' ? '63' : '43');
      await card.locator('.chart-data-view > summary').click();
      // Isolate the chart card from the fixed site header in component screenshots.
      await card.screenshot({ path: `artifacts/browser-qa/screenshots/points-comparison-${kind}-${theme}-${info.project.name}.png`, animations: 'disabled', style: '.header { visibility: hidden; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      const afterLoad = snapshotRequests;
      await choose(page, kind === 'driver' ? 'Lando Norris' : 'Ferrari', kind);
      await expect(summary).toHaveCount(0);
      await expect(card.getByRole('img', { name: new RegExp(kind === 'driver' ? 'Lando Norris' : 'Ferrari') }).locator('canvas')).toBeVisible();
      const switchedCanvas = card.locator('canvas');
      const switchedPlot = (await switchedCanvas.boundingBox())!;
      await switchedCanvas.hover({ position: { x: switchedPlot.width / 2, y: switchedPlot.height / 3 } });
      const switchedGap = card.getByText(`${own} ${kind === 'driver' ? '积分持平' : '领先 76 分'}`, { exact: true });
      await expect(switchedGap).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(switchedGap).toBeHidden();
      expect(snapshotRequests).toBe(afterLoad);
      await card.getByRole('combobox').selectOption('');
      await expect(summary).toHaveCount(0);
      await card.getByRole('button', { name: '结束对比' }).click();
      await expect(card.getByRole('combobox')).toHaveCount(0);
      await expect(summary).toHaveCount(0);
      await expect(card.getByRole('img', { name: kind === 'driver' ? '车手本赛季各分站积分与累计积分趋势图。' : '车队本赛季各分站积分与累计积分趋势图。' })).toBeVisible();
    }
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
}

test('points comparison recovers loading failures and leaves missing rounds unfilled', async ({ page }) => {
  await fixtures(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route('**/2026/driverStandings.json?limit=100', async route => {
    await gate;
    if (fail) { await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); return; }
    await route.fallback();
  });
  await page.route('**/2026/2/driverStandings.json?limit=100', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: { total: '0', StandingsTable: { StandingsLists: [] } } }) }));
  await page.goto('/drivers/russell');
  const card = page.locator('.season-points-card');
  await card.getByRole('button', { name: '对比', exact: true }).click();
  await choose(page, 'Andrea Kimi Antonelli');
  await expect(card.getByRole('status')).toContainText('正在读取逐站积分');
  release();
  await expect(card.getByRole('alert')).toContainText('暂时无法读取对比数据');
  await expect(card.getByRole('status', { name: '当前积分对比' })).toHaveCount(0);
  fail = false;
  await card.getByRole('button', { name: '重试', exact: true }).click();
  await expect(card.getByRole('status', { name: '当前积分对比' })).toHaveCount(0);
  await expect(card.getByRole('img', { name: 'George Russell 与 Andrea Kimi Antonelli 本赛季逐站累计积分对比图。' })).toBeVisible();
  await expect(card).toContainText('部分分站积分暂缺，曲线保留空缺');
  await card.locator('.chart-scroll-container').scrollIntoViewIfNeeded();
  await card.locator('.chart-data-view > summary').click();
  await expect(card.locator('.chart-data-view tbody tr').nth(1)).toContainText('—');
});

for (const kind of ['driver', 'constructor'] as const) {
  test(`${kind} points comparison keeps 17 sponsored rounds compact and shows loading progress`, async ({ page }, info) => {
    const venues = ['Australia', 'China', 'Japan', 'Miami', 'Canada', 'Monaco', 'Barcelona', 'Austria', 'Britain',
      'Belgium', 'Hungary', 'Netherlands', 'Italy', 'Spain', 'Azerbaijan', 'Malaysia', 'Singapore'];
    const season = venues.map((name, i) => ({ ...calendar[0], round: String(i + 1),
      raceName: `Formula 1 Official Championship Title Sponsor ${name} Grand Prix 2026`,
      Circuit: { ...calendar[0].Circuit, circuitId: `venue_${i}`,
        Location: { ...calendar[0].Circuit.Location, country: name, locality: name } },
    }));
    await fixtures(page, season);
    // Reproduce the production mismatch: the DB omits Malaysia and assigns the
    // future United States event to R17, while official R17 results are Singapore.
    const shifted = [...season.filter(race => race.Circuit.Location.country !== 'Malaysia'), {
      ...season[16], raceName: 'United States Grand Prix', date: '2099-10-25',
      Circuit: { ...season[16].Circuit, circuitId: 'americas',
        Location: { ...season[16].Circuit.Location, country: 'United States' } },
    }].map((race, i) => ({ ...race, round: String(i + 1) }));
    await page.route('**/rest/v1/races?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(
      shifted.map(race => ({ season: 2026, round: Number(race.round), race_name: race.raceName, date: race.date,
        circuit_id: race.Circuit.circuitId })),
    ) }));
    await page.route('**/rest/v1/circuits?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(
      shifted.map(race => ({ circuit_id: race.Circuit.circuitId, name: race.Circuit.circuitName,
        country: race.Circuit.Location.country, locality: race.Circuit.Location.locality })),
    ) }));
    let release!: () => void;
    const slowRound = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/2026/2/${kind === 'driver' ? 'driverStandings' : 'constructorStandings'}.json?limit=100`, async route => {
      await slowRound;
      await route.fallback();
    });
    await page.goto(kind === 'driver' ? '/drivers/russell' : '/constructors/mercedes');
    const card = page.locator('.season-points-card');
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('canvas')).toBeVisible();
    await card.getByRole('button', { name: '对比', exact: true }).click();
    await choose(page, kind === 'driver' ? 'Andrea Kimi Antonelli' : 'McLaren', kind);
    try {
      await expect(card.getByRole('status')).toContainText('正在读取逐站积分');
      await expect(card.getByRole('progressbar')).toHaveAttribute('value', '16');
      await expect(card.getByRole('progressbar')).toHaveAttribute('max', '17');
      await expect(card.locator('.chart-scroll-container')).toHaveAttribute('aria-busy', 'true');
      await card.screenshot({ path: `artifacts/browser-qa/screenshots/points-loading-${kind}-${info.project.name}.png`,
        animations: 'disabled', style: '.header { visibility: hidden; }' });
    } finally { release(); }
    await expect(card.getByRole('status')).toHaveCount(0);
    await expect(card.locator('.chart-scroll-container')).toHaveAttribute('aria-busy', 'false');
    await card.locator('.chart-data-view > summary').click();
    await expect(card.locator('.chart-data-view tbody tr')).toHaveCount(17);
    await expect(card.locator('.chart-data-view tbody')).not.toContainText(/Formula 1|Grand Prix|2026/);
    await expect(card.locator('.chart-data-view tbody tr').last()).toContainText('Singapore');
    await expect(card.locator('.chart-data-view tbody')).not.toContainText('United States');
    await card.locator('.chart-data-view > summary').click();
    if (info.project.name === 'desktop-chromium') {
      const canvas = card.locator('canvas');
      const bounds = (await canvas.boundingBox())!;
      await canvas.hover({ position: { x: bounds.width * 0.95, y: bounds.height / 2 } });
      await expect(card.getByText('R17 · Singapore', { exact: true })).toBeVisible();
      await page.mouse.move(0, 0);
    }
    await card.screenshot({ path: `artifacts/browser-qa/screenshots/points-17-rounds-${kind}-${info.project.name}.png`,
      animations: 'disabled', style: '.header { visibility: hidden; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
