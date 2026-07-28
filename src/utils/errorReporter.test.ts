import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state = {
    session: null as { user: { id: string } } | null,
  };
  const insert = vi.fn(() => Promise.resolve({ error: null }));
  const from = vi.fn(() => ({ insert }));
  const getSession = vi.fn(async () => ({
    data: { session: state.session },
    error: null,
  }));

  return {
    state,
    insert,
    from,
    client: {
      auth: { getSession },
      from,
    },
  };
});

vi.mock('@/utils/supabase', () => ({
  supabase: supabaseMock.client,
}));

import { getSafePageUrl, reportError } from './errorReporter';

describe('errorReporter', () => {
  beforeEach(() => {
    supabaseMock.state.session = null;
    vi.clearAllMocks();
  });

  it('does not issue an anonymous error_logs request', async () => {
    reportError({
      module: 'RaceAnalysis',
      function: 'buildTelemetryHeatmapOption',
      error: 'anonymous failure',
    });

    await vi.waitFor(() => expect(supabaseMock.client.auth.getSession).toHaveBeenCalledOnce());
    expect(supabaseMock.from).not.toHaveBeenCalled();
    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it('reports errors for an authenticated session', async () => {
    supabaseMock.state.session = { user: { id: 'test-user' } };

    reportError({
      module: 'RaceAnalysis',
      function: 'buildTelemetryHeatmapOption',
      error: 'authenticated failure',
    });

    await vi.waitFor(() => expect(supabaseMock.insert).toHaveBeenCalledOnce());
    expect(supabaseMock.from).toHaveBeenCalledWith('error_logs');
  });

  it('removes query strings and fragments from reported page URLs', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://f1.example',
        pathname: '/login',
        search: '?code=sensitive',
        hash: '#access_token=sensitive',
      },
    });

    expect(getSafePageUrl()).toBe('https://f1.example/login');
  });
});
