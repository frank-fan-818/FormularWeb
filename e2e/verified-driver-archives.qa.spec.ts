import { expect, test } from '@playwright/test';
import manifest from '../data/reference/verified-driver-additions.json' with { type: 'json' };
import { buildVerifiedDriverAdditions } from '../src/utils/verifiedDriverAdditions';
import { enterAsMember } from './auth-fixtures';

test('global search opens all fifteen verified zero-start driver archives', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await enterAsMember(page);
  const payload = buildVerifiedDriverAdditions(manifest);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const historyFallbackRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) failedRequests.push(request.url());
  });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const driverId = url.searchParams.get('driver_id')?.replace(/^eq\./, '');
    const rows = url.pathname.endsWith('/driver_history_summary') ? payload.summaries
      : url.pathname.endsWith('/drivers') ? payload.drivers : [];
    await route.fulfill({ json: driverId ? rows.filter(row => row.driver_id === driverId) : rows });
  });
  await page.route('**/f1-api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (/\/f1-api\/drivers\/[^/]+\/results\.json$/.test(pathname)) historyFallbackRequests.push(pathname);
    const Drivers = pathname.endsWith('/drivers.json') ? manifest.drivers.map(driver => ({
      driverId: driver.upstreamId, givenName: driver.givenName, familyName: driver.familyName,
      dateOfBirth: driver.upstreamId === 'clapham' ? '1931-05-18' : driver.upstreamId === 'monarch' ? '1945-09-03' : driver.dateOfBirth,
      nationality: driver.upstreamId === 'vos' ? 'Dutch' : driver.upstreamId === 'reed' ? 'South African' : driver.nationality,
    })) : [];
    await route.fulfill({ json: { MRData: {
      total: String(Drivers.length), DriverTable: { Drivers }, ConstructorTable: { Constructors: [] },
      CircuitTable: { Circuits: [] }, RaceTable: { Races: [] }, SeasonTable: { Seasons: [] },
      StandingsTable: { StandingsLists: [] },
    } } });
  });

  for (const driver of manifest.drivers) {
    const fullName = `${driver.givenName} ${driver.familyName}`;
    await page.goto('/');
    const label = '搜索车手、车队、赛道或赛事';
    const trigger = page.getByRole('button', { name: label });
    const input = page.getByRole('combobox', { name: label });
    await expect(trigger.or(input)).toBeVisible();
    if (await trigger.isVisible().catch(() => false)) await trigger.click();
    await input.fill(fullName);
    const result = page.getByRole('listbox').getByRole('option').filter({ hasText: fullName });
    await expect(result).toHaveCount(1);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/history/drivers/${driver.driverId}$`));
    await expect(page.getByRole('heading', { name: fullName, exact: true })).toBeVisible();
    await expect(page.getByText(driver.participationNote, { exact: true })).toBeVisible();
    await expect(page.getByText('暂无世界锦标赛正赛出场记录。', { exact: true })).toBeVisible();
    await expect(page.getByText(`已核验报名次数：${driver.entryCount}`, { exact: true })).toBeVisible();
    await expect(page.locator('.driver-career-stat-card').filter({ hasText: '正赛出场' }).locator('.driver-career-stat-value'))
      .toHaveText('0');
    await expect(page.locator('.driver-career-stat-card').filter({ hasText: '世界冠军' }).locator('.driver-career-stat-value'))
      .toHaveText('0');
    const labelText = driver.participationStatus === 'test_reserve' ? '测试／储备车手' : '仅报名，未参加正赛';
    await expect(page.getByText(labelText, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
    if (driver.driverId === 'david_clapham' || driver.driverId === 'thomas_monarch') {
      await expect(page.locator('.driver-profile-shell')).not.toContainText(driver.driverId === 'david_clapham' ? '1931' : '1945');
    }
    if (driver.driverId === 'colton_herta' || driver.driverId === 'thomas_monarch') {
      await page.screenshot({ path: testInfo.outputPath(`${driver.driverId}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(historyFallbackRequests).toEqual([]);
});
