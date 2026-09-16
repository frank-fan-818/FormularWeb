import { describe, expect, it } from 'vitest';
import { getAccessDecision, getMemberSession } from './accessPolicy';
import type { Session } from '@supabase/supabase-js';

describe('site access policy', () => {
  it('rejects anonymous and incomplete sessions on every initialization path', () => {
    const member = { access_token: 'test-token', user: { id: 'user-1' } } as Session;
    expect(getMemberSession(member)).toBe(member);
    expect(getMemberSession({ ...member, user: { ...member.user, is_anonymous: true } })).toBeNull();
    expect(getMemberSession({ ...member, access_token: '' })).toBeNull();
    expect(getMemberSession(null)).toBeNull();
  });
  it('waits for identity before showing content', () => {
    expect(getAccessDecision(true, false, true)).toBe('loading');
  });
  it('requires an explicit guest choice on first entry', () => {
    expect(getAccessDecision(false, false, false)).toBe('login');
    expect(getAccessDecision(false, false, true)).toBe('allow');
  });
  it('never grants member features to guests', () => {
    expect(getAccessDecision(false, false, true, true)).toBe('locked');
    expect(getAccessDecision(false, true, false, true)).toBe('allow');
  });
  it('revokes member access as soon as the session disappears', () => {
    expect(getAccessDecision(false, false, false, true)).toBe('login');
  });
});
