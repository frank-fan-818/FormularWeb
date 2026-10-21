import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test('global search keeps empty input idle while preloading and after clearing', async ({ page }, testInfo) => {
  await enterAsMember(page);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push(request.url()));
  let preloadStarted = false;
  let releasePreload!: () => void;
  const preloadGate = new Promise<void>(resolve => { releasePreload = resolve; });
  await page.route('**/rest/v1/**', async route => {
    const isDrivers = new URL(route.request().url()).pathname.endsWith('/drivers');
    if (isDrivers) {
      preloadStarted = true;
      await preloadGate;
    }
    await route.fulfill({ json: isDrivers ? [{
      driver_id: 'max_verstappen', first_name: 'Max', last_name: 'Verstappen', code: 'VER', nationality: 'Dutch',
    }] : [] });
  });
  await page.route('**/f1-api/**', route => route.fulfill({ json: { MRData: {
    total: '0', DriverTable: { Drivers: [] }, ConstructorTable: { Constructors: [] },
    CircuitTable: { Circuits: [] }, RaceTable: { Races: [] }, SeasonTable: { Seasons: [] },
    StandingsTable: { StandingsLists: [] },
  } } }));

  try {
    await page.goto('/settings');
    const label = '搜索车手、车队、赛道或赛事';
    await page.getByRole('button', { name: label }).click();
    const input = page.getByRole('combobox', { name: label });
    await expect(input).toBeFocused();
    await expect.poll(() => preloadStarted).toBe(true);
    await expect(page.locator('.global-search-dropdown')).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: testInfo.outputPath('search-idle.png'), fullPage: true });

    await input.fill('Max');
    await expect(page.locator('.global-search-feedback')).toContainText('搜索中');
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expect(page.locator('.global-search-dropdown')).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    releasePreload();
    await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('global-search-index-v6')))).toBe(true);
    await expect(page.locator('.global-search-dropdown')).toHaveCount(0);
    await input.fill('Max');
    await expect(page.getByRole('option', { name: /Max Verstappen/ })).toBeVisible();
    await page.getByRole('button', { name: '清空搜索' }).click();
    await expect(page.locator('.global-search-dropdown')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  } finally {
    releasePreload();
  }
});
