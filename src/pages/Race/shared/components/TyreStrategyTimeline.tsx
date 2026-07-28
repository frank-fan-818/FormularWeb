import type { FastF1RaceAnalytics } from '@/types';
import { formatCompoundWithCode, formatTyreLife, getTyreAgeLabel } from '@/utils/tyreCompounds';
import { getStintPaceMetrics } from '../charts/tyreStrategy';
import { getCompoundColor, getMaxRaceLap } from '../charts/helpers';
import { TEXT } from '../constants';

function getTyreTimelineRows(
  analytics: FastF1RaceAnalytics,
  highlightedDrivers: string[] = [],
) {
  const highlightedSet = new Set(highlightedDrivers);
  const hasHighlight = highlightedSet.size > 0;

  return [...analytics.tyreStrategies]
    .sort((a, b) => {
      const aPosition = a.racePosition ?? Number.MAX_SAFE_INTEGER;
      const bPosition = b.racePosition ?? Number.MAX_SAFE_INTEGER;
      return aPosition - bPosition;
    })
    .map((strategy) => ({
      ...strategy,
      isMuted: hasHighlight && !highlightedSet.has(strategy.driver),
      stints: getStintPaceMetrics(analytics, strategy.driver, strategy.stints),
    }));
}

function TyreStrategyTimeline({
  analytics,
  highlightedDrivers,
  season,
  round,
}: {
  analytics: FastF1RaceAnalytics;
  highlightedDrivers: string[];
  season: string;
  round?: string;
}) {
  const maxLap = Math.max(1, getMaxRaceLap(analytics));
  const rows = getTyreTimelineRows(analytics, highlightedDrivers);

  return (
    <div className="tyre-broadcast-timeline" style={{ ['--max-lap' as string]: maxLap }}>
      {rows.map((strategy) => (
        <div
          key={strategy.driver}
          className={`tyre-timeline-row${strategy.isMuted ? ' is-muted' : ''}`}
        >
          <div className="tyre-timeline-driver">{strategy.driver}</div>
          <div className="tyre-timeline-track">
            {strategy.stints.map((stint) => {
              const startPct = ((stint.startLap - 1) / maxLap) * 100;
              const widthPct = (stint.lapCount / maxLap) * 100;
              const ageLabel = getTyreAgeLabel(stint);
              const compoundLabel = formatCompoundWithCode(season, round, stint.compound);
              const tyreLife = formatTyreLife(stint);
              const stintLabel = `Stint ${stint.stint}`;
              const lapRangeLabel = `L${stint.startLap}-L${stint.endLap}`;
              const tyreTooltipLabel = `${strategy.driver} ${compoundLabel} ${ageLabel} ${lapRangeLabel}${tyreLife ? ` ${tyreLife}` : ''}`;

              const endLabelClassName = stint.stint % 2 === 0
                ? 'tyre-stint-end-label is-below'
                : 'tyre-stint-end-label';

              return (
                <div
                  key={`${strategy.driver}-${stint.stint}`}
                  className={`tyre-stint-line${ageLabel === '\u65e7\u80ce' ? ' is-used' : ' is-new'}`}
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(widthPct, 0.8)}%`,
                    ['--compound-color' as string]: getCompoundColor(stint.compound),
                  }}
                  aria-label={tyreTooltipLabel}
                  tabIndex={0}
                >
                  <span className="tyre-stint-segment tyre-stint-segment-left" />
                  <span className="tyre-stint-segment tyre-stint-segment-right" />
                  <span className={endLabelClassName}>{stint.endLap}</span>
                  <span className="tyre-stint-tooltip" role="tooltip">
                    <span className="tyre-stint-tooltip-header">
                      <span className="tyre-stint-tooltip-compound">
                        <span className="tyre-stint-tooltip-swatch" />
                        <span>
                          <strong>{compoundLabel}</strong>
                          <em>{ageLabel}</em>
                        </span>
                      </span>
                      <span className="tyre-stint-tooltip-stint">{stintLabel}</span>
                    </span>
                    <span className="tyre-stint-tooltip-driver">{strategy.driver}</span>
                    <span className="tyre-stint-tooltip-grid">
                      <span>
                        <small>{'\u5708\u6bb5'}</small>
                        <strong>{lapRangeLabel}</strong>
                      </span>
                      <span>
                        <small>{'\u5708\u6570'}</small>
                        <strong>{stint.lapCount}</strong>
                      </span>
                      <span>
                        <small>{TEXT.tyreLife}</small>
                        <strong>{tyreLife || '-'}</strong>
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="tyre-timeline-finish">{maxLap}</div>
        </div>
      ))}
    </div>
  );
}

export { TyreStrategyTimeline };
