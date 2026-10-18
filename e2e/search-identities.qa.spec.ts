import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test('global search reconciles source identities and replaces the duplicate v5 cache', async ({ page }, testInfo) => {
  await enterAsMember(page);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') failedRequests.push(request.url());
  });
  await page.addInitScript(() => {
    if (localStorage.getItem('global-search-index-v6')) return;
    const data = ['leclerc', 'charles_leclerc'].map(id => ({
      entry: { type: 'driver', id, title: 'Charles Leclerc', subtitle: 'Legacy duplicate', route: `/history/drivers/${id}`, keywords: ['charles'] },
      primaryKeywords: ['charles'], aliasKeywords: [],
    }));
    localStorage.setItem('global-search-index-v5', JSON.stringify({ timestamp: Date.now(), data }));
  });
  await page.route('**/rest/v1/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const rows = pathname.endsWith('/drivers') ? [
      { driver_id: 'charles_leclerc', first_name: 'Charles', last_name: 'Leclerc', code: 'LEC', nationality: 'monaco', date_of_birth: '1997-10-16' },
      { driver_id: 'charles_de_tornaco', first_name: 'Charles', last_name: 'De Tornaco', code: 'DET', nationality: 'belgium', date_of_birth: '1927-06-07' },
    ] : pathname.endsWith('/circuits') ? [
      { circuit_id: 'melbourne', name: 'Melbourne', locality: 'Melbourne', country: 'Australia' },
    ] : pathname.endsWith('/constructors') ? [
      { constructor_id: 'alfa_romeo', name: 'Alfa Romeo', nationality: 'italy' },
    ] : [];
    await route.fulfill({ json: rows });
  });
  await page.route('**/f1-api/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const Drivers = pathname.endsWith('/drivers.json') ? [
      { driverId: 'leclerc', givenName: 'Charles', familyName: 'Leclerc', code: 'LEC', nationality: 'Monegasque', dateOfBirth: '1997-10-16' },
      { driverId: 'tornaco', givenName: 'Charles', familyName: 'de Tornaco', nationality: 'Belgian', dateOfBirth: '1927-06-07' },
    ] : [];
    const Circuits = pathname.endsWith('/circuits.json') ? [
      { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit', Location: { locality: 'Melbourne', country: 'Australia' } },
    ] : [];
    const Constructors = pathname.endsWith('/constructors.json') ? [
      { constructorId: 'alfa', name: 'Alfa Romeo', nationality: 'Italian' },
    ] : [];
    await route.fulfill({ json: { MRData: {
      total: String(Drivers.length + Circuits.length + Constructors.length),
      DriverTable: { Drivers }, CircuitTable: { Circuits }, ConstructorTable: { Constructors },
      RaceTable: { Races: [] }, SeasonTable: { Seasons: [] }, StandingsTable: { StandingsLists: [] },
    } } });
  });

  const openSearch = async () => {
    const trigger = page.getByRole('button', { name: '搜索车手、车队、赛道或赛事' });
    const input = page.getByRole('combobox', { name: '搜索车手、车队、赛道或赛事' });
    await expect(trigger.or(input)).toBeVisible();
    if (await trigger.isVisible().catch(() => false)) await trigger.click();
    return input;
  };

  await page.goto('/');
  const input = await openSearch();
  await input.fill('Charles');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('listbox').getByRole('option', { name: /Charles Leclerc/ })).toHaveCount(1);
  await expect(page.getByRole('listbox').getByRole('option', { name: /Charles De Tornaco/ })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('global-search-index-v5'))).toBeNull();
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem('global-search-index-v6')))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('search-identities.png'), fullPage: true });
  await page.getByRole('listbox').getByRole('option', { name: /Charles Leclerc/ }).click();
  await expect(page).toHaveURL(/\/history\/drivers\/charles_leclerc$/);

  await page.goto('/');
  const cachedInput = await openSearch();
  await cachedInput.fill('Charles');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await cachedInput.fill('Albert Park');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('listbox').getByRole('option').click();
  await expect(page).toHaveURL(/\/circuits\/melbourne$/);

  await page.goto('/');
  await (await openSearch()).fill('Alfa Romeo');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('listbox').getByRole('option').click();
  await expect(page).toHaveURL(/\/history\/constructors\/alfa_romeo$/);
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
