import { useCallback, useEffect, useRef, useState } from 'react';
import { getTurnstileSiteKey, loadTurnstile } from '@/utils/turnstile';
import { useTranslation } from '@/i18n';

export function useAuthCaptcha(active = true) {
  const siteKey = getTurnstileSiteKey();
  const enabled = active && Boolean(siteKey);
  const { i18n } = useTranslation();
  const language = i18n.language;
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'verified' | 'error' | 'expired'>('loading');
  const [generation, setGeneration] = useState(0);
  const reset = useCallback(() => {
    setToken(undefined);
    setStatus('loading');
    setGeneration(value => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    let disposed = false;
    let removeWidget: (() => void) | undefined;
    setToken(undefined);
    setStatus('loading');
    const invalidate = (nextStatus: 'error' | 'expired') => {
      if (disposed) return;
      setToken(undefined);
      setStatus(nextStatus);
    };
    void loadTurnstile().then(api => {
      const container = containerRef.current;
      if (disposed || !container) return;
      const widgetId = api.render(container, {
        sitekey: siteKey,
        size: container.clientWidth < 300 ? 'compact' : 'flexible',
        theme: 'auto',
        language,
        'response-field': false,
        callback: (response) => {
          if (disposed) return;
          setToken(response);
          setStatus('verified');
        },
        'error-callback': () => invalidate('error'),
        'expired-callback': () => invalidate('expired'),
        'timeout-callback': () => invalidate('expired'),
      });
      removeWidget = () => api.remove(widgetId);
    }).catch(() => invalidate('error'));
    return () => {
      disposed = true;
      removeWidget?.();
    };
  }, [enabled, siteKey, language, generation]);

  return { enabled, containerRef, token, status, pending: enabled && !token, reset };
}
