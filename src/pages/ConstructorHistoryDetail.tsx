import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  FlagOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import DocumentHead from '@/components/DocumentHead';
import { seasonApi } from '@/api/ergast';
import { historyProfilesApi } from '@/api/historyProfiles';
import type { BestFinishSummary, ConstructorHistoryProfile } from '@/types';
import { canCountChampionshipSeason, getCountableChampionshipSeasons } from '@/utils/championship';
import { isSeasonComplete } from '@/utils/seasonCompletion';
import { getTeamColor } from '@/utils/teamColors';
import { TimingBeacon } from '@/components/loading/TimingBeacon';
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

const ConstructorHistoryDetail = () => {
  const { constructorId } = useParams<{ constructorId: string }>();
  const navigate = useNavigate();
  const [constructor, setConstructor] = useState<ConstructorHistoryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLatestSeasonComplete, setIsLatestSeasonComplete] = useState(false);

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
        const profile = await historyProfilesApi.getConstructorHistoryProfile(constructorId);
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
  const latestSeasonPosition = latestSeason?.position;
  const latestSeasonYear = latestSeason?.season;
  const latestSeasonCanBeChampion = latestSeason?.position === '1' ? isLatestSeasonComplete : true;
  const bestFinish = constructor?.bestRaceFinish;
  const championshipSeasons = getCountableChampionshipSeasons(seasons, latestSeason, latestSeasonCanBeChampion);
  const championshipSeasonLabels = championshipSeasons.map((season) => season.season);
  const accentColor = constructor?.constructorId ? getTeamColor(constructor.constructorId) : '#FF1801';
  const accentStyle = { ['--history-accent' as string]: accentColor };

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

  if (!loading && !constructor) {
    return (
      <div className="history-detail-container">
        <DocumentHead title="车队历史 — F1 Dashboard" description="F1车队历史档案，历年成绩和赛季回顾" />
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
      <DocumentHead
        title={constructor?.name ? `${constructor.name} 历史档案 — F1 Dashboard` : '车队历史 — F1 Dashboard'}
        description={`${constructor?.name || ''} F1车队历史档案，历年成绩和赛季回顾`}
      />
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} className="history-back-button">
        Back
      </Button>

      {loading ? (
        <Card className="history-loading-card">
          <TimingBeacon label="Loading constructor archive" detail="Seasons · results · championship record" />
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
                  Best Race Finish <strong>{bestFinish ? `P${bestFinish.position}` : '-'}</strong>
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
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Race Wins</div>
              <div className="history-summary-value">{constructor?.careerSummary.winCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Podiums</div>
              <div className="history-summary-value">{constructor?.careerSummary.podiumCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Pole Positions</div>
              <div className="history-summary-value">{constructor?.careerSummary.poleCount || 0}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">World Championships</div>
              <div className="history-summary-value">{championshipSeasons.length}</div>
            </Card>
            <Card className="history-summary-card">
              <div className="history-summary-label">Total Points</div>
              <div className="history-summary-value">{formatPoints(constructor?.careerSummary.totalPoints || 0)}</div>
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
                <div className="history-meta-value">{constructor?.nationality || '-'}</div>
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
                description="Historical season data is not available for this constructor yet."
              />
            ) : (
              <>
                <div className="history-mobile-season-list">
                  {seasons.map((season) => {
                    const isChampion = canCountChampionshipSeason(season, latestSeason, latestSeasonCanBeChampion);
                    const isLatest = season.season === latestSeason?.season;

                    return (
                      <div
                        key={`mobile-${season.season}`}
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
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default ConstructorHistoryDetail;
