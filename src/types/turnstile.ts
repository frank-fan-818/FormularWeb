export interface TurnstileOptions {
  sitekey: string;
  size: 'flexible' | 'compact';
  theme: 'auto';
  language: 'zh-CN' | 'en';
  'response-field': false;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  'error-callback': () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
