import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAuthState } from './useAuthState';

const sdk = vi.hoisted(() => ({ getSession: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), clear: vi.fn(), stored: vi.fn() }));
vi.mock('@/utils/supabaseConfig', () => ({ isSupabaseConfigured: true, hasStoredAuthSession: sdk.stored }));
vi.mock('@/utils/privateDataCleanup', () => ({ clearPrivateData: sdk.clear }));
vi.mock('@/utils/supabase', () => ({ supabase: { auth: {
  getSession: sdk.getSession, onAuthStateChange: sdk.subscribe,
} } }));

const member = { access_token: 'test-only-token', user: { id: 'member', email: 'driver@example.com' } } as Session;

describe('auth session lifecycle', () => {
  let renderer: ReactTestRenderer;
  let latest: ReturnType<typeof useAuthState>;
  let emit: (event: AuthChangeEvent, session: Session | null) => void;
  function Probe() { latest = useAuthState(); return null; }
  async function mount() {
    await act(async () => { renderer = create(<Probe />); });
    await vi.waitFor(async () => { await act(async () => {}); expect(sdk.subscribe).toHaveBeenCalled(); });
  }
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    sdk.subscribe.mockImplementation(callback => {
      emit = callback;
      return { data: { subscription: { unsubscribe: sdk.unsubscribe } } };
    });
    sdk.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });
  afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('waits for the first public account frame before loading the SDK on a bare cold visit', async () => {
    const listeners = new Map<string, () => void>();
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', { setTimeout, clearTimeout,
      location: { pathname: '/', search: '', hash: '' },
      addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    await act(async () => { renderer = create(<Probe />); });
    expect(sdk.subscribe).not.toHaveBeenCalled();
    expect(latest.loading).toBe(true);
    await act(async () => { listeners.get('f1-auth-entry-painted')?.(); });
    await vi.waitFor(() => expect(sdk.subscribe).toHaveBeenCalledOnce());
  });

  it('keeps recovery authorization through a token refresh until password update', async () => {
    await mount();
    act(() => emit('PASSWORD_RECOVERY', member));
    expect(latest.passwordRecovery).toBe(true);
    act(() => emit('TOKEN_REFRESHED', member));
    expect(latest.passwordRecovery).toBe(true);
    act(() => emit('USER_UPDATED', member));
    expect(latest.passwordRecovery).toBe(false);
  });

  it.each([
    ['PKCE callback', '?code=callback', '', false],
    ['recovery callback', '', '#type=recovery', false],
    ['stored member', '', '', true],
  ])('starts session discovery immediately for %s', async (_label, search, hash, stored) => {
    sdk.stored.mockReturnValue(stored);
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', { setTimeout, clearTimeout,
      location: { pathname: '/', search, hash },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    await mount();
    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('falls back to session discovery if the public frame signal never arrives', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', { setTimeout, clearTimeout,
      location: { pathname: '/', search: '', hash: '' },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    await act(async () => { renderer = create(<Probe />); });
    expect(sdk.subscribe).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(sdk.subscribe).toHaveBeenCalledOnce();
    expect(latest.loading).toBe(false);
  });

  it('cancels deferred discovery when the provider unmounts', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', { setTimeout, clearTimeout,
      location: { pathname: '/', search: '', hash: '' },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    await act(async () => { renderer = create(<Probe />); });
    act(() => renderer.unmount());
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(sdk.subscribe).not.toHaveBeenCalled();
  });

  it('gives a subscription event precedence over an older session lookup', async () => {
    let resolve!: (value: { data: { session: null }; error: null }) => void;
    sdk.getSession.mockReturnValue(new Promise(res => { resolve = res; }));
    await mount();
    act(() => emit('SIGNED_IN', member));
    await act(async () => { resolve({ data: { session: null }, error: null }); });
    expect(latest.session).toBe(member);
    expect(latest.loading).toBe(false);
  });

  it('rejects anonymous identities and clears private data and guest choice on sign-out', async () => {
    await mount();
    act(() => latest.enterGuest());
    act(() => emit('SIGNED_IN', { ...member, user: { ...member.user, is_anonymous: true } }));
    expect(latest.session).toBeNull();
    act(() => emit('SIGNED_IN', member));
    expect(latest.guest).toBe(false);
    act(() => emit('SIGNED_OUT', null));
    expect(latest.session).toBeNull();
    expect(sdk.clear).toHaveBeenCalled();
    act(() => renderer.unmount());
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('sanitizes failures and permits a fresh session lookup on retry', async () => {
    sdk.getSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('raw secret details') });
    await mount();
    expect(latest.error).toBe('无法确认登录状态，请重试或选择游客浏览。');
    sdk.getSession.mockResolvedValue({ data: { session: member }, error: null });
    await act(async () => { latest.retry(); });
    expect(latest.error).toBeNull();
    expect(latest.session).toBe(member);
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });

  it('ends loading when session discovery stalls and ignores events after cleanup', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    sdk.getSession.mockReturnValue(new Promise(() => {}));
    await act(async () => { renderer = create(<Probe />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(latest.loading).toBe(false);
    expect(latest.error).toBe('登录状态检查超时，请重试或选择游客浏览。');
    act(() => renderer.unmount());
    const before = latest;
    act(() => emit('SIGNED_IN', member));
    expect(latest).toBe(before);
  });
});
