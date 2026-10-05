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

// A preload hint only: cached credentials are still validated by AuthProvider.
export function hasStoredAuthSession(): boolean {
  if (!isSupabaseConfigured) return false;
  try {
    const key = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    return Boolean(localStorage.getItem(key));
  } catch {
    // Unknown storage state keeps returning-user startup on the normal path.
    return true;
  }
}
