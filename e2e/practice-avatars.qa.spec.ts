import { expect, test } from '@playwright/test';
import { enterAsMember } from './auth-fixtures';

const roster = [
  ['RUS', 'George', 'Russell', 'mercedes', 'Mercedes', 'russell.png'],
  ['ANT', 'Kimi', 'Antonelli', 'mercedes', 'Mercedes', 'kimi_antonelli.png'],
  ['LEC', 'Charles', 'Leclerc', 'ferrari', 'Ferrari', 'leclerc.png'],
  ['HAM', 'Lewis', 'Hamilton', 'ferrari', 'Ferrari', 'hamilton.png'],
  ['VER', 'Max', 'Verstappen', 'red_bull', 'Red Bull Racing', 'max_verstappen.png'],
  ['NOR', 'Lando', 'Norris', 'mclaren', 'McLaren', 'norris.png'],
  ['LIN', 'Arvid', 'Lindblad', 'rb', 'Racing Bulls', 'lindblad.png'],
];
const results = roster.map(([code, givenName, familyName, constructorId, name], index) => ({
  number: String(index + 1), position: String(index + 1), positionText: String(index + 1),
  points: '0', grid: '-', laps: '20', status: '', Time: { millis: '', time: `1:2${index}.000` },
  Driver: { driverId: code.toLowerCase(), code, givenName, familyName, url: '', dateOfBirth: '', nationality: '' },
  Constructor: { constructorId, name, url: '', nationality: '' },
}));
const race = {
  season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08',
  FirstPractice: { date: '2026-03-06' }, SecondPractice: { date: '2026-03-06' }, ThirdPractice: { date: '2026-03-07' },
  Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park',
    Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.8', long: '144.9' } },
};

for (const source of ['database', 'snapshot']) {
  test(`practice avatars resolve timing codes from ${source}`, async ({ page }, testInfo) => {
    await enterAsMember(page);
    const errors: string[] = [];
    const failures: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => {
      if (!request.failure()?.errorText.includes('ERR_ABORTED')) failures.push(request.url());
    });
    page.on('response', response => {
      if (response.url().includes('/images/drivers/') && response.status() >= 400) failures.push(response.url());
    });
    await page.route('**/f1-api/**', route => {
      const classification = /\/(results|qualifying|sprint)(?:\/|\.)/.test(new URL(route.request().url()).pathname);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        MRData: { total: classification ? '0' : '1', RaceTable: { Races: classification ? [] : [race] }, StandingsTable: { StandingsLists: [] } },
      }) });
    });
    await page.route('**/rest/v1/**', route => {
      const url = new URL(route.request().url());
      const session = url.searchParams.get('session')?.replace('eq.', '') || 'FP1';
      const data = source === 'database' && url.pathname.endsWith('/race_session_results')
        ? (url.searchParams.get('select') === 'session' ? ['FP1', 'FP2', 'FP3'].map(session => ({ session }))
          : [{ season: 2026, round: 1, session, source: 'fastf1', payload: { season: '2026', round: '1', Results: results } }])
        : [];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.route('**/storage/v1/object/authenticated/fastf1-private/2026/1/*.json', route => {
      const session = new URL(route.request().url()).pathname.split('/').at(-1)!.replace('.json', '');
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        source: 'fastf1', generatedAt: '2026-03-08T12:00:00Z', season: '2026', round: '1', session,
        eventName: race.raceName, sessionName: 'Practice',
        sessionResults: results.map(result => ({ driver: result.Driver.code, driverId: result.Driver.driverId,
          firstName: result.Driver.givenName, lastName: result.Driver.familyName,
          fullName: `${result.Driver.givenName} ${result.Driver.familyName}`, team: result.Constructor.name,
          position: Number(result.position), time: result.Time.time, laps: 20 })),
        lapTimeSeries: [], tyreStrategies: [],
      }) });
    });
    await page.goto('/races/1/results?season=2026');
    for (const session of ['FP1', 'FP2', 'FP3']) {
      const tab = page.getByRole('tab', { name: new RegExp(session) });
      await tab.focus();
      await tab.click();
      const table = page.locator('.ant-tabs-tabpane-active .ant-table-tbody');
      await expect(table.locator('tr[data-row-key]')).toHaveCount(roster.length);
      for (const [, first, last, , , file] of roster) {
        const avatar = table.getByRole('img', { name: `${first} ${last}`, exact: true });
        await expect(avatar).toHaveAttribute('src', `/images/drivers/${file}`);
        await avatar.scrollIntoViewIfNeeded();
        await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      }
    }
    await page.getByRole('tab', { name: /FP1/ }).focus();
    await page.getByRole('tab', { name: /FP1/ }).click();
    await page.screenshot({ path: `artifacts/browser-qa/screenshots/practice-avatars-${source}-${testInfo.project.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    expect(await page.locator('body').evaluate(body => body.scrollWidth <= body.clientWidth + 1)).toBe(true);
  });
}
