import { AuthCaptchaRequiredError, AuthUnavailableError } from '@/utils/authErrors';
import { getTurnstileSiteKey } from '@/utils/turnstile';
export { AuthUnavailableError, getAuthErrorMessage } from '@/utils/authErrors';
import { z } from 'zod';
import { isSupabaseConfigured, supabase } from '@/utils/supabase';

export const emailSchema = z.string().trim().email().max(254);
export const signInPasswordSchema = z.string().min(1).max(128);
export const newPasswordSchema = z.string()
  .min(8)
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');


function ensureAuthConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new AuthUnavailableError();
  }
}


function captchaOptions(token?: string): { captchaToken?: string } {
  const captchaToken = token?.trim();
  if (getTurnstileSiteKey() && !captchaToken) throw new AuthCaptchaRequiredError();
  return captchaToken ? { captchaToken } : {};
}

export const authApi = {
  async signIn(email: string, password: string, captchaToken?: string): Promise<void> {
    ensureAuthConfigured();
    const captcha = captchaOptions(captchaToken);
    const credentials = {
      email: emailSchema.parse(email),
      password: signInPasswordSchema.parse(password),
      ...(captcha.captchaToken ? { options: captcha } : {}),
    };
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
  },

  async signUp(email: string, password: string, captchaToken?: string): Promise<void> {
    ensureAuthConfigured();
    const captcha = captchaOptions(captchaToken);
    const credentials = {
      email: emailSchema.parse(email),
      password: newPasswordSchema.parse(password),
      options: {
        ...captcha,
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    };
    const { error } = await supabase.auth.signUp(credentials);
    if (error) throw error;
  },

  async requestPasswordReset(email: string, captchaToken?: string): Promise<void> {
    ensureAuthConfigured();
    const captcha = captchaOptions(captchaToken);
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailSchema.parse(email),
      { redirectTo: `${window.location.origin}/reset-password`, ...captcha },
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
