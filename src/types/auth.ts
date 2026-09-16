import type { Session } from '@supabase/supabase-js';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  passwordRecovery: boolean;
  guest: boolean;
  error: string | null;
  enterGuest: () => void;
  leaveGuest: () => void;
  retry: () => void;
}
