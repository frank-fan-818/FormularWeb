import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { enterAsGuest } from './auth-fixtures';

const mapManifest = JSON.parse(readFileSync('src/data/circuit-detailed-maps.json', 'utf8')) as {
  maps: { circuitId: string; asset: string; year: number | null; width: number }[];
};

const circuits = [
  { circuitId: 'shanghai', circuitName: 'Shanghai International Circuit', Location: { locality: 'Shanghai', country: 'China', lat: '31.3389', long: '121.2200' } },
  { circuitId: 'monaco', circuitName: 'Circuit de Monaco', Location: { locality: 'Monte-Carlo', country: 'Monaco', lat: '43.7347', long: '7.42056' } },
  { circuitId: 'jeddah', circuitName: 'Jeddah Corniche Circuit', Location: { locality: 'Jeddah', country: 'Saudi Arabia', lat: '21.6319', long: '39.1044' } },
  { circuitId: 'adelaide', circuitName: 'Adelaide Street Circuit', Location: { locality: 'Adelaide', country: 'Australia', lat: '-34.927', long: '138.617' } },
];

test('expanded official library supports portrait PDF pages and mixed source image formats', async ({ page }, info) => {
  await enterAsGuest(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const samples = [
    { circuitId: 'buddh', circuitName: 'Buddh International Circuit' },
    { circuitId: 'jerez', circuitName: 'Circuito de Jerez' },
    { circuitId: 'dijon', circuitName: 'Circuit Dijon-Prenois' },
    { circuitId: 'kyalami', circuitName: 'Kyalami Grand Prix Circuit' },
    { circuitId: 'porto', circuitName: 'Circuito da Boavista' },
    { circuitId: 'anderstorp', circuitName: 'Scandinavian Raceway' },
  ].map(circuit => ({ ...circuit, Location: { locality: circuit.circuitId, country: 'Test', lat: '0', long: '0' } }));
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: String(samples.length), SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: samples.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));
  for (const circuit of samples) {
    const map = mapManifest.maps.find(map => map.circuitId === circuit.circuitId)!;
    await page.goto(`/circuits/${circuit.circuitId}`);
    const image = page.locator('.circuit-detailed-map__open > img');
    await expect(page.locator('.circuit-detailed-map')).toHaveAttribute('aria-busy', 'false');
    await expect(image).toHaveAttribute('src', map.asset);
    expect(await image.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(map.width);
    expect((await image.boundingBox())!.height).toBeLessThanOrEqual(520);
    const imageBox = (await image.boundingBox())!;
    const zoomLabelBox = (await page.locator('.circuit-detailed-map__zoom').boundingBox())!;
    expect(zoomLabelBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height);
    await expect(page.locator('.circuit-layout-heading > span')).toHaveText(`${map.year} CIRCUIT MAP`);
    for (const theme of ['light-mode', 'dark-mode']) {
      await page.evaluate(value => { document.documentElement.classList.remove('light-mode', 'dark-mode'); document.documentElement.classList.add(value); }, theme);
      await expect(page.locator('.circuit-layout-canvas')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await page.locator('.circuit-layout-panel').screenshot({ path: `artifacts/browser-qa/screenshots/library-${circuit.circuitId}-${theme}-${info.project.name}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: `放大${circuit.circuitName}赛道图` }).click();
      const dialog = page.getByRole('dialog', { name: `${circuit.circuitName}赛道图` });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('img')).toHaveCSS('width', `${map.width}px`);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('circuit profile presents one set of specs and an accessible flat layout', async ({ page }, info) => {
  await enterAsGuest(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') failures.push(request.url()); });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: String(circuits.length), SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: circuits.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));

  for (const circuit of circuits) {
    await page.goto(`/circuits/${circuit.circuitId}`);
    await expect(page.getByRole('heading', { name: circuit.circuitName, exact: true })).toBeVisible();
    const detailed = circuit.circuitId !== 'adelaide';
    await expect(page.locator('.circuit-profile-heading .product-metric-rail, .sector-legend')).toHaveCount(0);
    // Historical venues show the six sourced basics when the optional engineering
    // measurements are unavailable, instead of two permanent pending cards.
    await expect(page.locator('.stats-grid .stat-card')).toHaveCount(circuit.circuitId === 'adelaide' ? 6 : 8);
    await expect(page.locator('.stats-grid')).not.toContainText('资料待补');
    await expect(page.getByText('赛道长度', { exact: true })).toHaveCount(1);
    if (detailed) {
      await expect(page.locator('.circuit-detailed-map')).toHaveAttribute('aria-busy', 'false');
      const diagram = page.locator('.circuit-detailed-map__open > img');
      await expect(diagram).toBeVisible();
      await expect(diagram).toHaveAccessibleName(circuit.circuitName);
      expect(await diagram.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(1000);
      await expect(page.getByRole('button', { name: `放大${circuit.circuitName}赛道图` })).toBeEnabled();
      await expect(diagram).toHaveAttribute('src', `/images/circuits/detailed/${circuit.circuitId}.webp`);
    } else {
      await expect(page.getByText('暂无官网赛道图')).toBeVisible();
      await expect(page.locator('.circuit-layout-canvas img, .circuit-layout-canvas svg')).toHaveCount(0);
    }
    for (const theme of ['light-mode', 'dark-mode']) {
      await page.evaluate(value => {
        document.documentElement.classList.remove('light-mode', 'dark-mode');
        document.documentElement.classList.add(value);
      }, theme);
      await expect(page.locator('.circuit-layout-canvas')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      if (detailed) await expect(page.locator('.circuit-detailed-map__open')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/circuit-${circuit.circuitId}-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
      if (circuit.circuitId === 'jeddah') await page.locator('.circuit-layout-panel').screenshot({ path: `artifacts/browser-qa/screenshots/circuit-jeddah-white-${theme}-${info.project.name}.png`, animations: 'disabled' });
      if (circuit.circuitId === 'jeddah') {
        const zoom = page.getByRole('button', { name: `放大${circuit.circuitName}赛道图` });
        await zoom.click();
        const dialog = page.getByRole('dialog', { name: `${circuit.circuitName}赛道图` });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        await expect(dialog.locator('img')).toHaveCSS('width', '1252px');
        await dialog.screenshot({ path: `artifacts/browser-qa/screenshots/circuit-jeddah-zoom-${theme}-${info.project.name}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(zoom).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});

test('official circuit map shows loading and an unavailable state without reverting to an outline', async ({ page }) => {
  await enterAsGuest(page);
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: String(circuits.length), SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: circuits.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/images/circuits/detailed/jeddah.webp', async route => { await held; await route.fulfill({ status: 404, body: '' }); });
  try {
    await page.goto('/circuits/jeddah');
    await expect(page.getByRole('status', { name: '赛道图加载中' })).toBeVisible();
    release();
    await expect(page.getByText('官网赛道图暂不可用')).toBeVisible();
    await expect(page.locator('.circuit-layout-canvas img, .circuit-layout-canvas svg')).toHaveCount(0);
    await expect(page.getByRole('status', { name: '赛道图加载中' })).toHaveCount(0);
    await page.goto('/circuits/shanghai');
    await expect(page.locator('.circuit-detailed-map')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.circuit-detailed-map__open > img')).toBeVisible();
    await expect(page.locator('.circuit-map-unavailable')).toHaveCount(0);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('circuit atlas uses official previews on white in either theme and preserves card navigation', async ({ page }, info) => {
  await enterAsGuest(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: String(circuits.length), SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: circuits.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));
  await page.goto('/circuits');
  await expect(page.locator('.circuit-atlas-card')).toHaveCount(4);
  const maps = page.locator('.circuit-atlas-map img');
  await expect(maps).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const image = maps.nth(i);
    await image.scrollIntoViewIfNeeded();
    await expect(image.locator('..')).toHaveAttribute('aria-busy', 'false');
    await expect(image).toHaveAttribute('src', /\/images\/circuits\/detailed\/.*\.webp$/);
    expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThanOrEqual(1000);
  }
  await expect(page.locator('.circuit-atlas-map a, .circuit-atlas-map svg')).toHaveCount(0);
  await expect(page.getByText('暂无官网赛道图')).toBeVisible();
  for (const theme of ['light-mode', 'dark-mode']) {
    await page.evaluate(value => {
      document.documentElement.classList.remove('light-mode', 'dark-mode');
      document.documentElement.classList.add(value);
    }, theme);
    for (const map of await page.locator('.circuit-atlas-map').all()) await expect(map).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: `artifacts/browser-qa/screenshots/circuit-atlas-white-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.locator('.circuit-atlas-card').first().click();
  await expect(page).toHaveURL(/\/circuits\/shanghai$/);
  await expect(page.getByRole('heading', { name: 'Shanghai International Circuit', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
