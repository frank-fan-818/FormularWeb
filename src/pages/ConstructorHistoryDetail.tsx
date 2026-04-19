import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, Spin, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  FlagOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { historyApi } from '@/api/ergast';
import type { ConstructorHistoryProfile, ConstructorSeasonHistoryItem } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import './HistoryDetail.css';

function formatPoints(points: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(points);
}

function getSeasonPositionValue(position: string): number {
  const value = parseInt(position, 10);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function getBestFinishSummary(seasons: ConstructorSeasonHistoryItem[]): {
  position: string;
  seasons: string[];
} | null {
  if (seasons.length === 0) {
    return null;
  }

  const bestPositionValue = seasons.reduce((best, current) => {
    return Math.min(best, getSeasonPositionValue(current.position));
  }, Number.POSITIVE_INFINITY);

  return {
    position: seasons.find((season) => getSeasonPositionValue(season.position) === bestPositionValue)?.position || '-',
    seasons: seasons
      .filter((season) => getSeasonPositionValue(season.position) === bestPositionValue)
      .map((season) => season.season),
  };
}

function formatBestFinish(summary: { position: string; seasons: string[] } | null): string {
  if (!summary) {
    return '-';
  }

  if (summary.seasons.length === 1) {
    return `P${summary.position} - ${summary.seasons[0]}`;
  }

  return `P${summary.position} - ${summary.seasons.length} seasons`;
}

const ConstructorHistoryDetail = () => {
  const { constructorId } = useParams<{ constructorId: string }>();
  const navigate = useNavigate();
  const [constructor, setConstructor] = useState<ConstructorHistoryProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadConstructorHistory = async () => {
      if (!constructorId) {
        setConstructor(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profile = await historyApi.getConstructorHistoryProfile(constructorId);
        if (!cancelled) {
          setConstructor(profile);
        }
      } catch {
        if (!cancelled) {
          setConstructor(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadConstructorHistory();

    return () => {
      cancelled = true;
    };
  }, [constructorId]);

  const seasons = constructor?.seasons || [];
  const firstSeason = seasons.length > 0 ? seasons[seasons.length - 1] : null;
  const latestSeason = seasons[0] || null;
  const bestFinish = getBestFinishSummary(seasons);
  const championshipSeasons = seasons.filter((season) => season.position === '1');
  const accentColor = constructor?.constructorId ? getTeamColor(constructor.constructorId) : '#FF1801';
  const accentStyle = { ['--history-accent' as string]: accentColor };

  if (!loading && !constructor) {
    return (
      <div className="history-detail-container">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="history-back-button">
          Back
        </Button>
        <Card className="history-empty-card">
          <Empty description="Constructor history is unavailable." />
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
                <TeamOutlined />
                Constructor Archive
              </span>

              <div>
                <h1 className="history-title">{constructor?.name}</h1>
                <p className="history-subtitle">
                  {constructor?.nationality || 'Historical constructor profile'}
                </p>
              </div>

              <div className="history-chip-row">
                <span className="history-chip history-chip--accent">
                  <TrophyOutlined />
                  Best Finish <strong>{bestFinish ? `P${bestFinish.position}` : '-'}</strong>
                </span>
                <span className="history-chip">
                  <CalendarOutlined />
                  Seasons <strong>{seasons.length}</strong>
                </span>
                <span className="history-chip">
                  <FlagOutlined />
                  Nationality <strong>{constructor?.nationality || '-'}</strong>
                </span>
                <span className="history-chip">
                  <TeamOutlined />
                  Latest Season <strong>{latestSeason?.season || '-'}</strong>
                </span>
              </div>
            </div>
          </Card>

          <h2 className="history-section-title">Career Summary</h2>
          <div className="history-summary-grid">
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Entries</div>
              <div className="history-summary-value">{constructor?.careerSummary.raceCount || 0}</div>
              <div className="history-summary-note">All recorded Grands Prix entered</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Wins</div>
              <div className="history-summary-value">{constructor?.careerSummary.winCount || 0}</div>
              <div className="history-summary-note">Career wins from aggregated results</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Podiums</div>
              <div className="history-summary-value">{constructor?.careerSummary.podiumCount || 0}</div>
              <div className="history-summary-note">Career podium finishes</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Pole Positions</div>
              <div className="history-summary-value">{constructor?.careerSummary.poleCount || 0}</div>
              <div className="history-summary-note">All qualifying P1 results</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">World Championships</div>
              <div className="history-summary-value">{constructor?.careerSummary.championshipCount || 0}</div>
              <div className="history-summary-note">Constructors' titles won</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Total Points</div>
              <div className="history-summary-value">{formatPoints(constructor?.careerSummary.totalPoints || 0)}</div>
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
                <div className="history-meta-label">Best Finish</div>
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
                description="Historical season data is not available for this constructor yet."
              />
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Season</th>
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

                      return (
                        <tr key={season.season} className={isChampion ? 'history-row-highlight' : ''}>
                          <td>{season.season}</td>
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

export default ConstructorHistoryDetail;
