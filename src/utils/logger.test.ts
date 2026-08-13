/**
 * Tests for src/utils/logger.ts
 *
 * Strategy: Test withLogging behavior (which wraps logger calls) and verify
 * output by intercepting process.stdout. Direct console mocking conflicts
 * with Vite's module isolation in test mode.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLoggerScope, withLogging } from '@/utils/logger';
// Re-import to pick up module-level state
import { logger } from '@/utils/logger';

describe('withLogging', () => {
  it('returns the result of a successful operation', async () => {
    const result = await withLogging('mymod', 'doWork', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('re-throws error from failed operation', async () => {
    const err = new Error('boom');
    await expect(
      withLogging('mymod', 'doFail', async () => { throw err; }),
    ).rejects.toThrow('boom');
  });

  it('preserves the original error stack', async () => {
    const err = new Error('original');
    try {
      await withLogging('mymod', 'fn', async () => { throw err; });
    } catch (caught) {
      expect(caught).toBe(err); // exact same error object, not wrapped
    }
  });

  it('handles non-Error throws', async () => {
    await expect(
      withLogging('mymod', 'fn', async () => { throw 'string error'; }),
    ).rejects.toBe('string error');
  });
});

describe('logger output', () => {
  let originalConsoleLog: typeof console.log;
  const captured: string[] = [];

  beforeEach(() => {
    captured.length = 0;
    originalConsoleLog = console.log;
    // Use a simple spy that collects output
    console.log = (...args: unknown[]) => {
      captured.push(args.map(String).join(' '));
    };
    console.info = console.log;
    console.warn = console.log;
    console.error = console.log;
    console.debug = console.log;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('outputs JSON-structured info logs', () => {
    logger.info({
      event: 'entry', module: 'test', function: 'testFn',
      input: 'hello', timestamp: new Date().toISOString(),
    });

    expect(captured.length).toBe(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('entry');
    expect(parsed.module).toBe('test');
    expect(parsed.input).toBe('hello');
  });

  it('outputs JSON-structured warn logs', () => {
    logger.warn({
      event: 'exit', module: 'test', function: 'testFn',
      status: 'failed', error: 'degraded',
    });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.status).toBe('failed');
    expect(parsed.error).toBe('degraded');
  });

  it('outputs JSON-structured error logs', () => {
    logger.error({
      event: 'exit', module: 'test', function: 'testFn',
      status: 'failed', error: 'broken',
    });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.level).toBe('error');
  });

  it('includes durationMs in step logs', () => {
    logger.info({
      event: 'step', module: 'test', function: 'testFn',
      step: 'api_call', durationMs: 234,
    });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.step).toBe('api_call');
    expect(parsed.durationMs).toBe(234);
  });

  it('withLogging produces entry and exit logs on success', async () => {
    await withLogging('mymod', 'doWork', async () => 42, 'hint');

    const entries = captured.map((s) => JSON.parse(s));
    const entryLog = entries.find((e: { event: string }) => e.event === 'entry');
    expect(entryLog.module).toBe('mymod');
    expect(entryLog.input).toBe('hint');

    const exitLog = entries.find((e: { event: string }) => e.event === 'exit');
    expect(exitLog.status).toBe('success');
    expect(exitLog.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('withLogging produces error exit log on failure', async () => {
    try {
      await withLogging('mymod', 'doFail', async () => { throw new Error('boom'); });
    } catch { /* expected */ }

    const exitLog = captured.map((s) => JSON.parse(s)).find(
      (e: { event: string }) => e.event === 'exit',
    );
    expect(exitLog.status).toBe('failed');
    expect(exitLog.error).toContain('boom');
  });

  it('emits correlated RaceDetail diagnostic events', () => {
    createLoggerScope({
      flowId: 'flow-1', feature: 'race_detail', season: '2026', round: '1', section: 'results',
    }).log({ operation: 'race_results', outcome: 'failed', error: new Error('Failed to fetch') });

    const parsed = JSON.parse(captured[0]);
    expect(parsed.flowId).toBe('flow-1');
    expect(parsed.operation).toBe('race_results');
    expect(parsed.reasonCode).toBe('network');
  });
});
