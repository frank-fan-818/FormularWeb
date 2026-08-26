import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useRaceData } from './RaceContext';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { getCircuitEnhancement } from '@/utils/circuitEnhancements';
import { getRaceWeekendScheduleGroups, getRaceWeekendTimeline } from '@/utils/raceSchedule';
import { TEXT } from '@/pages/Race/shared/constants';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { RaceWeekendOverview } from '@/pages/Race/shared/components/RaceWeekendOverview';
import { RaceWeatherOverview } from '@/pages/Race/shared/components/RaceWeatherOverview';
import { RaceHistoricalContextPanel } from '@/pages/Race/shared/components/RaceHistoricalContextPanel';
import { RaceUpgradeSummaryPanel } from '@/pages/Race/shared/components/RaceUpgradeSummaryPanel';

const RaceInfo = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    raceInfo,
    seasonRaces,
    fastF1Analytics,
    fastF1AnalyticsLoading,
    fastF1AnalyticsError,
    retryFastF1Analytics,
    racePreviewSummary,
    racePreviewLoading,
    racePreviewError,
    retryRacePreview,
    raceUpgradeSummary,
    raceUpgradeLoading,
    raceUpgradeError,
    retryRaceUpgrades,
    raceResults,
    qualifyingResults,
    sprintResults,
    sprintQualifyingResults,
    fp1Results,
    fp2Results,
    fp3Results,
    availableDbSessions,
  } = useRaceData();
  const weekendSchedule = getRaceWeekendTimeline(raceInfo, TEXT);
  const scheduleGroups = getRaceWeekendScheduleGroups(weekendSchedule);
  const circuitEnhancement = useMemo(
    () => (raceInfo ? getCircuitEnhancement(raceInfo.Circuit.circuitId) : {}),
    [raceInfo],
  );
  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || Boolean(raceInfo?.isSprintWeekend)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS');
  const hasSprint = sprintResults.length > 0
    || Boolean(raceInfo?.Sprint)
    || Boolean(raceInfo?.isSprintWeekend)
    || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;
  const orderedRaces = useMemo(
    () => [...seasonRaces].sort((a, b) => Number(a.round) - Number(b.round)),
    [seasonRaces],
  );
  const currentRaceIndex = orderedRaces.findIndex((race) => race.round === raceInfo?.round);
  const previousRace = currentRaceIndex > 0 ? orderedRaces[currentRaceIndex - 1] : null;
  const nextRace = currentRaceIndex >= 0 ? orderedRaces[currentRaceIndex + 1] ?? null : null;
  const resultSessionKeys = [
    raceResults.length ? 'race' : null,
    qualifyingResults.length ? 'qualifying' : null,
    sprintResults.length ? 'sprint' : null,
    sprintQualifyingResults.length ? 'sprintQualifying' : null,
    fp1Results.length ? 'fp1' : null,
    fp2Results.length ? 'fp2' : null,
    fp3Results.length ? 'fp3' : null,
  ].filter((value): value is string => Boolean(value));

  const openRace = (round: string) => {
    navigate(`/races/${round}/info${location.search}`);
  };

  if (!raceInfo) {
    return <div className="race-weekend-empty">{t('notFound')}</div>;
  }

  return (
    <div className="race-info-page">
      <nav className="race-info-neighbor-nav" aria-label="分站导航">
        <button type="button" disabled={!previousRace} onClick={() => previousRace && openRace(previousRace.round)}>
          <span>← 上一站</span>
          <strong>{previousRace?.raceName || '--'}</strong>
        </button>
        <button type="button" className="is-calendar" onClick={() => navigate('/races')}>
          <span>{raceInfo.season}</span>
          <strong>完整赛历</strong>
        </button>
        <button type="button" disabled={!nextRace} onClick={() => nextRace && openRace(nextRace.round)}>
          <span>下一站 →</span>
          <strong>{nextRace?.raceName || '--'}</strong>
        </button>
      </nav>
      <RacePageIntro
        index="05"
        eyebrow="WEEKEND INFO"
        title="赛周日程与赛道信息"
        aside={(
          <div className="race-page-pulse">
            <span><strong>{weekendSchedule.length}</strong> 场次</span>
            <span><strong>{racePreviewSummary?.sampleSize || 0}</strong> 历史样本</span>
            <span><strong>{raceUpgradeSummary?.teams.length || 0}</strong> 升级车队</span>
            {isSprintWeekend ? <span className="is-accent"><strong>SPRINT</strong> 周末</span> : null}
          </div>
        )}
      />
      <RaceWeekendOverview
        circuitEnhancement={circuitEnhancement}
        scheduleGroups={scheduleGroups}
        isSprintWeekend={isSprintWeekend}
        resultSessionKeys={resultSessionKeys}
      />
      <RaceWeatherOverview
        summary={fastF1Analytics?.weather?.summary || null}
        loading={fastF1AnalyticsLoading}
        error={fastF1AnalyticsError}
        onRetry={retryFastF1Analytics}
      />
      <RaceHistoricalContextPanel
        summary={racePreviewSummary}
        loading={racePreviewLoading}
        error={racePreviewError}
        onRetry={retryRacePreview}
        predictionsEnabled={isFeatureEnabled('race-predictions')}
        raceResults={raceResults}
        qualifyingResults={qualifyingResults}
        sprintResults={sprintResults}
      />
      <RaceUpgradeSummaryPanel
        summary={raceUpgradeSummary}
        loading={raceUpgradeLoading}
        error={raceUpgradeError}
        onRetry={retryRaceUpgrades}
      />
    </div>
  );
};

export default RaceInfo;
