import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock('@/utils/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword,
      signUp,
      resetPasswordForEmail,
      updateUser,
      signOut,
    },
  },
}));

describe('authApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('window', { location: { origin: 'https://f1.example' } });
  });

  it('normalizes an email before signing in', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const { authApi } = await import('./auth');

    await authApi.signIn('  Driver@Example.com  ', 'test-only-password-123');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'Driver@Example.com',
      password: 'test-only-password-123',
    });
  });

  it('rejects weak signup passwords before a network request', async () => {
    const { authApi } = await import('./auth');

    await expect(authApi.signUp('driver@example.com', 'password')).rejects.toThrow();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('uses a same-origin password reset redirect', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const { authApi } = await import('./auth');

    await authApi.requestPasswordReset('driver@example.com');

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'driver@example.com',
      { redirectTo: 'https://f1.example/reset-password' },
    );
  });

  it('does not expose raw unexpected authentication errors', async () => {
    const { getAuthErrorMessage } = await import('./auth');

    expect(getAuthErrorMessage(new Error('internal database detail'))).toBe(
      '身份服务暂时不可用，请稍后重试。',
    );
  });

  it('validates a recovered password before updating the user', async () => {
    updateUser.mockResolvedValue({ error: null });
    const { authApi } = await import('./auth');

    await authApi.updatePassword('test-only-recovered-123');

    expect(updateUser).toHaveBeenCalledWith({ password: 'test-only-recovered-123' });
  });
});
