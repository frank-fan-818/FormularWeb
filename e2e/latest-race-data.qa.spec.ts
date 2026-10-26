import { expect, test, type Page } from '@playwright/test';
import { enterAsMember, enterAsGuest } from './auth-fixtures';
import { readFileSync } from 'node:fs';

// Fixed observed data checked against the source on 2026-10-26. No live source
// requests in this regression; the server parser has the full DHL fixture too.
const race = { season: '2026', round: '18', raceName: 'United States Grand Prix', date: '2026-10-25', time: '20:00:00Z',
  Circuit: { circuitId: 'americas', circuitName: 'Circuit of the Americas', Location: { locality: 'Austin', country: 'USA', lat: '30.1328', long: '-97.6411' } },
  FirstPractice: { date: '2026-10-23', time: '17:30:00Z' }, SecondPractice: { date: '2026-10-23', time: '21:00:00Z' },
  ThirdPractice: { date: '2026-10-24', time: '17:30:00Z' }, Qualifying: { date: '2026-10-24', time: '21:00:00Z' } };
const summary = { airTempC: { min: 26.7, max: 27.6, average: 27.1038 }, trackTempC: { min: 34.1, max: 37.8, average: 35.867 },
  humidityPct: { min: 38.6, max: 44.6, average: 40.8783 }, rainPointCount: 0, rainLapRanges: [], maxWindSpeedMps: 3.6 };
const weather = { season: '2026', round: '18', source: 'openf1', sessionKey: 11396, summary, updatedAt: '2026-10-26T05:18:54.840Z' };

async function mockRace(page: Page) {
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const calendar = Array.from({ length: 18 }, (_, i) => ({ ...race, round: String(i + 1), raceName: i === 17 ? race.raceName : `Round ${i + 1}` }));
    const races = /results|qualifying|sprint|practice/.test(path) ? [] : calendar;
    return route.fulfill({ json: { MRData: { total: String(races.length), RaceTable: { Races: races },
      StandingsTable: { StandingsLists: [] }, SeasonTable: { Seasons: [{ season: '2026' }] } } } });
  });
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', route => route.fulfill({ json: {
    source: 'fastf1', generatedAt: '2026-05-28T07:22:50Z', season: '2026', round: '18', session: 'R',
    eventName: race.raceName, sessionName: 'Race', sessionResults: [], lapTimeSeries: [], tyreStrategies: [], trackStatusPeriods: [],
  } }));
}

test('latest US GP fills circuit parameters and measured weather after an empty FastF1 snapshot', async ({ page }, info) => {
  await enterAsMember(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockRace(page);
  const errors: string[] = []; const failures: string[] = []; const emptySourceWarnings: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (!['warning', 'error'].includes(message.type()) || message.text() === 'Service Worker registration blocked by Playwright') return;
    // This test intentionally reproduces both empty FastF1 sources. Keep their
    // precise structured diagnostics visible and assert them separately.
    try {
      const log = JSON.parse(message.text());
      if (log.module === 'race_detail' && log.reasonCode === 'source_empty' && log.outcome === 'degraded'
        && ['fastf1_static', 'fastf1_source'].includes(log.operation)) { emptySourceWarnings.push(log.operation); return; }
    } catch { /* Other warnings remain failures. */ }
    errors.push(message.text());
  });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  let calls = 0;
  await page.route('**/api/race-weather?**', route => {
    expect(route.request().headers().authorization).toBe('Bearer test-only-access-token');
    calls++;
    return route.fulfill({ json: weather });
  });
  await page.goto('/races/18/info?season=2026');
  await expect(page.locator('.weekend-circuit-strip')).toContainText('逆时针');
  await expect(page.locator('.weekend-circuit-strip dd').nth(1)).toHaveText('20');
  const panel = page.locator('.weather-brief');
  await expect(panel).toContainText('OpenF1 · 正赛实测');
  await expect(panel).toContainText('34.1℃');
  await expect(panel).toContainText('37.8℃');
  await expect(panel).toContainText('26.7℃');
  await expect(panel).toContainText('3.6 m/s');
  await expect(panel).not.toContainText('暂无可用的天气数据');
  expect(calls).toBe(1);
  expect(emptySourceWarnings.sort()).toEqual(['fastf1_source', 'fastf1_static']);
  await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/latest-race-weather-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test('weather fallback reports source errors and supports retry', async ({ page }) => {
  await enterAsMember(page);
  await mockRace(page);
  let calls = 0;
  await page.route('**/api/race-weather?**', route => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 502, json: { code: 'WEATHER_UNAVAILABLE' } }) : route.fulfill({ json: weather });
  });
  await page.goto('/races/18/info?season=2026');
  const panel = page.locator('.weather-brief');
  await expect(panel.getByRole('alert')).toContainText('天气数据读取失败');
  await panel.getByRole('button', { name: '重试天气数据' }).click();
  await expect(panel).toContainText('37.8℃');
  await expect(panel.getByRole('alert')).toHaveCount(0);
});

test('weather fallback keeps loading and an actual empty observation response distinct', async ({ page }) => {
  await enterAsMember(page);
  await mockRace(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/race-weather?**', async route => { await held; await route.fulfill({ json: { ...weather, summary: null } }); });
  try {
    await page.goto('/races/18/info?season=2026');
    const panel = page.locator('.weather-brief');
    await expect(panel.getByText('正在加载天气概况', { exact: true })).toBeVisible();
    await expect(panel.getByText('暂无可用的天气数据', { exact: true })).toHaveCount(0);
    release();
    await expect(panel.getByText('暂无可用的天气数据', { exact: true })).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('DHL current event without event_id renders official ranks and time precision', async ({ page }, info) => {
  await enterAsGuest(page);
  await mockRace(page);
  const raw = JSON.parse(readFileSync('scripts/fixtures/dhl-event-2026-austin.json', 'utf8')) as {
    data: { chart: Array<{ id: number; team: string; firstName: string; lastName: string; tla: string; duration: number; lap: number; points: number }> };
  };
  // Preserve the published ranks; rank 5 is a non-scoring stop absent from DHL's scoring chart.
  const ranks = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11];
  const stops = raw.data.chart.map((row, i) => ({ id: String(row.id), rank: ranks[i], driver: `${row.firstName} ${row.lastName}`, team: row.team,
    code: row.tla, duration: row.duration.toFixed(2), lap: row.lap, points: row.points, irregular: false, notes: '' }));
  await page.route('**/api/pit-stops?**', route => route.fulfill({ json: { season: '2026', seasons: [2026], source: 'https://inmotion.dhl/en/formula-1/fastest-pit-stop-award',
    updatedAt: '2026-10-26T05:18:54.840Z', stale: false, standings: [], stops, seasonFastest: [], event: 'Circuit of The Americas' } }));
  await page.goto('/pit-stops?season=2026&round=18&view=event');
  await expect(page.locator('.pit-award-table tbody tr')).toHaveCount(10);
  await expect(page.locator('.pit-award-table tbody tr').first()).toContainText('PIA');
  await expect(page.locator('.pit-award-table tbody tr').first()).toContainText('2.11 s');
  await expect(page.locator('.pit-award-table tbody tr').nth(1)).toContainText('2.30 s');
  await expect(page.getByText('进站数据加载失败', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/latest-race-pit-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
});
