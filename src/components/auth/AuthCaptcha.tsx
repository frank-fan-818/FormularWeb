import type { useAuthCaptcha } from '@/hooks/useAuthCaptcha';

export function AuthCaptcha({ captcha }: { captcha: ReturnType<typeof useAuthCaptcha> }) {
  if (!captcha.enabled) return null;
  const needsRetry = captcha.status === 'error' || captcha.status === 'expired';
  const message = captcha.status === 'verified' ? '人机验证已完成'
    : captcha.status === 'error' ? '人机验证暂时无法加载，请检查网络后重试。'
      : captcha.status === 'expired' ? '人机验证已过期，请重新验证。'
        : '请完成人机验证';
  return (
    <div className="auth-captcha">
      <div ref={captcha.containerRef} aria-label="人机验证" />
      <p className="auth-captcha__status" role="status" aria-live="polite">{message}</p>
      {needsRetry ? <button className="auth-card__button" type="button" onClick={captcha.reset}>重新验证</button> : null}
    </div>
  );
}
