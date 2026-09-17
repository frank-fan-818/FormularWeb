import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabaseConfig';
export { isSupabaseConfigured } from './supabaseConfig';

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
