import { create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Result } from '@/types';
import { buildRaceOverviewInsights } from '@/utils/raceOverviewInsights';
import { RaceOverviewPanel } from './RaceOverviewPanel';

vi.mock('@/utils/constructorLogos', () => ({ ConstructorLogo: () => null }));
vi.mock('@/utils/driverImages', () => ({ DriverAvatar: () => null }));
vi.mock('@ant-design/icons', () => ({
  ArrowDownOutlined: () => null, ArrowUpOutlined: () => null,
  FieldTimeOutlined: () => null, ThunderboltOutlined: () => null,
}));

function result(driverId: string, givenName: string, familyName: string, position: number, status = 'Finished'): Result {
  return {
    number: String(position), position: String(position), positionText: String(position),
    points: '0', grid: '5', laps: '57', status,
    Driver: { driverId, givenName, familyName, code: driverId.slice(0, 3).toUpperCase(),
      permanentNumber: '', url: '', dateOfBirth: '', nationality: '' },
    Constructor: { constructorId: 'ferrari', name: 'Ferrari', url: '', nationality: 'Italian' },
  };
}

const winner = result('russell', 'George', 'Russell', 1);
const retirements = [
  result('sainz', 'Carlos', 'Sainz', 17, 'Engine'),
  result('perez', 'Sergio', 'Pérez', 18, 'Collision'),
  result('stroll', 'Lance', 'Stroll', 19, 'Accident'),
  result('alonso', 'Fernando', 'Alonso', 20, 'Gearbox'),
];

describe('race overview stories', () => {
  it('keeps all retired drivers in an initially collapsed disclosure with full names and profile links', () => {
    const insights = buildRaceOverviewInsights([winner, ...retirements], [], null);
    const view = create(<MemoryRouter><RaceOverviewPanel insights={insights} /></MemoryRouter>);
    const card = view.root.findByProps({ className: 'race-story-card tone-neutral' });
    expect(card.findByType('strong').children).toEqual(['4']);
    expect(card.findByType('details').props.open).toBeUndefined();
    expect(card.findByType('summary').findByType('strong').children).toEqual(['4']);
    expect(card.findAllByType('a').map(link => ({ text: link.children.join(''), href: link.props.href })))
      .toEqual(retirements.map(({ Driver }) => ({
        text: `${Driver.givenName} ${Driver.familyName}`, href: `/drivers/${Driver.driverId}`,
      })));
    const gain = view.root.findByProps({ className: 'race-story-card tone-positive' });
    expect(gain.findByType('a').children.join('')).toBe('George Russell');
    expect(gain.findByType('small').children.join('')).toBe('发车 P5 → 赛后 P1');
    view.unmount();
  });

  it('explains zero retirements without displaying unrelated track interruption information', () => {
    const insights = { ...buildRaceOverviewInsights([winner], [], null), interruptionCount: 3 };
    const view = create(<MemoryRouter><RaceOverviewPanel insights={insights} /></MemoryRouter>);
    const card = view.root.findByProps({ className: 'race-story-card tone-neutral' });
    expect(card.findByType('strong').children).toEqual(['0']);
    expect(card.findAllByType('a')).toHaveLength(0);
    expect(card.findAllByType('details')).toHaveLength(0);
    expect(card.findAllByType('span').some(span => span.children.join('') === '全员完赛')).toBe(true);
    expect(card.findAllByType('small')).toHaveLength(0);
    view.unmount();
  });

  it('keeps the awaiting-results message when no winner is available', () => {
    const insights = buildRaceOverviewInsights([], [], null);
    const view = create(<MemoryRouter><RaceOverviewPanel insights={insights} /></MemoryRouter>);
    expect(view.root.findByType('h2').children).toEqual(['正赛结果尚未发布']);
    expect(view.root.findAllByProps({ className: 'race-story-grid' })).toHaveLength(0);
    view.unmount();
  });

  it('distinguishes a pending race classification from an unpublished result', () => {
    const insights = buildRaceOverviewInsights([], [], null);
    const view = create(<MemoryRouter><RaceOverviewPanel insights={insights} loading /></MemoryRouter>);
    expect(view.root.findByType('h2').children).toEqual(['正在获取正赛成绩']);
    view.update(<MemoryRouter><RaceOverviewPanel insights={insights} loading={false} /></MemoryRouter>);
    expect(view.root.findByType('h2').children).toEqual(['正赛结果尚未发布']);
    view.unmount();
  });
});
