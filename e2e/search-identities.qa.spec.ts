import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

test('global search reconciles source identities and replaces the duplicate v5 cache', async ({ page }, testInfo) => {
  await enterAsMember(page);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const navigationCancellations = new Set(['net::ERR_ABORTED', 'NS_BINDING_ABORTED', 'Load request cancelled']);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText || 'Unknown request failure';
    if (!navigationCancellations.has(error)) failedRequests.push(`${error}: ${request.url()}`);
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
    const rows = pathname.endsWith('/driver_history_summary') ? [{
      driver_id: 'charles_leclerc', given_name: 'Charles', family_name: 'Leclerc', code: 'LEC',
      nationality: 'Monegasque', date_of_birth: '1997-10-16', permanent_number: '16', url: '',
      recent_constructor_id: 'ferrari', recent_constructor_name: 'Ferrari',
      career_summary: { raceCount: 1 }, best_race_finish: null,
      seasons: [{ season: '2025', position: '2', points: 0, wins: 0, constructorId: 'ferrari', constructorName: 'Ferrari' }],
    }] : pathname.endsWith('/constructor_history_summary') ? [{
      constructor_id: 'alfa_romeo', name: 'Alfa Romeo', nationality: 'Italian', url: '',
      career_summary: { raceCount: 1 }, best_race_finish: null,
      seasons: [{ season: '2023', position: '9', points: 0, wins: 0 }],
    }] : pathname.endsWith('/drivers') ? [
      { driver_id: 'charles_leclerc', first_name: 'Charles', last_name: 'Leclerc', code: 'LEC', nationality: 'monaco', date_of_birth: '1997-10-16',
        permanent_number: '16', total_wins: 0, total_podiums: 0, total_pole_positions: 0, total_fastest_laps: 0, total_race_starts: 0 },
      { driver_id: 'charles_de_tornaco', first_name: 'Charles', last_name: 'De Tornaco', code: 'DET', nationality: 'belgium', date_of_birth: '1927-06-07' },
    ] : pathname.endsWith('/circuits') ? [
      { circuit_id: 'melbourne', name: 'Melbourne', locality: 'Melbourne', country: 'Australia',
        lat: null, long: null, length: null, turns: null, first_race: null, total_races: null,
        race_laps: null, total_distance: null, lap_record: null, lap_record_driver: null, lap_record_year: null },
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

  // Reload the settled home document to verify persisted v6 data in a fresh JS context.
  await page.reload();
  const cachedInput = await openSearch();
  await cachedInput.fill('Charles');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(2);
  await expect(page.getByRole('listbox').getByRole('option', { name: /Charles Leclerc/ })).toHaveCount(1);
  await page.getByRole('listbox').getByRole('option', { name: /Charles Leclerc/ }).click();
  await expect(page).toHaveURL(/\/history\/drivers\/charles_leclerc$/);
  await expect(page.getByRole('heading', { name: 'Charles Leclerc', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '历史生涯概览' })).toBeVisible();

  // Finish each SPA destination before using browser history to start another search.
  await page.goBack();
  await expect(page.locator('.home-command-surface')).toBeVisible();
  await (await openSearch()).fill('Albert Park');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('listbox').getByRole('option').click();
  await expect(page).toHaveURL(/\/circuits\/melbourne$/);
  await expect(page.getByRole('heading', { name: 'Melbourne', exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.locator('.home-command-surface')).toBeVisible();
  await (await openSearch()).fill('Alfa Romeo');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('listbox').getByRole('option').click();
  await expect(page).toHaveURL(/\/history\/constructors\/alfa_romeo$/);
  await expect(page.getByRole('heading', { name: 'Alfa Romeo', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
