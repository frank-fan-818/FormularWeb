import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

// Read browser-side Supabase config from environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function isValidBrowserSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (import.meta.env.DEV && url.hostname === 'localhost');
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidBrowserSupabaseUrl(supabaseUrl)
  && supabaseAnonKey.length >= 20;

if (!isSupabaseConfigured) {
  logger.warn({
    event: 'entry',
    module: 'supabase',
    function: 'init',
    error: 'Supabase 配置缺失，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量',
  });
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://example.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      persistSession: true,
    },
  },
);
