import { expect, test, type Page } from '@playwright/test';
import { mockAuth, enterAsMember, authStorageKey, testSession } from './auth-fixtures';

async function mockData(page: Page) {
  await page.route('**/f1-api/**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    MRData: { total: '1', SeasonTable: { Seasons: [{ season: '2026' }] },
      RaceTable: { Races: [{ season: '2026', round: '1', raceName: 'Australian Grand Prix', date: '2026-03-08',
        Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park', Location: { locality: 'Melbourne', country: 'Australia' } },
      }] }, StandingsTable: { StandingsLists: [] },
    },
  }) }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/storage/v1/object/authenticated/fastf1-private/**', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
}

test.beforeEach(async ({ page }) => { await mockData(page); await mockAuth(page); });

test('login validates required fields and preserves password visibility controls', async ({ page }) => {
  let signInRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/auth/v1/token')) signInRequests += 1; });
  await page.goto('/login');
  const email = page.getByLabel('邮箱', { exact: true });
  const password = page.getByLabel('密码', { exact: true });
  await expect(email).toBeEnabled();
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  expect(await email.evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  await email.fill('not-an-email');
  await password.fill('test-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  expect(await email.evaluate((element: HTMLInputElement) => element.validity.typeMismatch)).toBe(true);
  expect(signInRequests).toBe(0);
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('an anonymous auth session never grants member access or erases guest consent', async ({ page }) => {
  await page.addInitScript(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify(session));
    sessionStorage.setItem('f1-guest-access', '1');
  }, { key: authStorageKey, session: { ...testSession, user: { ...testSession.user, is_anonymous: true } } });
  await page.goto('/races/1/race?season=2026');
  await expect(page.getByRole('heading', { name: '登录后查看圈速、遥测与策略分析' })).toBeVisible();
  await expect(page.getByRole('button', { name: '游客 · 登录' })).toBeVisible();
});

test('first-visit cleanup leaves IndexedDB initialization to the cache adapter', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  const valid = await page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === 'f1-data-cache')) return true;
    return new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open('f1-data-cache', 1);
      request.onsuccess = () => {
        const hasStore = request.result.objectStoreNames.contains('snapshots');
        request.result.close();
        resolve(hasStore);
      };
      request.onerror = () => reject(request.error);
    });
  });
  expect(valid).toBe(true);
});

test('first visit shows a standalone login; guest choice survives refresh', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.locator('.auth-trigger-btn')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('login-entry.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '以游客身份浏览' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '游客 · 登录' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '游客 · 登录' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guest deep links remain locked and do not request analytics or predictions', async ({ page }, info) => {
  const protectedRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/fastf1\/|\/fastf1-private\/|fastf1_session_analytics|race_prediction_current/.test(request.url())) protectedRequests.push(request.url());
  });
  await page.goto('/races/1/race?season=2026');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: '以游客身份浏览' }).click();
  await expect(page).toHaveURL(/\/races\/1\/race\?season=2026$/);
  await expect(page.getByRole('heading', { name: '登录后查看圈速、遥测与策略分析' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('guest-locked.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.goto('/races/1/info?season=2026');
  await expect(page.getByRole('heading', { name: '登录后查看赛事预测' })).toBeVisible();
  expect(protectedRequests).toEqual([]);
});

test('sign in returns to the requested analysis; sign out revokes access', async ({ page }) => {
  await page.goto('/races/1/race?season=2026');
  await page.getByLabel('邮箱', { exact: true }).fill('driver@example.com');
  await page.getByLabel('密码', { exact: true }).fill('test-only-password-123');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page).toHaveURL(/\/races\/1\/race\?season=2026$/);
  await expect(page.getByRole('button', { name: '我的账号' })).toBeVisible();
  await expect(page.locator('.member-access')).toHaveCount(0);
  await page.getByRole('button', { name: '我的账号' }).click();
  await expect(page.getByText('driver@example.com', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '安全退出' }).click();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await page.goto('/races/1/race?season=2026');
  await expect(page).toHaveURL(/\/login$/);
});

test('an existing session enters directly and privacy stays public', async ({ page }) => {
  await enterAsMember(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '我的账号' })).toBeVisible();
  await page.goto('/privacy');
  await expect(page).toHaveURL(/\/privacy$/);
});

test('failed login keeps access locked and privacy is public without a session', async ({ page }) => {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
  }));
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: '隐私说明', exact: true })).toBeVisible();
  await page.goto('/races/1/race?season=2026');
  await page.getByLabel('邮箱', { exact: true }).fill('driver@example.com');
  await page.getByLabel('密码', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: /^登\s*录$/ }).click();
  await expect(page.getByText('邮箱或密码不正确。', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
