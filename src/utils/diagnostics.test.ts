import { describe, expect, it } from 'vitest';
import {
  appendDiagnosticEvent,
  classifyDiagnosticError,
  createFlowId,
  getDiagnosticTrace,
  type DiagnosticStorage,
} from './diagnostics';

function memoryStorage(): DiagnosticStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('diagnostics', () => {
  it('creates non-empty flow identifiers', () => {
    expect(createFlowId()).toMatch(/^[A-Za-z0-9-]+$/);
  });

  it('classifies failures without retaining their messages', () => {
    expect(classifyDiagnosticError(new Error('Failed to fetch'))).toBe('network');
    expect(classifyDiagnosticError(new Error('Request timeout (5000ms)'))).toBe('timeout');
    expect(classifyDiagnosticError({ code: '42P01', message: 'missing relation' })).toBe('schema_unavailable');
  });

  it('keeps only the latest 100 sanitized events', () => {
    const storage = memoryStorage();
    for (let index = 0; index < 105; index += 1) {
      appendDiagnosticEvent({
        flowId: 'flow-safe', feature: 'race_detail', season: '2026', round: '1',
        timestamp: new Date(index).toISOString(), operation: `load ${index}`,
        outcome: 'succeeded', itemCount: index,
      }, storage);
    }
    const events = getDiagnosticTrace('flow-safe', storage);
    expect(events).toHaveLength(100);
    expect(events[0].itemCount).toBe(5);
    expect(events[0].operation).toBe('load_5');
  });
});
