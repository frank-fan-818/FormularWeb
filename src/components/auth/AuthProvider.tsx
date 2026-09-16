import type { ReactNode } from 'react';
import { AuthContext } from '@/hooks/authContext';
import { useAuthState } from '@/hooks/useAuthState';

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
