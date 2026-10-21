import type { Page } from '@playwright/test';

// This replaces only the third-party script in local browser tests. It never validates real tokens.
export async function mockTurnstile(page: Page, manual = false) {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `(() => {
      let counter = 0;
      const widgets = new Map();
      window.turnstile = {
        render(container, options) {
          const id = 'test-widget-' + (++counter);
          const token = 'test-only-captcha-' + counter;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = '完成测试验证';
          button.style.cssText = 'max-width:100%;padding:16px;border:1px solid #ddd;background:#fafafa;color:#222';
          button.onclick = () => options.callback(token);
          container.appendChild(button);
          container.dataset.testWidgetSize = options.size;
          widgets.set(id, container);
          window.__captchaTestOptions = options;
          if (!${manual}) queueMicrotask(() => options.callback(token));
          return id;
        },
        remove(id) { widgets.get(id)?.replaceChildren(); widgets.delete(id); },
      };
    })();`,
  }));
}
