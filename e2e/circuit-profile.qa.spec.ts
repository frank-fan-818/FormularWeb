import { expect, test } from '@playwright/test';
import { enterAsGuest } from './auth-fixtures';

const circuits = [
  { circuitId: 'shanghai', circuitName: 'Shanghai International Circuit', Location: { locality: 'Shanghai', country: 'China', lat: '31.3389', long: '121.2200' } },
  { circuitId: 'monaco', circuitName: 'Circuit de Monaco', Location: { locality: 'Monte-Carlo', country: 'Monaco', lat: '43.7347', long: '7.42056' } },
];

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
    total: '2', SeasonTable: { Seasons: [{ season: '2026' }] }, StandingsTable: { StandingsLists: [] },
    RaceTable: { Races: circuits.map((Circuit, i) => ({ season: '2026', round: String(i + 1), raceName: Circuit.circuitName,
      date: '2026-03-15', time: '07:00:00Z', Circuit })) },
  } } }));

  for (const circuit of circuits) {
    await page.goto(`/circuits/${circuit.circuitId}`);
    await expect(page.getByRole('heading', { name: circuit.circuitName, exact: true })).toBeVisible();
    const diagram = page.locator('.circuit-technical-map svg');
    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAccessibleName(circuit.circuitName);
    await expect(page.locator('.circuit-profile-heading .product-metric-rail, .sector-legend')).toHaveCount(0);
    await expect(page.locator('.stats-grid .stat-card')).toHaveCount(8);
    await expect(page.getByText('赛道长度', { exact: true })).toHaveCount(1);
    await expect(page.locator('.circuit-turn-label')).toHaveCount(circuit.circuitId === 'shanghai' ? 16 : 0);
    if (circuit.circuitId === 'shanghai') {
      const positions = await page.locator('.circuit-turn-label').evaluateAll(labels => labels.map(label => {
        const box = label.getBoundingClientRect();
        return `${box.x.toFixed(1)},${box.y.toFixed(1)}`;
      }));
      expect(new Set(positions).size).toBe(16);
    }
    for (const theme of ['light-mode', 'dark-mode']) {
      await page.evaluate(value => {
        document.documentElement.classList.remove('light-mode', 'dark-mode');
        document.documentElement.classList.add(value);
      }, theme);
      await page.screenshot({ path: `artifacts/browser-qa/screenshots/circuit-${circuit.circuitId}-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
