import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';
import { mockAuth } from './auth-fixtures';
import { mockTurnstile } from './turnstile-fixtures';

test.skip(!loadEnv('production', process.cwd(), 'VITE_').VITE_TURNSTILE_SITE_KEY, 'Build with a public Turnstile site key for CAPTCHA QA.');

const forms = [
  { path: '/login', submit: /^登\s*录$/, endpoint: '/token', password: true },
  { path: '/register', submit: /创建账号/, endpoint: '/signup', password: true },
  { path: '/forgot-password', submit: /发送重置邮件/, endpoint: '/recover', password: false },
];

for (const form of forms) {
  test(`account CAPTCHA guards ${form.path}, expires and refreshes after submission`, async ({ page }, info) => {
    await mockAuth(page);
    await mockTurnstile(page, true);
    const errors: string[] = [];
    const failedRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !/status of 400/.test(message.text())) errors.push(message.text());
    });
    page.on('requestfailed', request => failedRequests.push(request.url()));
    const tokens: string[] = [];
    await page.route(`**/auth/v1${form.endpoint}**`, async route => {
      const body = route.request().postDataJSON() as { gotrue_meta_security?: { captcha_token?: string } };
      tokens.push(body.gotrue_meta_security?.captcha_token || '');
      await route.fulfill({ status: 400, json: { code: 'captcha_failed', msg: 'CAPTCHA test rejection' } });
    });

    await page.goto(form.path);
    await page.getByLabel('邮箱', { exact: true }).fill('driver@example.com');
    if (form.password) await page.getByLabel('密码', { exact: true }).fill('test-only-password-123');
    if (form.path === '/register') await page.getByLabel('确认密码', { exact: true }).fill('test-only-password-123');
    const submit = page.getByRole('button', { name: form.submit, exact: true });
    await expect(submit).toBeDisabled();
    await expect(page.getByRole('button', { name: '完成测试验证' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('captcha-pending-fixture.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: '完成测试验证' }).click();
    await expect(submit).toBeEnabled();
    await page.evaluate(() => {
      const testWindow = window as typeof window & { __captchaTestOptions: { 'expired-callback': () => void } };
      testWindow.__captchaTestOptions['expired-callback']();
    });
    await expect(submit).toBeDisabled();
    await expect(page.getByText('人机验证已过期，请重新验证。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重新验证', exact: true }).click();
    await page.getByRole('button', { name: '完成测试验证' }).click();
    await submit.click();
    await expect(page.getByText('人机验证未通过或已过期，请重新验证后再试。', { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();
    expect(tokens).toEqual(['test-only-captcha-2']);
    await page.getByRole('button', { name: '完成测试验证' }).click();
    await submit.click();
    await expect.poll(() => tokens.length).toBe(2);
    expect(tokens[1]).toBe('test-only-captcha-3');
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
}

test('account CAPTCHA script failure blocks submission and provides retry', async ({ page }) => {
  await mockAuth(page);
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({
    contentType: 'application/javascript', body: '/* Simulate missing provider API. */',
  }));
  await page.goto('/login');
  await expect(page.getByText('人机验证暂时无法加载，请检查网络后重试。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^登\s*录$/ })).toBeDisabled();
  await mockTurnstile(page, true);
  await page.getByRole('button', { name: '重新验证', exact: true }).click();
  await page.getByRole('button', { name: '完成测试验证' }).click();
  await expect(page.getByRole('button', { name: /^登\s*录$/ })).toBeEnabled();
});
