import { describe, expect, it } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { getAuthErrorMessage } from './authErrors';

describe('authentication error messages', () => {
  it('explains CAPTCHA rejection without exposing provider details', () => {
    expect(getAuthErrorMessage(new AuthApiError('captcha provider internal response', 400, 'captcha_failed')))
      .toBe('人机验证未通过或已过期，请重新验证后再试。');
  });
  it('explains a reused recovery password without claiming the service is unavailable', () => {
    expect(getAuthErrorMessage(new AuthApiError(
      'New password should be different from the old password.', 422, 'same_password',
    ))).toBe('新密码不能与旧密码相同，请设置一个不同的密码。');
  });

  it('supports the legacy same-password response without an error code', () => {
    expect(getAuthErrorMessage(new Error('New password should be different from the old password.')))
      .toBe('新密码不能与旧密码相同，请设置一个不同的密码。');
  });

  it.each([
    ['over_email_send_rate_limit', 'For security purposes, you can only request this after 60 seconds.'],
    ['over_request_rate_limit', 'Request quota exhausted.'],
    [undefined, 'Request quota exhausted.'],
  ])('explains throttled recovery requests (%s) without claiming an outage', (code, message) => {
    expect(getAuthErrorMessage(new AuthApiError(message, 429, code)))
      .toBe('请求过于频繁，请稍后再试。');
  });

  it('keeps unexpected server details private', () => {
    expect(getAuthErrorMessage(new AuthApiError('private internal detail', 500, 'unexpected_failure')))
      .toBe('身份服务暂时不可用，请稍后重试。');
  });
});
