import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/utils/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth } }));
import { requireMemberSession, memberFetch, privateAnalyticsUrl } from './memberAccess';

describe('authenticated data transport', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-public-key');
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 'user-token', user: { id: 'user-1' } } }, error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
  });
  it('fails before any network request without a member session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(memberFetch('https://project.supabase.co/rest/v1/prediction_runs')).rejects.toThrow('需要登录');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the user token and disables HTTP caching', async () => {
    await memberFetch('https://project.supabase.co/rest/v1/prediction_runs');
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer user-token');
    expect(vi.mocked(fetch).mock.calls[0][1]?.cache).toBe('no-store');
  });
  it('rejects anonymous auth accounts and refresh failures', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'guest', is_anonymous: true } } }, error: null });
    await expect(requireMemberSession()).rejects.toThrow('需要登录');
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') });
    await expect(requireMemberSession()).rejects.toThrow('需要登录');
  });
  it('does not send a credential to arbitrary URLs', async () => {
    await expect(memberFetch('https://other.example/file')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses authenticated storage paths and rejects path injection', () => {
    expect(privateAnalyticsUrl('2026', '1', 'R-telemetry')).toContain('/storage/v1/object/authenticated/fastf1-private/2026/1/R-telemetry.json');
    expect(() => privateAnalyticsUrl('../2026', '1', 'R')).toThrow();
  });
});
