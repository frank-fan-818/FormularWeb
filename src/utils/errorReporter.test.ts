import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const state = {
    session: null as { user: { id: string } } | null,
    insertError: null as Error | null,
  };
  const insert = vi.fn((_payload: Record<string, unknown>) => (
    Promise.resolve({ error: state.insertError })
  ));
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

import {
  buildSafeErrorRecord,
  getSafePageUrl,
  reportError,
  resetErrorReporterStateForTests,
  sendErrorReport,
} from './errorReporter';

describe('errorReporter', () => {
  beforeEach(() => {
    resetErrorReporterStateForTests();
    supabaseMock.state.session = null;
    supabaseMock.state.insertError = null;
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

  it('surfaces a rejected Supabase insert to the async reporting boundary', async () => {
    supabaseMock.state.session = { user: { id: 'test-user' } };
    supabaseMock.state.insertError = new Error('permission denied');

    await expect(sendErrorReport({
      module: 'RaceAnalysis',
      function: 'buildTelemetryHeatmapOption',
      error: 'database rejection',
    })).rejects.toThrow('permission denied');
  });

  it('deduplicates concurrent identical reporting attempts', async () => {
    supabaseMock.state.session = { user: { id: 'test-user' } };
    const payload = {
      module: 'RaceAnalysis',
      function: 'buildTelemetryHeatmapOption',
      error: 'concurrent failure',
    };

    await Promise.all([sendErrorReport(payload), sendErrorReport(payload)]);

    expect(supabaseMock.insert).toHaveBeenCalledOnce();
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

  it('persists only an allowlisted category and fingerprint, never raw error text', async () => {
    supabaseMock.state.session = { user: { id: 'test-user' } };
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.abcdefghijklmnopqrstuvwxyz';
    // Assemble credential-shaped fixtures at runtime so the release secret scanner
    // still rejects literal credentials in tracked files.
    const sensitiveSamples = [
      'Authorization: Basic dXNlcjpwYXNz',
      ['password', 'alpha beta'].join('='),
      `password=${JSON.stringify('quoted value')}`,
      ['postgresql://alice', 'db-secret@example.com/db'].join(':'),
      '/callback?code=oauth-secret#state=fragment-secret',
      ['ghp', 'abcdefghijklmnopqrstuvwxyz1234567890'].join('_'),
      'Cookie: session=session-secret',
      `Bearer bearer-token-value token=${jwt}`,
    ];

    for (const [index, sensitiveError] of sensitiveSamples.entries()) {
      await sendErrorReport({
        module: `Auth ${index}`,
        function: 'exchange code',
        error: sensitiveError,
      });
    }

    expect(supabaseMock.insert).toHaveBeenCalledTimes(sensitiveSamples.length);
    for (const [index, call] of supabaseMock.insert.mock.calls.entries()) {
      const insertedPayload = call[0];
      expect(insertedPayload.module).toBe(`Auth_${index}`);
      expect(insertedPayload.function).toBe('exchange_code');
      expect(insertedPayload.error).toMatch(
        /^category=(?:chunk_load|timeout|network|authorization|not_found|validation|unknown);fingerprint=[0-9a-f]{24};length=\d+$/,
      );
      expect(sensitiveSamples.some((sample) => String(insertedPayload.error).includes(sample))).toBe(false);
    }
  });

  it('keeps the deduplication map bounded even while inserts fail', async () => {
    supabaseMock.state.session = { user: { id: 'test-user' } };
    supabaseMock.state.insertError = new Error('database unavailable');

    for (let index = 0; index <= 200; index += 1) {
      await sendErrorReport({
        module: 'LoadTest',
        function: 'report',
        error: `unique failure ${index}`,
      }).catch(() => undefined);
    }

    await sendErrorReport({
      module: 'LoadTest',
      function: 'report',
      error: 'unique failure 0',
    }).catch(() => undefined);

    expect(supabaseMock.insert).toHaveBeenCalledTimes(202);
  });

  it('classifies useful failure categories without retaining the source message', async () => {
    const record = await buildSafeErrorRecord(
      'Failed to fetch https://example.com?token=secret while offline',
    );

    expect(record).toMatch(/^category=network;fingerprint=[0-9a-f]{24};length=\d+$/);
    expect(record).not.toContain('example.com');
    expect(record).not.toContain('secret');
  });
});
