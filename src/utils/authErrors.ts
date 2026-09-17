export class AuthUnavailableError extends Error {
  constructor() {
    super('Authentication is not configured');
    this.name = 'AuthUnavailableError';
  }
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthUnavailableError) {
    return '身份服务暂未配置，请稍后再试。';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) {
    return '邮箱或密码不正确。';
  }
  if (message.includes('email not confirmed')) {
    return '请先完成邮箱验证后再登录。';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return '请求过于频繁，请稍后再试。';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return '网络连接异常，请检查网络后重试。';
  }

  return '身份服务暂时不可用，请稍后重试。';
}
