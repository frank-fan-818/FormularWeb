import { describe, expect, it } from 'vitest';
import type { Race } from '@/types';
import { getRaceWeekendTimeline } from './raceSchedule';

const labels = {
  fp1: 'FP1', fp2: 'FP2', fp3: 'FP3', qualifying: 'Qualifying',
  sprintQualifying: 'Sprint Qualifying', sprint: 'Sprint', race: 'Race',
};

const weekend: Race = {
  season: '2026', round: '12', url: '', raceName: 'Dutch GP', date: '2026-08-23', time: '13:00:00Z',
  Circuit: { circuitId: 'zandvoort', url: '', circuitName: 'Zandvoort', Location: { lat: '0', long: '0', locality: 'Zandvoort', country: 'Netherlands' } },
  FirstPractice: { date: '2026-08-21', time: '10:30:00Z' },
  Qualifying: { date: '2026-08-22', time: '14:00:00Z' },
};

describe('getRaceWeekendTimeline', () => {
  it('marks past sessions complete and the next session upcoming', () => {
    const timeline = getRaceWeekendTimeline(weekend, labels, new Date('2026-08-22T10:00:00Z'));

    expect(timeline.map((item) => item.state)).toEqual(['completed', 'upcoming', 'upcoming']);
    expect(timeline.find((item) => item.isNext)?.key).toBe('qualifying');
  });

  it('marks a recently started session live', () => {
    const timeline = getRaceWeekendTimeline(weekend, labels, new Date('2026-08-22T15:00:00Z'));

    expect(timeline.find((item) => item.key === 'qualifying')?.state).toBe('live');
    expect(timeline.find((item) => item.key === 'qualifying')?.isNext).toBe(true);
  });

  it('keeps a dated session without a published time visible as scheduled', () => {
    const timeline = getRaceWeekendTimeline(
      { ...weekend, FirstPractice: { date: '2026-08-21' } },
      labels,
      new Date('2026-08-20T10:00:00Z'),
    );

    expect(timeline[0]).toMatchObject({ key: 'fp1', state: 'scheduled', isNext: true, timeLabel: '时间待定' });
  });
});
