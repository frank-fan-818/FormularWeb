import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test(`race analysis modules render without overflow on ${viewport.name}`, async ({ page }) => {
    const startedAt = Date.now();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`${message.text()} ${message.location().url}`);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/races/1/race?season=2026', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Race analysis' })).toBeVisible({ timeout: 15_000 });
    const headingReadyMs = Date.now() - startedAt;
    await expect(page.locator('.fastf1-chart-card')).toHaveCount(5);
    await page.locator('#analysis-lap-pace').scrollIntoViewIfNeeded();
    await expect(page.locator('#analysis-lap-pace canvas')).toBeVisible({ timeout: 15_000 });
    const firstChartReadyMs = Date.now() - startedAt;
    expect(headingReadyMs).toBeLessThan(2_500);
    expect(firstChartReadyMs).toBeLessThan(3_000);

    const dimensions = await page.locator('body').evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    expect(pageErrors).toEqual([]);
    const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes('supabase.co'));
    expect(unexpectedConsoleErrors).toEqual([]);

    if (viewport.name === 'desktop') {
      await page.getByRole('tab', { name: /赛事概览/ }).click();
      await expect(page).toHaveURL(/\/results\?season=2026$/);
      const raceTab = page.getByRole('tab', { name: /比赛解读/ });
      await raceTab.hover();
      const repeatStartedAt = Date.now();
      await raceTab.click();
      await expect(page.getByRole('heading', { name: 'Race analysis' })).toBeVisible();
      expect(Date.now() - repeatStartedAt).toBeLessThan(750);
    }
  });
}
