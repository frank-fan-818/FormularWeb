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
              return (
                <button
                  key={item.driver}
                  type="button"
                  className={`driver-legend-item${isActive ? ' is-active' : ''}`}
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
              <div className="duel-stint-panel">
                <div className="telemetry-panel-title">{t('duelRacePace')}</div>
                <div className="duel-stint-grid">
                  {selectedDrivers.map((driver) => {
                    const stints = tyreSummaryItems.find(item => item.driver === driver)?.stints || [];
                    return (
                      <section key={driver} className="duel-stint-driver" aria-label={`${driver} ${t('duelRacePace')}`}>
                        <h4>{driver}</h4>
                        {stints.length ? (
                          <div className="duel-stint-scroll" tabIndex={0}>
                            <table className="duel-stint-table">
                              <thead><tr>
                                <th>Stint</th><th>{t('laps')}</th><th>{t('tyreStrategy')}</th>
                                <th>{t('stintPace')}</th><th>{t('degradation')}</th>
                              </tr></thead>
                              <tbody>{stints.map(stint => (
                                <tr key={stint.stint}>
                                  <td>{stint.stint}</td>
                                  <td>L{stint.startLap}–{stint.endLap}</td>
                                  <td><span className="duel-stint-compound">
                                    <span className="compound-swatch" style={{ backgroundColor: getCompoundColor(stint.compound) }} />
                                    {formatCompoundWithCode(season, round, stint.compound)}
                                    <small>{getTyreAgeLabel(stint)}</small>
                                  </span></td>
                                  <td>{formatSessionSeconds(stint.averagePaceSeconds)}</td>
                                  <td>{formatSignedSeconds(stint.degradationSeconds)}</td>
                                </tr>
                              ))}</tbody>
                            </table>
                          </div>
                        ) : <p className="duel-data-message">{t('duelStintsUnavailable')}</p>}
                      </section>
                    );
                  })}
                </div>
                <p className="duel-data-message">{t('duelPaceNote')}</p>
              </div>
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
              ) : <p className="duel-data-message">{t('duelSectorsUnavailable')}</p>}
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
              ) : <p className="duel-data-message">{t('duelCornersUnavailable')}</p>}
            </div>
          ) : (
            <div className="duel-empty-state">{t('duelSelectDrivers')}</div>
          )}
        </div>
      )}
    </Card>
  );
}
