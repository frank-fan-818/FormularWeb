import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { TableProps } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import type { RacePreviewSummary, RecentGrandPrixResult } from '@/types';
import ViewportTable from './ViewportTable';
import { RaceHistoricalContextPanel } from './RaceHistoricalContextPanel';

vi.mock('./ViewportTable', () => ({ default: vi.fn(() => null) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const record: RecentGrandPrixResult = {
  raceId: 1, season: 2023, round: 16, raceName: 'Singapore Grand Prix', circuitId: 'marina_bay', date: '2023-09-17',
  winnerDriverId: 'carlos_sainz_jr', winnerName: 'Carlos Sainz Jr.',
  winnerConstructorId: 'ferrari', winnerConstructorName: 'Ferrari',
  poleDriverId: 'carlos_sainz_jr', poleName: 'Carlos Sainz Jr.',
  podium: [
    { position: 1, driverId: 'carlos_sainz_jr', driverName: 'Carlos Sainz Jr.', constructorId: 'ferrari', constructorName: 'Ferrari' },
    { position: 2, driverId: 'lando_norris', driverName: 'Lando Norris', constructorId: 'mclaren', constructorName: 'McLaren' },
    { position: 3, driverId: 'lewis_hamilton', driverName: 'Lewis Hamilton', constructorId: 'mercedes', constructorName: 'Mercedes' },
  ],
};

function renderCells(row: RecentGrandPrixResult) {
  const summary: RacePreviewSummary = {
    season: 2026, round: 1, circuitId: 'marina_bay', recentResults: [row],
    interruptionProbabilities: [], interruptionSamples: [], poleWinConversionPct: null, sampleSize: 1,
  };
  renderToStaticMarkup(<RaceHistoricalContextPanel summary={summary} loading={false} error={null}
    onRetry={() => undefined} predictionsEnabled={false} raceResults={[]} qualifyingResults={[]} sprintResults={[]} />);
  const calls = vi.mocked(ViewportTable).mock.calls;
  const props = calls[calls.length - 1]?.[0] as TableProps<RecentGrandPrixResult>;
  return ['winner', 'pole', 'podium'].map(key => {
    const column = props.columns?.find(column => column.key === key);
    if (!column || !('render' in column) || !column.render) throw new Error(`Missing ${key} column`);
    return renderToStaticMarkup(<div>{column.render(null, row, 0) as ReactNode}</div>);
  });
}

describe('historical race driver names', () => {
  it('uses full names in all result columns without deriving JR or other codes from driver IDs', () => {
    const [winner, pole, podium] = renderCells(record);
    expect(winner).toContain('Carlos Sainz Jr.');
    expect(pole).toContain('Carlos Sainz Jr.');
    expect(podium).toContain('Carlos Sainz Jr.');
    expect(podium).toContain('Lando Norris');
    expect(podium).toContain('Lewis Hamilton');
    for (const cell of [winner, pole, podium]) expect(cell).not.toMatch(/>(JR|NOR|HAM|SAI)</);
  });

  it('keeps absent results as plain placeholders without a driver badge', () => {
    const cells = renderCells({ ...record, winnerDriverId: null, winnerName: null, poleDriverId: null, poleName: null, podium: [] });
    for (const cell of cells) {
      expect(cell).toContain('-');
      expect(cell).not.toContain('background-color');
    }
  });
});
