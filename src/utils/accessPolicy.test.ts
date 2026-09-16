import { describe, expect, it } from 'vitest';
import { getAccessDecision } from './accessPolicy';

describe('site access policy', () => {
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
