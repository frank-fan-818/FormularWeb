import { useNavigate } from 'react-router-dom';
import { Card, Tabs } from 'antd';
import DocumentHead from '@/components/DocumentHead';
import { useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import { getTeamColor, getTeamDarkColor } from '@/utils/teamColors';
import ProductMasthead from '@/components/product/ProductMasthead';
import { buildSeasonSummary } from '@/utils/seasonSummary';
import { formatLocalDateTime } from '@/utils/dateTime';
import './Seasons.css';

const TEXT = {
  drivers: '\u8f66\u624b',
  constructors: '\u8f66\u961f',
  points: '\u79ef\u5206',
  nationality: '\u56fd\u7c4d',
  seasonStandings: '\u8d5b\u5b63\u79ef\u5206\u699c',
  position: 'POS',
  driver: '\u8f66\u624b',
  team: '\u8f66\u961f',
  gap: '\u5dee\u8ddd',
  leader: '\u9886\u5148',
  loading: '\u6b63\u5728\u52a0\u8f7d\u79ef\u5206\u699c...',
  unavailable: '\u79ef\u5206\u699c\u6570\u636e\u6682\u65f6\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  stale: '\u5df2\u663e\u793a\u6700\u8fd1\u53ef\u7528\u6570\u636e\uff0c\u540e\u53f0\u4ecd\u5728\u66f4\u65b0\u3002',
  retry: '\u91cd\u8bd5',
};

function formatGap(points: string, leaderPoints: number): string {
  const value = parseFloat(points);
  if (!Number.isFinite(value) || leaderPoints <= 0 || value === leaderPoints) {
    return TEXT.leader;
  }

  return `-${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(leaderPoints - value)}`;
}

const Seasons = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const {
    driverStandings,
    constructorStandings,
    races,
    loading,
    error,
    isStale,
    refetch,
    resources,
    updatedAt,
  } = useSeasonData(currentSeason);
  const maxDriverPoints = driverStandings[0] ? parseFloat(driverStandings[0].points) : 0;
  const maxConstructorPoints = constructorStandings[0] ? parseFloat(constructorStandings[0].points) : 0;
  const seasonSummary = buildSeasonSummary(races, driverStandings, constructorStandings);

  const tabItems = [
    {
      key: 'drivers',
      label: TEXT.drivers,
      children: (
        <div className="official-season-table">
          <div className="official-season-head">
            <span>{TEXT.position}</span>
            <span>{TEXT.driver}</span>
            <span>{TEXT.team}</span>
            <span>{TEXT.points}</span>
          </div>
          {resources.drivers.loading && driverStandings.length === 0 ? (
            <div className="season-table-skeleton" role="status" aria-label={TEXT.loading}>
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="season-skeleton-row" />)}
            </div>
          ) : resources.drivers.error && driverStandings.length === 0 ? (
            <div className="season-resource-error" role="alert">
              <span>{TEXT.unavailable}</span>
              <button type="button" onClick={resources.drivers.refetch}>{TEXT.retry}</button>
            </div>
          ) : null}
          {driverStandings.map((standing, index) => {
            const constructor = standing.Constructors[0];
            const teamColor = getTeamColor(constructor?.constructorId || 'unknown');
            const darkTeamColor = getTeamDarkColor(constructor?.constructorId || 'unknown');

            return (
              <Card
                key={standing.Driver.driverId}
                className="official-season-row"
                hoverable
                style={{ animationDelay: `${index * 0.035}s`, borderLeftColor: teamColor }}
              >
                <div className="official-rank">P{standing.position}</div>
                <div className="official-identity">
                  <button
                    type="button"
                    className="official-name-button"
                    onClick={() => navigate(`/drivers/${standing.Driver.driverId}`)}
                  >
                    {standing.Driver.givenName} {standing.Driver.familyName}
                  </button>
                  <div className="official-subline">
                    <span className="official-code">{standing.Driver.code || standing.Driver.nationality}</span>
                    <span>{TEXT.gap}: {formatGap(standing.points, maxDriverPoints)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="official-team-link"
                  disabled={!constructor}
                  onClick={() => constructor && navigate(`/constructors/${constructor.constructorId}`)}
                >
                  <span className="official-team-swatch" style={{ backgroundColor: teamColor }} />
                  <span>{constructor?.name || '-'}</span>
                </button>
                <div className="official-points-cell">
                  <div className="official-points-value" style={{ color: darkTeamColor }}>
                    {standing.points}
                  </div>
                  <div className="official-points-label">{TEXT.points}</div>
                </div>
              </Card>
            );
          })}
        </div>
      ),
    },
    {
      key: 'constructors',
      label: TEXT.constructors,
      children: (
        <div className="official-season-table">
          <div className="official-season-head">
            <span>{TEXT.position}</span>
            <span>{TEXT.team}</span>
            <span>{TEXT.nationality}</span>
            <span>{TEXT.points}</span>
          </div>
          {resources.constructors.loading && constructorStandings.length === 0 ? (
            <div className="season-table-skeleton" role="status" aria-label={TEXT.loading}>
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="season-skeleton-row" />)}
            </div>
          ) : resources.constructors.error && constructorStandings.length === 0 ? (
            <div className="season-resource-error" role="alert">
              <span>{TEXT.unavailable}</span>
              <button type="button" onClick={resources.constructors.refetch}>{TEXT.retry}</button>
            </div>
          ) : null}
          {constructorStandings.map((standing, index) => {
            const teamColor = getTeamColor(standing.Constructor.constructorId);
            const darkTeamColor = getTeamDarkColor(standing.Constructor.constructorId);

            return (
              <Card
                key={standing.Constructor.constructorId}
                className="official-season-row"
                hoverable
                style={{ animationDelay: `${index * 0.035}s`, borderLeftColor: teamColor }}
                onClick={() => navigate(`/constructors/${standing.Constructor.constructorId}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/constructors/${standing.Constructor.constructorId}`);
                  }
                }}
              >
                <div className="official-rank">P{standing.position}</div>
                <div className="official-identity">
                  <div className="official-team-title">
                    <span className="official-team-swatch" style={{ backgroundColor: teamColor }} />
                    <span>{standing.Constructor.name}</span>
                  </div>
                  <div className="official-subline">{TEXT.gap}: {formatGap(standing.points, maxConstructorPoints)}</div>
                </div>
                <div className="official-nationality">{standing.Constructor.nationality}</div>
                <div className="official-points-cell">
                  <div className="official-points-value" style={{ color: darkTeamColor }}>
                    {standing.points}
                  </div>
                  <div className="official-points-label">{TEXT.points}</div>
                </div>
              </Card>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="list-page-container season-standings-page">
      <DocumentHead title="季节列表 — F1 Dashboard" description="F1赛季积分榜，查看车手和车队排名" />
      <ProductMasthead
        index="01"
        eyebrow={`${currentSeason} / CHAMPIONSHIP`}
        title={<>{currentSeason}<br />STANDINGS</>}
      />

      <section className="championship-facts" aria-label="冠军形势">
        <div>
          <span>赛季进度</span>
          <strong>{seasonSummary.completedRounds}/{seasonSummary.totalRounds || '--'}</strong>
          <small>{seasonSummary.remainingRounds} 站未完成</small>
        </div>
        <div>
          <span>车手榜</span>
          <strong>{seasonSummary.driverLeader ? `${seasonSummary.driverLeader.Driver.givenName[0]}. ${seasonSummary.driverLeader.Driver.familyName}` : '--'}</strong>
          <small>{seasonSummary.driverLeader ? `${seasonSummary.driverLeader.points} PTS · ${seasonSummary.driverLeader.wins} 胜${seasonSummary.driverGap === null ? '' : ` · +${seasonSummary.driverGap}`}` : '--'}</small>
        </div>
        <div>
          <span>车队榜</span>
          <strong>{seasonSummary.constructorLeader?.Constructor.name || '--'}</strong>
          <small>{seasonSummary.constructorLeader ? `${seasonSummary.constructorLeader.points} PTS · ${seasonSummary.constructorLeader.wins} 胜${seasonSummary.constructorGap === null ? '' : ` · +${seasonSummary.constructorGap}`}` : '--'}</small>
        </div>
        <div>
          <span>参赛规模</span>
          <strong>{driverStandings.length} / {constructorStandings.length}</strong>
          <small>{driverStandings.length} 位车手 · {constructorStandings.length} 支车队</small>
        </div>
        {updatedAt ? <time>更新于 {formatLocalDateTime(updatedAt)}</time> : null}
      </section>

      {(isStale || (error && (driverStandings.length > 0 || constructorStandings.length > 0))) ? (
        <div className="season-data-notice" role="status">
          <span>{TEXT.stale}</span>
          <button type="button" onClick={refetch}>{TEXT.retry}</button>
        </div>
      ) : null}

      {loading ? (
        <div className="season-table-skeleton" role="status" aria-label={TEXT.loading}>
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="season-skeleton-row" />)}
        </div>
      ) : driverStandings.length === 0 && constructorStandings.length === 0 ? (
        <div className="season-empty-state" role="alert">
          <p>{TEXT.unavailable}</p>
          <button type="button" onClick={refetch}>{TEXT.retry}</button>
        </div>
      ) : (
        <Tabs defaultActiveKey="drivers" items={tabItems} className="official-season-tabs" />
      )}
    </div>
  );
};

export default Seasons;
