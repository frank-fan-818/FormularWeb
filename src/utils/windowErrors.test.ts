import { expect, it } from 'vitest';
import { isResizeDeliveryNotice } from './windowErrors';
it('distinguishes browser delivery notices from real script exceptions', () => {
  const message = 'ResizeObserver loop completed with undelivered notifications.';
  expect(isResizeDeliveryNotice({ message, error: null })).toBe(true);
  expect(isResizeDeliveryNotice({ message, error: new Error(message) })).toBe(false);
  expect(isResizeDeliveryNotice({ message: 'ResizeObserver callback failed', error: new Error('failed') })).toBe(false);
  expect(isResizeDeliveryNotice({ message: 'Uncaught TypeError', error: null })).toBe(false);
});
