import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

// Read browser-side Supabase config from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn({
    event: 'entry',
    module: 'supabase',
    function: 'init',
    error: 'Supabase 配置缺失，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量',
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);
