import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/utils/supabase';

interface AuthSessionState {
  session: Session | null;
  loading: boolean;
  passwordRecovery: boolean;
}

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    void supabase.auth.getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setPasswordRecovery(event === 'PASSWORD_RECOVERY');
        setLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, passwordRecovery };
}
