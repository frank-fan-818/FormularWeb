import { isSafeInternalRoute } from '@/utils/safeNavigation';

interface AuthLocationState {
  from?: unknown;
}

export function getAuthReturnPath(state: unknown): string {
  if (!state || typeof state !== 'object') return '/';

  const { from } = state as AuthLocationState;
  return isSafeInternalRoute(from) ? from : '/';
}
