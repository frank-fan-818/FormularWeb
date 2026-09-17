import type { Page } from '@playwright/test';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
export const authStorageKey = `sb-${new URL(env.VITE_SUPABASE_URL || 'https://example.supabase.co').hostname.split('.')[0]}-auth-token`;
export const testSession = {
  access_token: 'test-only-access-token', refresh_token: 'test-only-refresh-token',
  token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'driver@example.com',
    aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
};

export async function enterAsGuest(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('f1-guest-access', '1'));
}

export async function enterAsMember(page: Page) {
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: authStorageKey, session: testSession });
  await mockAuth(page);
}

export async function mockAuth(page: Page) {
  await page.route('**/auth/v1/**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(route.request().url().includes('/user') ? testSession.user : testSession),
  }));
}
