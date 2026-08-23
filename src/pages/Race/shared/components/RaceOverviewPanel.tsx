import { ArrowDownOutlined, ArrowUpOutlined, FieldTimeOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConstructorLogo } from '@/utils/constructorLogos';
import { DriverAvatar } from '@/utils/driverImages';
import { getTeamColor } from '@/utils/teamColors';
import type { RaceOverviewInsights } from '@/utils/raceOverviewInsights';

interface RaceOverviewPanelProps {
  insights: RaceOverviewInsights;
}

function getDriverName(result: RaceOverviewInsights['winner']) {
  if (!result) return '-';
  return `${result.Driver.givenName} ${result.Driver.familyName}`;
}

export function RaceOverviewPanel({ insights }: RaceOverviewPanelProps) {
  const navigate = useNavigate();
  const podium = [insights.podium[1], insights.podium[0], insights.podium[2]].filter(Boolean);

  if (!insights.winner) {
    return (
      <section className="race-overview-awaiting" aria-live="polite">
        <span>RACE DEBRIEF</span>
        <h2>正赛结果尚未发布</h2>
        <p>当前可查看已发布的练习、排位和冲刺赛成绩。</p>
      </section>
    );
  }

  const storyItems = [
    insights.biggestGain ? {
      key: 'gain',
      icon: <ArrowUpOutlined />,
      label: '最大跃升',
      value: `+${insights.biggestGain.places}`,
      driver: insights.biggestGain.result.Driver.code,
      detail: `${insights.biggestGain.result.grid} → ${insights.biggestGain.result.position}`,
      tone: 'positive',
    } : null,
    insights.fastestLap ? {
      key: 'fastest',
      icon: <ThunderboltOutlined />,
      label: '最快圈',
      value: insights.fastestLap.time,
      driver: insights.fastestLap.result.Driver.code,
      detail: `L${insights.fastestLap.lap}`,
      tone: 'fastest',
    } : null,
    insights.biggestLoss ? {
      key: 'loss',
      icon: <ArrowDownOutlined />,
      label: '最大回落',
      value: `-${insights.biggestLoss.places}`,
      driver: insights.biggestLoss.result.Driver.code,
      detail: `${insights.biggestLoss.result.grid} → ${insights.biggestLoss.result.position}`,
      tone: 'negative',
    } : null,
    {
      key: 'retirements',
      icon: <FieldTimeOutlined />,
      label: '未完赛车手',
      value: String(insights.retirements.length),
      driver: insights.retirements.length ? insights.retirements.map((item) => item.Driver.code).slice(0, 3).join(' · ') : '全员完赛',
      detail: insights.interruptionCount ? `${insights.interruptionCount} 段赛道状态` : '无中断记录',
      tone: 'neutral',
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: ReactNode;
    label: string;
    value: string;
    driver: string;
    detail: string;
    tone: string;
  }>;

  return (
    <section className="race-overview-debrief">
      <div className="race-debrief-heading">
        <div>
          <span>RACE DEBRIEF / 赛后速览</span>
          <h2>比赛摘要</h2>
        </div>
        <p>
          {getDriverName(insights.winner)} 赢得比赛
          {insights.pole ? `，杆位属于 ${insights.pole.Driver.code}` : ''}
          {insights.totalLaps ? `，全程 ${insights.totalLaps} 圈` : ''}。
        </p>
      </div>

      <div className="race-podium" aria-label="比赛领奖台">
        {podium.map((result) => {
          const position = Number(result.position);
          const teamColor = getTeamColor(result.Constructor.constructorId);
          return (
            <button
              type="button"
              key={result.Driver.driverId}
              className={`race-podium-driver position-${position}`}
              style={{ '--team-accent': teamColor } as CSSProperties}
              onClick={() => navigate(`/drivers/${result.Driver.driverId}`)}
            >
              <span className="race-podium-position">P{position}</span>
              <DriverAvatar
                className="race-podium-avatar"
                driverId={result.Driver.driverId}
                size={position === 1 ? 88 : 72}
                givenName={result.Driver.givenName}
                familyName={result.Driver.familyName}
              />
              <span className="race-podium-code">{result.Driver.code}</span>
              <strong>{result.Driver.familyName}</strong>
              <span className="race-podium-team">
                <ConstructorLogo constructorId={result.Constructor.constructorId} size={20} />
                {result.Constructor.name}
              </span>
              <em>{result.Time?.time || result.status}</em>
            </button>
          );
        })}
      </div>

      <div className="race-story-grid">
        {storyItems.map((item) => (
          <article key={item.key} className={`race-story-card tone-${item.tone}`}>
            <span className="race-story-icon">{item.icon}</span>
            <span className="race-story-label">{item.label}</span>
            <strong>{item.value}</strong>
            <span className="race-story-driver">{item.driver}</span>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
