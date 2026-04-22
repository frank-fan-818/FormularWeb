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
import dayjs from 'dayjs';
import { historyApi } from '@/api/ergast';
import type { BestFinishSummary, DriverHistoryProfile } from '@/types';
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
        const profile = await historyApi.getDriverHistoryProfile(driverId);
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
  const bestFinish = driver?.bestRaceFinish;
  const championshipSeasons = seasons.filter((season) => season.position === '1');
  const accentColor = driver?.recentConstructorId ? getTeamColor(driver.recentConstructorId) : '#FF1801';
  const accentStyle = { ['--history-accent' as string]: accentColor };
  const subtitleBits = [
    driver?.nationality || '',
    driver?.dateOfBirth ? dayjs(driver.dateOfBirth).format('YYYY-MM-DD') : '',
  ].filter(Boolean);

  if (!loading && !driver) {
    return (
      <div className="history-detail-container">
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
              <div className="history-summary-note">Career starts across all recorded seasons</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Wins</div>
              <div className="history-summary-value">{driver?.careerSummary.winCount || 0}</div>
              <div className="history-summary-note">Career wins from aggregated results</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Podiums</div>
              <div className="history-summary-value">{driver?.careerSummary.podiumCount || 0}</div>
              <div className="history-summary-note">Career podium finishes</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Pole Positions</div>
              <div className="history-summary-value">{driver?.careerSummary.poleCount || 0}</div>
              <div className="history-summary-note">All qualifying P1 results</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">World Championships</div>
              <div className="history-summary-value">{driver?.careerSummary.championshipCount || 0}</div>
              <div className="history-summary-note">Final standings finishes in P1</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Total Points</div>
              <div className="history-summary-value">{formatPoints(driver?.careerSummary.totalPoints || 0)}</div>
              <div className="history-summary-note">Combined season standings points</div>
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
                <div className="history-meta-label">Championship Seasons</div>
                <div className="history-meta-value">
                  {championshipSeasons.length > 0
                    ? championshipSeasons.map((season) => season.season).join(', ')
                    : '-'}
                </div>
              </div>
            </Card>
          </div>

          <Card className="history-table-card" title="Season Timeline">
            {seasons.length === 0 ? (
              <Empty
                className="history-empty-state"
                description="Historical season data is not available for this driver yet."
              />
            ) : (
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
                      const isChampion = season.position === '1';
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
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default DriverHistoryDetail;
