import { z } from 'zod';
import { isSupabaseConfigured, supabase } from '@/utils/supabase';

export const emailSchema = z.string().trim().email().max(254);
export const signInPasswordSchema = z.string().min(1).max(128);
export const newPasswordSchema = z.string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export class AuthUnavailableError extends Error {
  constructor() {
    super('Authentication is not configured');
    this.name = 'AuthUnavailableError';
  }
}

function ensureAuthConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new AuthUnavailableError();
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

export const authApi = {
  async signIn(email: string, password: string): Promise<void> {
    ensureAuthConfigured();
    const credentials = {
      email: emailSchema.parse(email),
      password: signInPasswordSchema.parse(password),
    };
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
  },

  async signUp(email: string, password: string): Promise<void> {
    ensureAuthConfigured();
    const credentials = {
      email: emailSchema.parse(email),
      password: newPasswordSchema.parse(password),
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    };
    const { error } = await supabase.auth.signUp(credentials);
    if (error) throw error;
  },

  async requestPasswordReset(email: string): Promise<void> {
    ensureAuthConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailSchema.parse(email),
      { redirectTo: `${window.location.origin}/login` },
    );
    if (error) throw error;
  },

  async updatePassword(password: string): Promise<void> {
    ensureAuthConfigured();
    const { error } = await supabase.auth.updateUser({
      password: newPasswordSchema.parse(password),
    });
    if (error) throw error;
  },

  async signOut(): Promise<void> {
    ensureAuthConfigured();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
};
