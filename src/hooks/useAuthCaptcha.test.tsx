import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnstileApi, TurnstileOptions } from '@/types/turnstile';
import { loadTurnstile } from '@/utils/turnstile';
import { useAuthCaptcha } from './useAuthCaptcha';

vi.mock('@/utils/turnstile', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/turnstile')>(), loadTurnstile: vi.fn(),
}));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ i18n: { language: 'zh-CN' } }) }));

describe('auth CAPTCHA lifecycle', () => {
  let renderer: ReactTestRenderer | undefined;
  let latest: ReturnType<typeof useAuthCaptcha>;
  let options: TurnstileOptions;
  let api: TurnstileApi;
  function Probe() {
    latest = useAuthCaptcha();
    return <div ref={latest.containerRef} />;
  }
  const mount = async (width = 320) => {
    await act(async () => {
      renderer = create(<Probe />, { createNodeMock: () => ({ clientWidth: width }) });
    });
  };
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-public-key');
    vi.resetAllMocks();
    api = {
      render: vi.fn((_container, config) => { options = config; return 'widget'; }),
      remove: vi.fn(),
    };
    vi.mocked(loadTurnstile).mockResolvedValue(api);
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    vi.unstubAllEnvs();
  });

  it('does not load any third party script without a configured public key', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    await mount();
    expect(latest.enabled).toBe(false);
    expect(latest.pending).toBe(false);
    expect(loadTurnstile).not.toHaveBeenCalled();
  });

  it.each(['expired-callback', 'timeout-callback', 'error-callback'] as const)(
    'invalidates completed tokens on %s', async callback => {
      await mount();
      expect(latest.pending).toBe(true);
      act(() => options.callback('test-only-token'));
      expect(latest.pending).toBe(false);
      expect(latest.token).toBe('test-only-token');
      act(() => options[callback]());
      expect(latest.pending).toBe(true);
      expect(latest.token).toBeUndefined();
    },
  );

  it('removes the used widget and rejects late callbacks when refreshing', async () => {
    await mount();
    const previousOptions = options;
    act(() => options.callback('test-only-used-token'));
    await act(async () => latest.reset());
    expect(api.remove).toHaveBeenCalledWith('widget');
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(latest.pending).toBe(true);
    act(() => previousOptions.callback('test-only-stale-token'));
    expect(latest.token).toBeUndefined();
    act(() => options.callback('test-only-fresh-token'));
    expect(latest.token).toBe('test-only-fresh-token');
  });

  it('keeps submission blocked after script failure and supports retry', async () => {
    vi.mocked(loadTurnstile).mockRejectedValueOnce(new Error('network failure'));
    await mount();
    expect(latest.status).toBe('error');
    expect(latest.pending).toBe(true);
    await act(async () => latest.reset());
    act(() => options.callback('test-only-retry-token'));
    expect(latest.pending).toBe(false);
  });

  it('does not render a widget if the form unmounts before the script loads', async () => {
    let resolveScript!: (api: TurnstileApi) => void;
    vi.mocked(loadTurnstile).mockReturnValueOnce(new Promise(resolve => { resolveScript = resolve; }));
    await mount();
    act(() => renderer?.unmount());
    await act(async () => resolveScript(api));
    expect(api.render).not.toHaveBeenCalled();
  });

  it('uses a compact widget inside narrow forms', async () => {
    await mount(280);
    expect(options.size).toBe('compact');
  });
});
