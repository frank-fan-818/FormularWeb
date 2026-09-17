export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
