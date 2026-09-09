import { expect, test } from '@playwright/test';
import italianArtifact from '../data/fia-upgrades/2026/13.json' with { type: 'json' };

for (const scenario of ['database', 'snapshot', 'empty', 'automatic'] as const) {
  test(`race upgrades render ${scenario} data`, async ({ page }, testInfo) => {
    const round = scenario === 'database' ? '4' : scenario === 'snapshot' ? '13' : '14';
    const race = {
      season: '2026', round, raceName: 'Italian Grand Prix', date: '2099-09-06',
      Circuit: { circuitId: 'monza', circuitName: 'Monza',
        Location: { locality: 'Monza', country: 'Italy', lat: '45.6', long: '9.2' } },
    };
    const errors: string[] = [];
    let publicationReady = false;
    const failedUpgradeRequests: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /fia.car.upgrade/i.test(message.text())) errors.push(message.text());
    });
    page.on('requestfailed', (request) => {
      if (/fia_car_upgrade|\/assets\/(?:4|13)-/.test(request.url())) failedUpgradeRequests.push(request.url());
    });
    await page.route('**/f1-api/**', (route) => {
      const isSession = /\/(results|qualifying)\.json/.test(route.request().url());
      const races = isSession ? [] : Array.from({ length: Number(round) }, (_, index) => ({
        ...race, round: String(index + 1),
      }));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ MRData: {
        total: String(races.length), RaceTable: { season: '2026', Races: races },
        StandingsTable: { StandingsLists: [] }, SeasonTable: { Seasons: [{ season: '2026' }] },
      } }) });
    });
    await page.route('**/rest/v1/**', (route) => route.fulfill({
      contentType: 'application/json',
      body: scenario === 'automatic' && publicationReady && new URL(route.request().url()).pathname.endsWith('/fia_race_upgrade_snapshots')
        ? JSON.stringify([{ artifact: { ...italianArtifact, season: 2026, round: 14, grandPrix: 'Italian Grand Prix',
          documentUrl: italianArtifact.records[0].documentUrl,
          records: italianArtifact.records.map(record => ({ ...record, round: 14 })),
          summaries: italianArtifact.summaries.map(summary => ({ ...summary, round: 14 })),
        } }])
        : scenario === 'database' && new URL(route.request().url()).pathname.endsWith('/fia_car_upgrades')
        ? JSON.stringify([{ season: 2026, round: 4, team: 'Ferrari', component: 'Floor',
          component_importance: 5, primary_reason: 'Performance' }]) : '[]',
    }));
    await page.route('**/fastf1/**', (route) => route.fulfill({ status: 404, body: '{}' }));
    if (scenario === 'automatic') await page.clock.install();
    await page.goto(`/races/${round}/info?season=2026`);
    const panel = page.getByRole('region', { name: '分站升级情况' });
    await expect(panel).toBeVisible();
    await panel.scrollIntoViewIfNeeded();
    if (scenario === 'automatic') {
      await expect(panel).toContainText('暂无本站 FIA 升级申报数据');
      publicationReady = true;
      await page.clock.fastForward(60_000);
      await expect(panel.locator('tbody tr.ant-table-row')).toHaveCount(10);
      await expect(panel).toContainText('Cadillac');
    } else if (scenario === 'empty') {
      await expect(panel).toContainText('暂无本站 FIA 升级申报数据');
    } else {
      await expect(panel.locator('tbody tr.ant-table-row')).toHaveCount(scenario === 'snapshot' ? 10 : 1);
      await expect(panel).toContainText(scenario === 'snapshot' ? 'Cadillac' : 'Ferrari');
      if (scenario === 'snapshot') {
        await expect(panel.locator('.race-weekend-metric strong').first()).toHaveText('26');
        await expect(panel.locator('a').first()).toHaveAttribute('href', /www\.fia\.com/);
      }
    }
    await panel.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    expect(failedUpgradeRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`upgrades-${scenario}.png`), fullPage: true });
  });
}
