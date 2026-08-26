import { useNavigate } from 'react-router-dom';
import type { Race } from '@/types';
import { formatSessionDateTime, getRaceWeekendTimeline } from '@/utils/raceSchedule';
import './RaceWeekendSignal.css';

interface RaceWeekendSignalProps {
  race: Race;
  ongoing: boolean;
}

const LABELS = {
  fp1: '\u4e00\u7ec3', fp2: '\u4e8c\u7ec3', fp3: '\u4e09\u7ec3', qualifying: '\u6392\u4f4d\u8d5b',
  sprintQualifying: '\u51b2\u523a\u6392\u4f4d', sprint: '\u51b2\u523a\u8d5b', race: '\u6b63\u8d5b',
};

export function RaceWeekendSignal({ race, ongoing }: RaceWeekendSignalProps) {
  const navigate = useNavigate();
  const timeline = getRaceWeekendTimeline(race, LABELS);
  const session = timeline.find((item) => item.isNext) ?? timeline[timeline.length - 1];
  const path = `/races/${race.round}/info?season=${encodeURIComponent(race.season)}`;
  const preload = () => void import('@/utils/routePreload')
    .then((module) => module.preloadRoute(path));

  return (
    <button
      type="button"
      className={`race-weekend-signal ${ongoing ? 'is-live' : ''}`}
      onClick={() => navigate(path)}
      onPointerEnter={preload}
      onFocus={preload}
    >
      <span className="race-weekend-signal__state"><i />{ongoing ? '\u5f53\u524d\u8d5b\u5468' : '\u4e0b\u4e00\u7ad9'}</span>
      <strong>{race.raceName}</strong>
      <span className="race-weekend-signal__session">
        {session ? `${session.label} · ${formatSessionDateTime(session.session)}` : race.Circuit.circuitName}
      </span>
      <span className="race-weekend-signal__action">查看赛事 →</span>
    </button>
  );
}
