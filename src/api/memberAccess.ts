import { isSupabaseConfigured, supabase } from '@/utils/supabase';

export class MemberAccessError extends Error {
  constructor() { super('需要登录后才能读取分析数据。'); this.name = 'MemberAccessError'; }
}

export async function requireMemberSession() {
  if (!isSupabaseConfigured) throw new MemberAccessError();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || !data.session.user?.id || data.session.user.is_anonymous) {
    throw new MemberAccessError();
  }
  return data.session;
}

export function privateAnalyticsUrl(season: string, round: string, session: string): string {
  if (!/^\d{4}$/.test(season) || !/^[1-9]\d*$/.test(round) || !/^(R|Q|S|SQ|SS|FP1|FP2|FP3)(-telemetry)?$/.test(session)) {
    throw new Error('Invalid analysis identity');
  }
  return new URL(`/storage/v1/object/authenticated/fastf1-private/${season}/${round}/${session}.json`, import.meta.env.VITE_SUPABASE_URL).href;
}

export async function memberFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  const origin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
  if (target.origin !== origin || !/^\/(rest|storage)\/v1\//.test(target.pathname)) throw new Error('Invalid member data endpoint');
  const session = await requireMemberSession();
  const headers = new Headers(options.headers);
  headers.set('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(target.href, { ...options, headers, cache: 'no-store', redirect: 'error' });
  if (response.status === 401 || response.status === 403) throw new MemberAccessError();
  const current = await requireMemberSession();
  if (current.user.id !== session.user.id) throw new MemberAccessError();
  // Storage can encode a missing private object as HTTP 400 + statusCode 404.
  if (response.status === 400 && target.pathname.startsWith('/storage/')) {
    const body = await response.clone().json().catch(() => null) as { statusCode?: string | number } | null;
    if (String(body?.statusCode) === '404') return new Response(null, { status: 404 });
  }
  return response;
}
