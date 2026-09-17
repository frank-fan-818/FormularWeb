import { clearPrivateData } from '@/utils/privateDataCleanup';
import { useEffect, useState } from 'react';
import type { AuthState } from '@/types/auth';
import type { Session } from '@supabase/supabase-js';
import { getMemberSession, GUEST_ACCESS_KEY } from '@/utils/accessPolicy';
import { isSupabaseConfigured } from '@/utils/supabaseConfig';

export function useAuthState(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [guest, setGuest] = useState(() => {
    try { return sessionStorage.getItem(GUEST_ACCESS_KEY) === '1'; } catch { return false; }
  });
  const updateGuest = (value: boolean) => {
    setGuest(value);
    try {
      if (value) sessionStorage.setItem(GUEST_ACCESS_KEY, '1');
      else sessionStorage.removeItem(GUEST_ACCESS_KEY);
    } catch { /* Guest access still works in memory when storage is unavailable. */ }
  };

  useEffect(() => {
    clearPrivateData();
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    let eventReceived = false;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setError(null);
    const timeout = window.setTimeout(() => {
      if (active && !eventReceived) {
        setError('登录状态检查超时，请重试或选择游客浏览。');
        setLoading(false);
      }
    }, 10000);
    void import('@/utils/supabase').then(async ({ supabase }) => {
      if (!active) return;
      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (!active) return;
        eventReceived = true;
        window.clearTimeout(timeout);
        if (!nextSession || event === 'SIGNED_IN' || event === 'SIGNED_OUT') clearPrivateData();
        const memberSession = getMemberSession(nextSession);
        setSession(memberSession);
        setPasswordRecovery(event === 'PASSWORD_RECOVERY');
        setLoading(false);
        setError(null);
        if (memberSession || event === 'SIGNED_OUT') updateGuest(false);
      });
      unsubscribe = () => data.subscription.unsubscribe();
      const { data: current, error: sessionError } = await supabase.auth.getSession();
      if (!active || eventReceived) return;
      if (sessionError) throw sessionError;
      const memberSession = getMemberSession(current.session);
      setSession(memberSession);
      if (memberSession) updateGuest(false);
    }).catch(() => {
      if (active && !eventReceived) setError('无法确认登录状态，请重试或选择游客浏览。');
    }).finally(() => {
      if (active) {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [attempt]);

  return { session, loading, passwordRecovery, guest, error,
    enterGuest: () => updateGuest(true), leaveGuest: () => updateGuest(false),
    retry: () => setAttempt((value) => value + 1),
  };
}
