import { AuthUnavailableError } from '@/utils/authErrors';
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
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    };
    const { error } = await supabase.auth.signUp(credentials);
    if (error) throw error;
  },

  async requestPasswordReset(email: string): Promise<void> {
    ensureAuthConfigured();
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailSchema.parse(email),
      { redirectTo: `${window.location.origin}/reset-password` },
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
