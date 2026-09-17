import { useContext } from 'react';
import { AuthContext } from './authContext';

export function useAuthSession() {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuthSession requires AuthProvider');
  return state;
}
