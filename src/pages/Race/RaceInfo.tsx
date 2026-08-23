import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { useRaceData } from './RaceContext';
import { isFeatureEnabled } from '@/utils/featureFlags';
import { getCircuitEnhancement } from '@/utils/circuitEnhancements';
import { getRaceWeekendSchedule, getRaceWeekendScheduleGroups } from '@/utils/raceSchedule';
import { TEXT } from '@/pages/Race/shared/constants';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { RaceWeekendOverview } from '@/pages/Race/shared/components/RaceWeekendOverview';
import { RaceWeatherOverview } from '@/pages/Race/shared/components/RaceWeatherOverview';
import { RaceHistoricalContextPanel } from '@/pages/Race/shared/components/RaceHistoricalContextPanel';
import { RaceUpgradeSummaryPanel } from '@/pages/Race/shared/components/RaceUpgradeSummaryPanel';

const RaceInfo = () => {
  const { t } = useTranslation();
  const {
    raceInfo,
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
    availableDbSessions,
  } = useRaceData();
  const weekendSchedule = getRaceWeekendSchedule(raceInfo, TEXT);
  const scheduleGroups = getRaceWeekendScheduleGroups(weekendSchedule);
  const circuitEnhancement = useMemo(
    () => (raceInfo ? getCircuitEnhancement(raceInfo.Circuit.circuitId) : {}),
    [raceInfo],
  );
  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || availableDbSessions.includes('SQ')
    || availableDbSessions.includes('SS');
  const hasSprint = sprintResults.length > 0
    || Boolean(raceInfo?.Sprint)
    || availableDbSessions.includes('S');
  const isSprintWeekend = hasSprint || hasSprintQualifying;

  if (!raceInfo) {
    return <div className="race-weekend-empty">{t('notFound')}</div>;
  }

  return (
    <div className="race-info-page">
      <RacePageIntro
        index="05"
        eyebrow="WEEKEND INTELLIGENCE / 周末情报"
        title="在赛车驶上赛道之前，先读懂这条赛道"
        description="把赛程、赛道画像、实际天气、历史中断风险与车队升级放在同一份周末情报中，建立理解比赛所需的上下文。"
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
