import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, Spin, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CarOutlined,
  FlagOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import dayjs from 'dayjs';
import { seasonApi } from '@/api/ergast';
import { historyProfilesApi } from '@/api/historyProfiles';
import type { BestFinishSummary, DriverHistoryProfile } from '@/types';
import { canCountChampionshipSeason, getCountableChampionshipSeasons } from '@/utils/championship';
import { isSeasonComplete } from '@/utils/seasonCompletion';
import { getTeamColor } from '@/utils/teamColors';
import './HistoryDetail.css';

function formatPoints(points: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(points);
}

function formatBestFinish(summary: BestFinishSummary | null | undefined): string {
  if (!summary) {
    return '-';
  }

  if (summary.seasons.length === 1) {
    return `P${summary.position} - ${summary.seasons[0]}`;
  }

  return `P${summary.position} - ${summary.seasons.length} seasons`;
}

const DriverHistoryDetail = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<DriverHistoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLatestSeasonComplete, setIsLatestSeasonComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadDriverHistory = async () => {
      if (!driverId) {
        setDriver(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profile = await historyProfilesApi.getDriverHistoryProfile(driverId);
        if (!cancelled) {
          setDriver(profile);
        }
      } catch {
        if (!cancelled) {
          setDriver(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDriverHistory();

    return () => {
      cancelled = true;
    };
  }, [driverId]);

  const seasons = driver?.seasons || [];
  const firstSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;
  const latestSeason = seasons[0] || null;
  const latestSeasonPosition = latestSeason?.position;
  const latestSeasonYear = latestSeason?.season;
  const latestSeasonCanBeChampion = latestSeason?.position === '1' ? isLatestSeasonComplete : true;
  const bestFinish = driver?.bestRaceFinish;
  const championshipSeasons = getCountableChampionshipSeasons(seasons, latestSeason, latestSeasonCanBeChampion);
  const championshipSeasonLabels = championshipSeasons.map((season) => season.season);
  const accentColor = driver?.recentConstructorId ? getTeamColor(driver.recentConstructorId) : '#FF1801';
  const accentStyle = { ['--history-accent' as string]: accentColor };
  const subtitleBits = [
    driver?.nationality || '',
    driver?.dateOfBirth ? dayjs(driver.dateOfBirth).format('YYYY-MM-DD') : '',
  ].filter(Boolean);

  useEffect(() => {
    let cancelled = false;

    const loadLatestSeasonStatus = async () => {
      if (!latestSeasonYear || latestSeasonPosition !== '1') {
        setIsLatestSeasonComplete(true);
        return;
      }

      try {
        const races = await seasonApi.getSeasonRaces(latestSeasonYear);
        if (!cancelled) {
          setIsLatestSeasonComplete(isSeasonComplete(races));
        }
      } catch {
        if (!cancelled) {
          setIsLatestSeasonComplete(false);
        }
      }
    };

    void loadLatestSeasonStatus();

    return () => {
      cancelled = true;
    };
  }, [latestSeasonPosition, latestSeasonYear]);

  if (!loading && !driver) {
    return (
      <div className="history-detail-container">
        <Helmet>
          <title>&#x8f66;&#x624b;&#x5386;&#x53f2; &#8212; F1 Dashboard</title>
          <meta name="description" content="F1&#x8f66;&#x624b;&#x5386;&#x53f2;&#x6863;&#x6848;, &#x5386;&#x5e74;&#x6210;&#x7ee9;&#x548c;&#x751f;&#x6daf;&#x56de;&#x987e;" />
        </Helmet>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="history-back-button">
          Back
        </Button>
        <Card className="history-empty-card">
          <Empty description="Driver history is unavailable." />
        </Card>
      </div>
    );
  }

  return (
    <div className="history-detail-container" style={accentStyle}>
      <Helmet>
        <title>{driver?.givenName && driver?.familyName ? `${driver.givenName} ${driver.familyName} &#x5386;&#x53f2;&#x6863;&#x6848; &#8212; F1 Dashboard` : '&#x8f66;&#x624b;&#x5386;&#x53f2; &#8212; F1 Dashboard'}</title>
        <meta name="description" content={`${driver?.givenName || ''} ${driver?.familyName || ''} F1&#x8f66;&#x624b;&#x5386;&#x53f2;&#x6863;&#x6848;, &#x5386;&#x5e74;&#x6210;&#x7ee9;&#x548c;&#x751f;&#x6daf;&#x56de;&#x987e;`} />
      </Helmet>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="history-back-button">
        Back
      </Button>

      {loading ? (
        <Card className="history-loading-card">
          <Spin size="large" />
        </Card>
      ) : (
        <>
          <Card className="history-hero-card">
            <div className="history-hero">
              <span className="history-eyebrow">
                <CarOutlined />
                Driver Archive
              </span>

              <div>
                <h1 className="history-title">
                  {driver?.givenName} {driver?.familyName}
                </h1>
                <p className="history-subtitle">
                  {subtitleBits.length > 0 ? subtitleBits.join(' | ') : 'Historical driver profile'}
                </p>
              </div>

              <div className="history-chip-row">
                {driver?.code ? (
                  <span className="history-chip history-chip--accent">
                    <strong>{driver.code.toUpperCase()}</strong>
                  </span>
                ) : null}
                {driver?.permanentNumber ? (
                  <span className="history-chip">
                    <FlagOutlined />
                    Number <strong>#{driver.permanentNumber}</strong>
                  </span>
                ) : null}
                <span className="history-chip">
                  <CalendarOutlined />
                  Seasons <strong>{seasons.length}</strong>
                </span>
                <span className="history-chip">
                  <TeamOutlined />
                  Recent Team <strong>{driver?.recentConstructorName || 'Unknown'}</strong>
                </span>
              </div>
            </div>
          </Card>

          <h2 className="history-section-title">Career Summary</h2>
          <div className="history-summary-grid">
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Entries</div>
              <div className="history-summary-value">{driver?.careerSummary.raceCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Wins</div>
              <div className="history-summary-value">{driver?.careerSummary.winCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Podiums</div>
              <div className="history-summary-value">{driver?.careerSummary.podiumCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Pole Positions</div>
              <div className="history-summary-value">{driver?.careerSummary.poleCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">World Championships</div>
              <div className="history-summary-value">{championshipSeasons.length}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Total Points</div>
              <div className="history-summary-value">{formatPoints(driver?.careerSummary.totalPoints || 0)}</div>
            </Card>
          </div>

          <h2 className="history-section-title">Key Records</h2>
          <div className="history-meta-grid">
            <Card className="history-meta-card">
              <div className="history-summary-card">
                <div className="history-meta-label">First Season</div>
                <div className="history-meta-value">{firstSeason?.season || '-'}</div>
              </div>
            </Card>
            <Card className="history-meta-card">
              <div className="history-summary-card">
                <div className="history-meta-label">Latest Season</div>
                <div className="history-meta-value">{latestSeason?.season || '-'}</div>
              </div>
            </Card>
            <Card className="history-meta-card">
              <div className="history-summary-card">
                <div className="history-meta-label">Best Race Finish</div>
                <div className="history-meta-value">{formatBestFinish(bestFinish)}</div>
              </div>
            </Card>
            <Card className="history-meta-card">
              <div className="history-summary-card">
                <div className="history-meta-label">Nationality</div>
                <div className="history-meta-value">{driver?.nationality || '-'}</div>
              </div>
            </Card>
          </div>

          <Card className="history-wide-card">
            <div className="history-meta-label">Championship Seasons</div>
            {championshipSeasonLabels.length > 0 ? (
              <div className="history-meta-tags">
                {championshipSeasonLabels.map((season) => (
                  <span key={season} className="history-mini-tag">{season}</span>
                ))}
              </div>
            ) : (
              <div className="history-wide-card__empty">-</div>
            )}
          </Card>

          <Card className="history-table-card" title="Season Timeline">
            {seasons.length === 0 ? (
              <Empty
                className="history-empty-state"
                description="Historical season data is not available for this driver yet."
              />
            ) : (
              <>
                <div className="history-mobile-season-list">
                  {seasons.map((season) => {
                    const isChampion = canCountChampionshipSeason(season, latestSeason, latestSeasonCanBeChampion);
                    const isLatest = season.season === latestSeason?.season;
                    const swatchColor = season.constructorId ? getTeamColor(season.constructorId) : accentColor;

                    return (
                      <div
                        key={`mobile-${season.season}-${season.constructorId}`}
                        className={`history-mobile-season-card ${isChampion ? 'is-highlighted' : ''}`}
                      >
                        <div className="history-mobile-season-head">
                          <div className="history-mobile-season-title">{season.season}</div>
                          <span className="history-table-tags">
                            {isChampion ? <Tag color="gold">Champion</Tag> : null}
                            {isLatest ? <Tag color="blue">Latest</Tag> : null}
                          </span>
                        </div>
                        <div className="history-mobile-season-body">
                          <div className="history-mobile-season-row">
                            <span className="history-mobile-season-key">Team</span>
                            <span className="history-mobile-season-value history-team-cell">
                              <span className="history-team-swatch" style={{ backgroundColor: swatchColor }} />
                              <span>{season.constructorName || '-'}</span>
                            </span>
                          </div>
                          <div className="history-mobile-season-row">
                            <span className="history-mobile-season-key">Rank</span>
                            <span className="history-mobile-season-value">{season.position ? `P${season.position}` : '-'}</span>
                          </div>
                          <div className="history-mobile-season-row">
                            <span className="history-mobile-season-key">Points</span>
                            <span className="history-mobile-season-value">{formatPoints(season.points)}</span>
                          </div>
                          <div className="history-mobile-season-row">
                            <span className="history-mobile-season-key">Wins</span>
                            <span className="history-mobile-season-value">{season.wins}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th>Team</th>
                        <th>Rank</th>
                        <th>Points</th>
                        <th>Wins</th>
                        <th>Highlights</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasons.map((season) => {
                        const isChampion = canCountChampionshipSeason(season, latestSeason, latestSeasonCanBeChampion);
                        const isLatest = season.season === latestSeason?.season;
                        const swatchColor = season.constructorId ? getTeamColor(season.constructorId) : accentColor;

                        return (
                          <tr key={`${season.season}-${season.constructorId}`} className={isChampion ? 'history-row-highlight' : ''}>
                            <td>{season.season}</td>
                            <td>
                              <span className="history-team-cell">
                                <span className="history-team-swatch" style={{ backgroundColor: swatchColor }} />
                                <span>{season.constructorName || '-'}</span>
                              </span>
                            </td>
                            <td>{season.position ? `P${season.position}` : '-'}</td>
                            <td>{formatPoints(season.points)}</td>
                            <td>{season.wins}</td>
                            <td>
                              <span className="history-table-tags">
                                {isChampion ? <Tag color="gold">Champion</Tag> : null}
                                {isLatest ? <Tag color="blue">Latest</Tag> : null}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default DriverHistoryDetail;
