import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { CalendarOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import { useRacesByStatus, useRaceStatus, useSeasonData } from '@/hooks';
import { useAppStore } from '@/store';
import type { Race } from '@/types';
import { formatRaceDateTime } from '@/utils/raceSchedule';
import ProductMasthead from '@/components/product/ProductMasthead';
import ProductSectionHeader from '@/components/product/ProductSectionHeader';
import './Races.css';

const RaceCard = ({ race, index }: { race: Race; index: number }) => {
  const navigate = useNavigate();
  const { status, color } = useRaceStatus(race);
  const statusLabel = status === 'ongoing'
    ? '\u8d5b\u4e8b\u5468\u672b'
    : status === 'completed'
      ? '\u5df2\u5b8c\u8d5b'
      : '\u5373\u5c06\u5f00\u59cb';

  return (
    <button
      type="button"
      key={race.round}
      className={`race-calendar-row race-calendar-row--${status}`}
      style={{ animationDelay: `${index * 0.035}s`, '--race-status-color': color } as React.CSSProperties}
      onClick={() => navigate(`/races/${race.round}`)}
    >
      <span className="race-calendar-round">R{String(race.round).padStart(2, '0')}</span>
      <div className="race-calendar-copy">
        <span className="race-calendar-country">{race.Circuit.Location.country}</span>
        <h3>{race.raceName}</h3>
        <p><EnvironmentOutlined /> {race.Circuit.circuitName}</p>
      </div>
      <span className="race-calendar-date"><CalendarOutlined /> {formatRaceDateTime(race)}</span>
      <span className="race-calendar-status"><i />{statusLabel}</span>
      <span className="race-calendar-arrow" aria-hidden="true">&#8594;</span>
    </button>
  );
};

const Races = () => {
  const { currentSeason } = useAppStore();
  const { races, loading } = useSeasonData(currentSeason);
  const { ongoingRace, nextRace, completedRaces } = useRacesByStatus(races);
  const upcomingRaces = races.filter((race) => {
    const round = Number(race.round);
    return race !== ongoingRace && race !== nextRace && round > Number(nextRace?.round || 0);
  });
  const progress = Math.round((completedRaces.length / Math.max(races.length, 1)) * 100);

  return (
    <div className="list-page-container races-calendar-page">
      <Helmet>
        <title>&#x6bd4;&#x8d5b;&#x5217;&#x8868; &#8212; F1 Dashboard</title>
        <meta name="description" content="F1&#x6bd4;&#x8d5b;&#x65e5;&#x7a0b;&#x5217;&#x8868;, &#x67e5;&#x770b;&#x5404;&#x7ad9;&#x6bd4;&#x8d5b;&#x4fe1;&#x606f;" />
      </Helmet>
      <ProductMasthead
        index="02"
        eyebrow={`${currentSeason} / WORLD CHAMPIONSHIP`}
        title={<>{currentSeason}<br />RACE CALENDAR</>}
        description="按比赛状态阅读整个赛季：正在发生什么、下一站去哪里，以及每一个已经写入历史的比赛周末。"
        metrics={[
          { label: '\u8d5b\u5386', value: races.length || '--', detail: '\u5168\u5b63\u5206\u7ad9' },
          { label: '\u5df2\u5b8c\u6210', value: `${completedRaces.length}`, detail: `${progress}% \u8d5b\u5b63\u8fdb\u5ea6` },
          { label: '\u4e0b\u4e00\u7ad9', value: nextRace ? `R${nextRace.round}` : '--', detail: nextRace?.raceName || '\u5f85\u5b9a' },
          { label: '\u5f53\u524d\u72b6\u6001', value: ongoingRace ? '\u8d5b\u4e8b\u5468\u672b' : '\u8d5b\u5386\u8fdb\u884c\u4e2d', detail: ongoingRace?.raceName || `${currentSeason} SEASON`, accent: 'var(--accent-orange)' },
        ]}
      />
      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : races.length === 0 ? (
        <div className="race-calendar-empty">当前赛季暂无赛历数据。</div>
      ) : (
        <>
          {(ongoingRace || nextRace) ? (
            <section>
              <ProductSectionHeader index="01" eyebrow="NOW / NEXT" title="下一信号" description="优先呈现正在进行和即将到来的比赛周末。" />
              <div className="race-calendar-list race-calendar-list--featured">
                {ongoingRace ? <RaceCard race={ongoingRace} index={0} /> : null}
                {nextRace ? <RaceCard race={nextRace} index={1} /> : null}
              </div>
            </section>
          ) : null}
          {upcomingRaces.length > 0 ? (
            <section>
              <ProductSectionHeader index="02" eyebrow="UPCOMING" title="前方赛程" description="从下一站开始，沿赛历继续浏览本赛季余下比赛。" />
              <div className="race-calendar-list">
                {upcomingRaces.map((race, index) => <RaceCard key={race.round} race={race} index={index} />)}
              </div>
            </section>
          ) : null}
          {completedRaces.length > 0 ? (
            <section>
              <ProductSectionHeader index="03" eyebrow="ARCHIVE" title="已完成比赛" description="进入任意分站查看比赛结果、排位赛与完整分析。" />
              <div className="race-calendar-list">
                {[...completedRaces].reverse().map((race, index) => <RaceCard key={race.round} race={race} index={index} />)}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Races;
