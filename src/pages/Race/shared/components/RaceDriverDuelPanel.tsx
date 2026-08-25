import { Button, Card } from 'antd';
import { useTranslation } from '@/i18n';
import type {
  getDuelCornerRows,
  getDuelDriverItems,
  getDuelSectorGapItems,
  getDuelTyreSummaryItems,
} from '@/pages/Race/shared/duelAnalysis';
import { getCompoundColor, formatSessionSeconds } from '@/pages/Race/shared/charts/helpers';
import {
  formatNumber,
  formatSignedNumber,
  formatSignedSeconds,
  formatSpeed,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import { formatCompoundWithCode, getTyreAgeLabel } from '@/utils/tyreCompounds';

interface RaceDriverDuelPanelProps {
  enabled: boolean;
  collapsed: boolean;
  season: string;
  round: string;
  selectedDrivers: string[];
  driverItems: ReturnType<typeof getDuelDriverItems>;
  tyreSummaryItems: ReturnType<typeof getDuelTyreSummaryItems>;
  sectorGapItems: ReturnType<typeof getDuelSectorGapItems>;
  cornerRows: ReturnType<typeof getDuelCornerRows>;
  duelReady: boolean;
  onToggleCollapsed: () => void;
  onToggleDriver: (driver: string) => void;
}

export function RaceDriverDuelPanel({
  enabled,
  collapsed,
  season,
  round,
  selectedDrivers,
  driverItems,
  tyreSummaryItems,
  sectorGapItems,
  cornerRows,
  duelReady,
  onToggleCollapsed,
  onToggleDriver,
}: RaceDriverDuelPanelProps) {
  const { t } = useTranslation();
  if (!enabled) return null;

  return (
    <Card
      id="analysis-duel"
      data-module-index="03"
      className="fastf1-chart-card driver-duel-card"
      title={(
        <div className="fastf1-chart-header">
          <div>
            <span className="analysis-module-kicker">03 / HEAD-TO-HEAD</span>
            <h3 className="fastf1-chart-title">{t('driverDuel')}</h3>
            <p>{t('driverDuelDescription')}</p>
          </div>
          {tyreSummaryItems.length ? (
            <div className="duel-summary-pills" aria-label={t('driverDuel')}>
              {tyreSummaryItems.map((item) => (
                <span key={item.driver} className="duel-stint-pill">
                  <strong>{item.driver}</strong>
                  {item.stints.map((stint) => (
                    <span key={`${item.driver}-${stint.stint}`} className="duel-stint-token">
                      <span
                        className="compound-swatch"
                        style={{ backgroundColor: getCompoundColor(stint.compound) }}
                      />
                      <strong>{formatCompoundWithCode(season, round, stint.compound)}</strong>
                      <em>{getTyreAgeLabel(stint)}</em>
                      {formatSessionSeconds(stint.averagePaceSeconds)}
                      {stint.previousDeltaSeconds !== null ? (
                        <em>{formatSignedSeconds(stint.previousDeltaSeconds)}</em>
                      ) : null}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      extra={(
        <Button type="text" size="small" aria-expanded={!collapsed} aria-controls="analysis-duel-body" onClick={onToggleCollapsed}>
          {collapsed ? t('expand') : t('collapse')}
        </Button>
      )}
    >
      {collapsed ? <div id="analysis-duel-body" hidden /> : (
        <div id="analysis-duel-body">
          <div className="driver-legend" aria-label={t('driverDuel')}>
            {driverItems.map((item) => {
              const isActive = selectedDrivers.includes(item.driver);
              const isMuted = selectedDrivers.length === 2 && !isActive;
              return (
                <button
                  key={item.driver}
                  type="button"
                  className={`driver-legend-item${isActive ? ' is-active' : ''}${isMuted ? ' is-muted' : ''}`}
                  aria-pressed={isActive}
                  onClick={() => onToggleDriver(item.driver)}
                >
                  <span className="driver-legend-line" style={{ backgroundColor: item.color }} />
                  {item.driver}
                  {isActive ? (
                    <span className="duel-pick-badge">{selectedDrivers.indexOf(item.driver) + 1}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {duelReady ? (
            <div className="duel-grid">
              {sectorGapItems.length ? (
                <div className="duel-sector-panel">
                  <div className="telemetry-panel-title">{t('qualifying')} Gap</div>
                  <div className="duel-sector-gap-grid">
                    {sectorGapItems.map((item) => (
                      <div key={item.key} className={`duel-sector-gap-card ${getGapToneClassName(item.value)}`}>
                        <span>{item.label}</span>
                        <strong>{formatSignedSeconds(item.value)}</strong>
                        <em>{item.firstDriver} vs {item.secondDriver}</em>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {cornerRows.length ? (
                <div className="duel-corner-panel">
                  <div className="telemetry-panel-title">{t('cornerSpeed')}</div>
                  <div className="duel-corner-grid">
                    {cornerRows.map((row) => (
                      <div key={row.key} className="duel-corner-card">
                        <div className="duel-corner-head">
                          <span>{row.corner}</span>
                          <em>{formatNumber(row.distanceM, 0)}m</em>
                        </div>
                        <div className="duel-corner-row">
                          <strong>{row.driverA}</strong>
                          <span>{formatSpeed(row.firstMinSpeed)}</span>
                        </div>
                        <div className="duel-corner-row">
                          <strong>{row.driverB}</strong>
                          <span>{formatSpeed(row.secondMinSpeed)}</span>
                        </div>
                        <div className="duel-corner-row is-delta">
                          <strong>{t('delta')}</strong>
                          <span>{formatSignedNumber(row.delta, 1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="duel-empty-state">{t('driverDuel')}: {t('driver')} 2</div>
          )}
        </div>
      )}
    </Card>
  );
}
