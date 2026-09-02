import { describe, expect, it } from 'vitest';
import {
  getSessionDataPhase,
  getSessionUnavailableCopy,
} from './sessionDataAvailability';

const SESSION = { date: '2026-09-06', time: '13:00:00Z' };

describe('getSessionDataPhase', () => {
  it('distinguishes scheduled, processing, and delayed sessions', () => {
    expect(getSessionDataPhase(SESSION, new Date('2026-09-06T12:59:59Z'))).toBe('scheduled');
    expect(getSessionDataPhase(SESSION, new Date('2026-09-06T14:00:00Z'))).toBe('processing');
    expect(getSessionDataPhase(SESSION, new Date('2026-09-06T17:00:00Z'))).toBe('delayed');
  });

  it('does not pretend an undated session is already complete', () => {
    expect(getSessionDataPhase({ date: '2026-09-06' })).toBe('unknown');
    expect(getSessionDataPhase(null)).toBe('unknown');
  });
});

describe('getSessionUnavailableCopy', () => {
  it('does not tell users to retry a future session', () => {
    expect(getSessionUnavailableCopy({ label: '正赛', phase: 'scheduled' })).toEqual({
      title: '正赛尚未开始',
      description: '场次结束后，系统会自动获取计时数据并生成分析。',
      canRetry: false,
    });
  });

  it('explains when classification exists but deep analysis is delayed', () => {
    const copy = getSessionUnavailableCopy({
      label: '正赛',
      phase: 'delayed',
      hasClassification: true,
    });
    expect(copy.title).toBe('正赛分析数据延迟');
    expect(copy.description).toContain('官方排名已可查看');
    expect(copy.canRetry).toBe(true);
  });
});
