import { expect, test, type Page } from '@playwright/test';
import { enterAsGuest, mockAuth } from './auth-fixtures';

async function installSeason(page: Page) {
  await enterAsGuest(page);
  const race = {
    season: '2026', round: '1', raceName: 'A Long Grand Prix Name For Responsive Reading',
    date: '2099-03-08', time: '04:00:00Z',
    FirstPractice: { date: '2099-03-06', time: '01:00:00Z' },
    SecondPractice: { date: '2099-03-06', time: '05:00:00Z' },
    ThirdPractice: { date: '2099-03-07', time: '01:00:00Z' },
    Qualifying: { date: '2099-03-07', time: '05:00:00Z' },
    Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park Grand Prix Circuit',
      Location: { locality: 'Melbourne', country: 'Australia', lat: '-37.8497', long: '144.968' } },
  };
  await page.route('**/f1-api/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ MRData: { total: '1', RaceTable: { Races: [race] },
      StandingsTable: { StandingsLists: [] }, SeasonTable: { Seasons: [{ season: '2026' }] } } }),
  }));
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
}

test('guest home preserves hierarchy and readable contrast in both themes', async ({ page }, info) => {
  await installSeason(page);
  const errors: string[] = [];
  const protectedRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (/race_prediction_current|fastf1-private/.test(request.url())) protectedRequests.push(request.url());
  });
  for (const theme of ['light', 'dark']) {
    await page.addInitScript(theme => localStorage.setItem('f1-dashboard-storage', JSON.stringify({
      version: 3, state: { currentSeason: '2026', theme, sidebarCollapsed: false, features: {} },
    })), theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(new RegExp(`${theme}-mode`));
    const surface = page.locator('.home-command-surface');
    await expect(surface.getByRole('heading', { level: 1 })).toBeVisible();
    const gate = surface.getByRole('region', { name: '赛事预测需要登录' });
    await expect(gate).toBeVisible();
    expect((await gate.boundingBox())!.height).toBeLessThan(190);
    const contrast = await surface.evaluate(element => {
      const luminance = (color: string) => {
        const channels = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const background = luminance(getComputedStyle(element).backgroundColor);
      const foreground = luminance(getComputedStyle(element.querySelector('h1')!).color);
      return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    const emptyStandings = page.locator('.standings-module-state');
    await emptyStandings.first().scrollIntoViewIfNeeded();
    expect((await page.locator('.standings-card-f1').first().boundingBox())!.height).toBeLessThan(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: `artifacts/browser-qa/screenshots/release-home-${theme}-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
  }
  expect(errors).toEqual([]);
  expect(protectedRequests).toEqual([]);
});

test('keyboard users can skip navigation and reduced motion stays immediate', async ({ page, browserName }) => {
  await installSeason(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.home-command-surface')).toBeVisible();
  const skip = page.getByRole('link', { name: '跳转到主要内容' });
  if (browserName === 'webkit') {
    // Touch-device emulation does not provide desktop hardware Tab traversal.
    // Verify accessible focus and activation here; real iOS keyboard order is a device check.
    await skip.focus();
  } else {
    await page.keyboard.press('Tab');
  }
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.locator('.motion-route-shell')).toHaveCSS('animation-name', 'none');
});

test('account entry keeps primary content visible from the first animation frame', async ({ page }, info) => {
  await page.goto('/login');
  const panel = page.locator('.auth-center__panel');
  await expect(panel.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  expect(await panel.evaluate(element => element.getAnimations().every(animation => {
    const effect = animation.effect as KeyframeEffect;
    return effect.getKeyframes().every(frame => frame.opacity === undefined || Number(frame.opacity) === 1);
  }))).toBe(true);
  expect(await page.locator('.auth-center__track').evaluate(element => element.getAnimations()
    .every(animation => animation.effect?.getTiming().iterations !== Infinity))).toBe(true);
  await expect(page.getByLabel('邮箱', { exact: true })).toBeEnabled();
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/release-login-${info.project.name}.png`, fullPage: true, animations: 'disabled' });
});

test('account entry remains readable when self-hosted font delivery fails', async ({ page }, info) => {
  let fontRequests = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/fonts/*.woff2', route => {
    fontRequests += 1;
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Font unavailable' });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByLabel('邮箱', { exact: true })).toBeVisible();
  await expect.poll(() => fontRequests).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `artifacts/browser-qa/screenshots/font-fallback-${info.project.name}.png`, animations: 'disabled' });
});

test('first visit paints account content before requesting the session SDK', async ({ page }) => {
  await mockAuth(page);
  let contentVisibleAtRequest = false;
  await page.route('**/assets/supabase-*.js', async route => {
    contentVisibleAtRequest = await page.getByRole('heading', { name: '欢迎回来' }).isVisible();
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByLabel('邮箱', { exact: true })).toBeEnabled();
  expect(contentVisibleAtRequest).toBe(true);
});

test('first visit paints a disabled account entry while the auth SDK is pending', async ({ page }) => {
  await mockAuth(page);
  let releaseSdk: () => void = () => undefined;
  const sdkPending = new Promise<void>(resolve => { releaseSdk = resolve; });
  await page.route('**/assets/supabase-*.js', async route => { await sdkPending; await route.continue(); });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible({ timeout: 2_000 });
    await expect(page.getByLabel('邮箱', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '以游客身份浏览' })).toBeDisabled();
    await expect(page.locator('.home-command-surface')).toHaveCount(0);
  } finally {
    releaseSdk();
  }
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('邮箱', { exact: true })).toBeEnabled();
});

for (const callback of ['?code=pending-test-callback', '#type=recovery&error=expired']) {
  test(`session discovery preserves callback URL ${callback}`, async ({ page }) => {
    await mockAuth(page);
    let releaseSdk: () => void = () => undefined;
    const sdkPending = new Promise<void>(resolve => { releaseSdk = resolve; });
    await page.route('**/assets/supabase-*.js', async route => { await sdkPending; await route.continue(); });
    try {
      await page.goto(`/${callback}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('status')).toHaveText('正在确认登录状态…');
      expect(new URL(page.url()).pathname).toBe('/');
      expect(new URL(page.url()).search + new URL(page.url()).hash).toBe(callback);
      await expect(page.locator('.home-command-surface')).toHaveCount(0);
    } finally {
      releaseSdk();
    }
  });
}
