export const GUEST_ACCESS_KEY = 'f1-guest-access';

export function getAccessDecision(loading: boolean, member: boolean, guest: boolean, membersOnly = false) {
  if (loading) return 'loading';
  if (member) return 'allow';
  if (!guest) return 'login';
  return membersOnly ? 'locked' : 'allow';
}
