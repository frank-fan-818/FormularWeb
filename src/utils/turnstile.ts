import type { TurnstileApi } from '@/types/turnstile';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

export const getTurnstileSiteKey = (): string => import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '';

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 15_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error('Unable to load CAPTCHA'));
    };
    script.onload = () => {
      if (!window.turnstile) { fail(); return; }
      cleanup();
      resolve(window.turnstile);
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}
