import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RaceDriverDuelPanel } from './RaceDriverDuelPanel';

const props = {
  enabled: true, collapsed: false, season: '2026', round: '1',
  selectedDrivers: ['VER', 'ANT'],
  driverItems: ['VER', 'ANT'].map(driver => ({ driver, team: 'Test', color: '#ff1801' })),
  tyreSummaryItems: [], sectorGapItems: [], cornerRows: [], duelReady: true,
  onToggleCollapsed: () => undefined, onToggleDriver: () => undefined,
};

describe('driver duel data states', () => {
  it('explains unavailable comparison channels after two drivers are selected', () => {
    const html = renderToStaticMarkup(<RaceDriverDuelPanel {...props} />);
    expect(html).toContain('当前场次暂无所选车手的排位分段数据');
    expect(html).toContain('当前场次暂无所选车手的弯速数据');
    expect(html).toContain('当前场次暂无所选车手的轮胎分段数据');
  });

  it('renders stint pace and degradation in the body instead of the heading', () => {
    const html = renderToStaticMarkup(<RaceDriverDuelPanel {...props} tyreSummaryItems={[{
      driver: 'VER', stints: [{ driver: 'VER', stint: 1, compound: 'SOFT', startLap: 1,
        endLap: 10, lapCount: 10, averagePaceSeconds: 90, degradationSeconds: 0.25,
        previousDeltaSeconds: null }],
    }]} />);
    expect(html).toContain('duel-stint-table');
    expect(html).toContain('+0.250s');
    expect(html).not.toContain('duel-summary-pills');
  });
});
