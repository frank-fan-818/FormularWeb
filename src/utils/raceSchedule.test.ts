import { describe, expect, it } from 'vitest';
import type { Race } from '@/types';
import {
  formatRaceDateTimeFull, formatSessionDateTime, formatSessionDateLabel,
  formatSessionDayLabel, formatSessionTimeLabel, getRaceWeekendScheduleGroups, getRaceWeekendTimeline,
} from './raceSchedule';

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

describe('race schedule display time zones', () => {
  const raceStart = { date: '2026-11-01', time: '20:00:00Z' };

  it('defaults to UTC+8 and converts dates together with times', () => {
    expect(formatRaceDateTimeFull(raceStart)).toBe('2026-11-02 04:00 UTC+8');
    expect(formatRaceDateTimeFull(raceStart, 0)).toBe('2026-11-01 20:00 UTC+0');
    expect(formatRaceDateTimeFull(raceStart, -300)).toBe('2026-11-01 15:00 UTC-5');
    expect(formatSessionDateTime(raceStart, 345)).toBe('11-02 01:45 UTC+5:45');
    expect(formatRaceDateTimeFull({ date: '2026-12-31', time: '20:00:00Z' })).toBe('2027-01-01 04:00 UTC+8');
  });

  it('keeps unknown times and date-only sessions stable in every time zone', () => {
    const session = { date: '2026-11-01' };
    expect(formatRaceDateTimeFull(session, -720)).toBe('2026-11-01');
    expect(formatSessionDateTime(session, 840)).toBe('11-01');
    expect(formatSessionDateLabel(session, -720)).toBe('11-01');
    expect(formatSessionDayLabel(session, -720)).toBe('周日');
    expect(formatSessionTimeLabel(session, -720)).toBe('时间待定');
    expect(formatSessionDateTime(null)).toBe('-');
    expect(formatRaceDateTimeFull({ ...session, time: 'invalid' }, 0)).toBe('2026-11-01');
  });

  it('regroups sessions by the displayed date without changing live status or order', () => {
    const race = { ...weekend, date: '2026-11-01', time: '23:30:00Z',
      FirstPractice: { date: '2026-11-01', time: '15:30:00Z' }, Qualifying: undefined };
    const now = new Date('2026-11-01T16:00:00Z');
    const utc = getRaceWeekendTimeline(race, labels, now, 0);
    const east = getRaceWeekendTimeline(race, labels, now, 480);
    expect(east.map(item => [item.timestamp, item.state, item.isNext])).toEqual(utc.map(item => [item.timestamp, item.state, item.isNext]));
    expect(getRaceWeekendScheduleGroups(utc, 0).map(group => group.dateLabel)).toEqual(['11-01']);
    const groups = getRaceWeekendScheduleGroups(east, 480);
    expect(groups.map(group => [group.dateLabel, group.dayLabel])).toEqual([['11-01', '周日'], ['11-02', '周一']]);
    expect(groups.map(group => group.sessions[0].timeLabel)).toEqual(['23:30', '07:30']);
  });
});
