import { describe, expect, it } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';
import { getAuthErrorMessage } from './authErrors';

describe('authentication error messages', () => {
  it('explains a reused recovery password without claiming the service is unavailable', () => {
    expect(getAuthErrorMessage(new AuthApiError(
      'New password should be different from the old password.', 422, 'same_password',
    ))).toBe('新密码不能与旧密码相同，请设置一个不同的密码。');
  });

  it('supports the legacy same-password response without an error code', () => {
    expect(getAuthErrorMessage(new Error('New password should be different from the old password.')))
      .toBe('新密码不能与旧密码相同，请设置一个不同的密码。');
  });

  it('keeps unexpected server details private', () => {
    expect(getAuthErrorMessage(new AuthApiError('private internal detail', 500, 'unexpected_failure')))
      .toBe('身份服务暂时不可用，请稍后重试。');
  });
});
