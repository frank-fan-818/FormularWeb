import { expect, test, type Page } from '@playwright/test';
import { mockAuth, testSession } from './auth-fixtures';

test.beforeEach(async ({ page }) => { await mockAuth(page); });

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const expected = message.text() === 'Service Worker registration blocked by Playwright'
      || /status of 429\b/.test(message.text());
    if (['error', 'warning'].includes(message.type()) && !expected) errors.push(message.text());
  });
  page.on('requestfailed', (request) => errors.push(request.failure()?.errorText ?? 'Request failed'));
  return errors;
}

test('account entry recovery handles resend throttling and completes the same-browser PKCE flow', async ({ page }, info) => {
  const errors = collectBrowserErrors(page);
  let recoveryRequests = 0;
  let exchangedRecoveryCode = false;
  let passwordUpdates = 0;
  let signOuts = 0;
  await page.route('**/auth/v1/recover**', (route) => {
    recoveryRequests += 1;
    return route.fulfill({
      status: recoveryRequests === 1 ? 429 : 200,
      contentType: 'application/json',
      body: JSON.stringify(recoveryRequests === 1
        ? { code: 'over_email_send_rate_limit', msg: 'For security purposes, you can only request this after 60 seconds.' }
        : {}),
    });
  });
  await page.route('**/auth/v1/token**', (route) => {
    const body = route.request().postDataJSON() as { auth_code?: string; code_verifier?: string };
    exchangedRecoveryCode = body.auth_code === 'test-only-recovery-code' && Boolean(body.code_verifier);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(testSession) });
  });
  await page.route('**/auth/v1/user', (route) => {
    if (route.request().method() === 'PUT') passwordUpdates += 1;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(testSession.user) });
  });
  await page.route('**/auth/v1/logout**', (route) => {
    signOuts += 1;
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });

  await page.goto('/forgot-password');
  await expect(page.getByText(/请在同一浏览器中申请并打开邮件链接/)).toBeVisible();
  await page.getByLabel('邮箱', { exact: true }).fill('driver@example.com');
  const requestButton = page.getByRole('button', { name: /发送重置邮件/ });
  await requestButton.click();
  await expect(page.getByText('请求过于频繁，请稍后再试。', { exact: true })).toBeVisible();
  await expect(requestButton).not.toHaveClass(/ant-btn-loading/);
  await page.screenshot({ path: info.outputPath('recovery-rate-limit.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

  // The mocked server now allows a new request; no real mail or cooldown is used.
  await requestButton.click();
  await expect(page.getByText(/请在当前浏览器中打开邮件里的最新链接/)).toBeVisible();
  await page.goto('/reset-password?code=test-only-recovery-code');
  await expect(page.getByLabel('新密码', { exact: true })).toBeEnabled();
  expect(exchangedRecoveryCode).toBe(true);
  await page.getByLabel('新密码', { exact: true }).fill('updated-test-only-password-456');
  await page.getByLabel('确认新密码', { exact: true }).fill('updated-test-only-password-456');
  await page.getByRole('button', { name: '保存新密码', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  expect(passwordUpdates).toBe(1);
  expect(signOuts).toBe(1);
  expect(errors).toEqual([]);
});

test('account entry recovery explains callbacks missing the requesting browser verifier', async ({ page }, info) => {
  const errors = collectBrowserErrors(page);
  const authWrites: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && /\/auth\/v1\/(token|user)/.test(request.url())) authWrites.push(request.method());
  });
  await page.goto('/reset-password?code=test-only-code-from-another-browser');
  await expect(page.getByText('无法验证重置链接', { exact: true })).toBeVisible();
  await expect(page.getByText(/请在发起申请的同一浏览器中打开最新的重置邮件链接/)).toBeVisible();
  await expect(page.getByLabel('新密码', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('recovery-missing-verifier.png'), fullPage: true, animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(authWrites).toEqual([]);
  expect(errors).toEqual([]);
});
