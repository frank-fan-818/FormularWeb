// The browser reschedules skipped observations; this notice carries no JS exception.
// https://www.w3.org/TR/resize-observer/#deliver-resize-loop-error
export function isResizeDeliveryNotice(event: Pick<ErrorEvent, 'message' | 'error'>): boolean {
  return event.error == null && event.message === 'ResizeObserver loop completed with undelivered notifications.';
}
