import { expect, test } from '@playwright/test';

test('race calendar loading state is responsive and motion-safe', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/f1-api/**', async (requestRoute) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await requestRoute.abort('timedout');
  });

  await page.goto('/races', { waitUntil: 'domcontentloaded' });
  const beacon = page.getByRole('status', { name: /Synchronising race calendar/i });
  await expect(beacon).toBeVisible();
  await expect(beacon).toHaveAttribute('data-loading-variant', 'panel');

  const dimensions = await page.locator('body').evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await expect(beacon.locator('.timing-beacon__marker')).toHaveCSS('animation-name', 'none');

  await page.screenshot({
    path: `artifacts/browser-qa/screenshots/loading-races-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
