import { expect, test } from '@playwright/test';

test('race analysis route remains responsive across available data states', async ({ page }, testInfo) => {
    const startedAt = Date.now();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(`${message.text()} ${message.location().url}`);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/races/1/race?season=2026', { waitUntil: 'domcontentloaded' });
    const stateHeading = page.getByRole('heading', {
      name: /Race analysis|Building the race debrief|Race analysis is not available yet/,
    });
    await expect(stateHeading).toBeVisible({ timeout: 15_000 });
    const headingReadyMs = Date.now() - startedAt;
    expect(headingReadyMs).toBeLessThan(2_500);

    const populatedHeading = page.getByRole('heading', { name: 'Race analysis', exact: true });
    if (await populatedHeading.isVisible()) {
      await expect(page.locator('.fastf1-chart-card')).toHaveCount(5);
      await page.locator('#analysis-lap-pace').scrollIntoViewIfNeeded();
      await expect(page.locator('#analysis-lap-pace canvas')).toBeVisible({ timeout: 15_000 });
      expect(Date.now() - startedAt).toBeLessThan(3_000);
    } else {
      expect(await page.locator('.analysis-module-state-card').count()).toBeGreaterThan(0);
    }

    const dimensions = await page.locator('body').evaluate((body) => ({
      clientWidth: body.clientWidth,
      scrollWidth: body.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    expect(pageErrors).toEqual([]);
    const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes('supabase.co'));
    expect(unexpectedConsoleErrors).toEqual([]);

    if (testInfo.project.name === 'desktop-chromium') {
      await page.getByRole('tab', { name: /赛事概览/ }).click();
      await expect(page).toHaveURL(/\/results\?season=2026$/);
      const raceTab = page.getByRole('tab', { name: /比赛解读/ });
      await raceTab.hover();
      const repeatStartedAt = Date.now();
      await raceTab.click();
      await expect(stateHeading).toBeVisible();
      expect(Date.now() - repeatStartedAt).toBeLessThan(750);
    }
});
