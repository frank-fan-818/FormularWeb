import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { Card, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRaceData } from './RaceContext';
import {
  LIGHT_TAG_COLORS,
  DRIVER_COLORS,
} from '@/pages/Race/shared/constants';
import { buildRankingBarOption } from '@/pages/Race/shared/charts/rankingBar';
import { type RankingChartRow, formatSessionSeconds } from '@/pages/Race/shared/charts/helpers';
import {
  buildFastF1QualifyingRows,
  buildDriverLookup,
  buildConstructorLookup,
} from '@/pages/Race/shared/sessionData';
import { RacePageIntro } from '@/pages/Race/shared/components/RacePageIntro';
import { OfficialClassificationTable } from '@/pages/Race/shared/components/OfficialClassificationTable';
import {
  formatSignedSeconds,
  getGapToneClassName,
} from '@/utils/raceDetailFormatters';
import { getTeamColor, normalizeConstructorId } from '@/utils/teamColors';
import type {
  FastF1QualifyingBestLap,
  FastF1TeamMateComparison,
  QualifyingResult,
} from '@/types';
import { ChartLoadingBeacon } from '@/components/loading/TimingBeacon';
import {
  getSessionDataPhase,
  getSessionUnavailableCopy,
} from '@/utils/race/sessionDataAvailability';

const LazyEChartsPanel = lazy(() => import('@/components/charts/EChartsPanel'));

// ---- Local Types ----

interface SectorTimeRow {
  key: string;
  driver: string;
  team: string;
  position: number;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  lapTime: number;
  gap: number;
  isDeleted: boolean;
}

interface TeamMateRow {
  key: string;
  team: string;
  driverA: string;
  driverB: string;
  fastestLapDelta: number | null;
  s1Delta: number | null;
  s2Delta: number | null;
  s3Delta: number | null;
}

// ---- Local Helpers ----

function buildSectorTimeRows(bestLaps: FastF1QualifyingBestLap[]): SectorTimeRow[] {
  if (!bestLaps.length) {
    return [];
  }

  const sorted = [...bestLaps]
    .filter((lap) => Number.isFinite(lap.lapTimeSeconds))
    .sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds);

  if (!sorted.length) {
    return [];
  }

  const bestTime = sorted[0].lapTimeSeconds;

  return sorted.map((lap) => ({
    key: lap.driver,
    driver: lap.driver,
    team: lap.team,
    position: lap.position,
    s1: lap.sector1Seconds,
    s2: lap.sector2Seconds,
    s3: lap.sector3Seconds,
    lapTime: lap.lapTimeSeconds,
    gap: lap.lapTimeSeconds - bestTime,
    isDeleted: lap.isDeleted,
  }));
}

function buildPaceChartOption(
  bestLaps: FastF1QualifyingBestLap[],
  t: (key: string) => string,
): Record<string, unknown> | null {
  const sorted = [...bestLaps]
    .filter((lap) => Number.isFinite(lap.lapTimeSeconds))
    .sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds);

  if (!sorted.length) {
    return null;
  }

  const rows: RankingChartRow[] = sorted.map((lap, index) => ({
    label: lap.driver,
    value: lap.lapTimeSeconds,
    displayValue: formatSessionSeconds(lap.lapTimeSeconds),
    color: DRIVER_COLORS[index % DRIVER_COLORS.length],
  }));

  return buildRankingBarOption(
    t('lapPace'),
    t('time'),
    rows,
    formatSessionSeconds,
  );
}

function buildTeamMateRows(
  comparisons: FastF1TeamMateComparison[] | undefined,
): TeamMateRow[] {
  if (!comparisons || !comparisons.length) {
    return [];
  }

  return comparisons.map((comp) => ({
    key: comp.team,
    team: comp.team,
    driverA: comp.driverA,
    driverB: comp.driverB,
    fastestLapDelta: comp.fastestLapDeltaSeconds,
    s1Delta: comp.sector1DeltaSeconds,
    s2Delta: comp.sector2DeltaSeconds,
    s3Delta: comp.sector3DeltaSeconds,
  }));
}

function getSectorColumns(t: (key: string) => string): ColumnsType<SectorTimeRow> {
  return [
    {
      title: t('rank'),
      key: 'position',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('driver'),
      key: 'driver',
      width: 60,
      render: (_: unknown, record: SectorTimeRow) => (
        <span style={{ fontWeight: 700 }}>{record.driver}</span>
      ),
    },
    {
      title: t('sector1'),
      key: 's1',
      width: 80,
      render: (_: unknown, record: SectorTimeRow) => formatSessionSeconds(record.s1),
    },
    {
      title: t('sector2'),
      key: 's2',
      width: 80,
      render: (_: unknown, record: SectorTimeRow) => formatSessionSeconds(record.s2),
    },
    {
      title: t('sector3'),
      key: 's3',
      width: 80,
      render: (_: unknown, record: SectorTimeRow) => formatSessionSeconds(record.s3),
    },
    {
      title: t('time'),
      key: 'lapTime',
      width: 100,
      render: (_: unknown, record: SectorTimeRow) => (
        <span className={record.isDeleted ? 'fastf1-deleted-lap' : undefined}>
          {formatSessionSeconds(record.lapTime)}
          {record.isDeleted ? ' *' : ''}
        </span>
      ),
    },
    {
      title: t('delta'),
      key: 'gap',
      width: 90,
      render: (_: unknown, record: SectorTimeRow) => (
        <span className={getGapToneClassName(record.gap)}>
          {record.gap === 0 ? '-' : formatSignedSeconds(record.gap)}
        </span>
      ),
      sorter: (a: SectorTimeRow, b: SectorTimeRow) => a.gap - b.gap,
      defaultSortOrder: 'ascend' as const,
    },
  ];
}

function getTeamMateColumns(t: (key: string) => string): ColumnsType<TeamMateRow> {
  return [
    {
      title: t('constructor'),
      key: 'team',
      width: 120,
      render: (_: unknown, record: TeamMateRow) => {
        const color = getTeamColor(normalizeConstructorId(record.team));
        return (
          <span
            style={{
              display: 'inline-block',
              backgroundColor: color,
              color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
              fontWeight: 700,
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 3,
            }}
          >
            {record.team}
          </span>
        );
      },
    },
    {
      title: t('driver'),
      key: 'drivers',
      width: 120,
      render: (_: unknown, record: TeamMateRow) => (
        <span>
          {record.driverA} vs {record.driverB}
        </span>
      ),
    },
    {
      title: t('fastestLap'),
      key: 'fastestLapDelta',
      width: 100,
      render: (_: unknown, record: TeamMateRow) => (
        <span className={getGapToneClassName(record.fastestLapDelta)}>
          {record.fastestLapDelta === null ? '-' : formatSignedSeconds(record.fastestLapDelta)}
        </span>
      ),
    },
    {
      title: t('sector1'),
      key: 's1Delta',
      width: 80,
      render: (_: unknown, record: TeamMateRow) => (
        <span className={getGapToneClassName(record.s1Delta)}>
          {record.s1Delta === null ? '-' : formatSignedSeconds(record.s1Delta)}
        </span>
      ),
    },
    {
      title: t('sector2'),
      key: 's2Delta',
      width: 80,
      render: (_: unknown, record: TeamMateRow) => (
        <span className={getGapToneClassName(record.s2Delta)}>
          {record.s2Delta === null ? '-' : formatSignedSeconds(record.s2Delta)}
        </span>
      ),
    },
    {
      title: t('sector3'),
      key: 's3Delta',
      width: 80,
      render: (_: unknown, record: TeamMateRow) => (
        <span className={getGapToneClassName(record.s3Delta)}>
          {record.s3Delta === null ? '-' : formatSignedSeconds(record.s3Delta)}
        </span>
      ),
    },
  ];
}

// ---- Main Component ----

const RaceQualifying = () => {
  const { t } = useTranslation();
  const {
    season,
    round,
    fastF1QualifyingAnalytics,
    fastF1SprintQualifyingAnalytics,
    fastF1SprintShootoutAnalytics,
    qualifyingResults,
    sprintQualifyingResults,
    raceInfo,
    primaryLoading,
  } = useRaceData();

  // ---- Qualifying (Q) data ----


  const qBestLaps = useMemo(
    () => fastF1QualifyingAnalytics?.qualifyingAnalysis?.bestLaps || [],
    [fastF1QualifyingAnalytics],
  );

  const qSectorRows = useMemo(
    () => buildSectorTimeRows(qBestLaps),
    [qBestLaps],
  );

  const qPaceOption = useMemo(
    () => buildPaceChartOption(qBestLaps, t),
    [qBestLaps, t],
  );

  const qTeamMateRows = useMemo(
    () => buildTeamMateRows(fastF1QualifyingAnalytics?.qualifyingAnalysis?.teamMateComparisons),
    [fastF1QualifyingAnalytics],
  );

  // ---- Sprint Qualifying (SQ) data ----

  const activeSprintQualifyingAnalytics = useMemo(() => {
    if (season === '2023') {
      return fastF1SprintShootoutAnalytics || fastF1SprintQualifyingAnalytics;
    }
    return fastF1SprintQualifyingAnalytics || fastF1SprintShootoutAnalytics;
  }, [season, fastF1SprintQualifyingAnalytics, fastF1SprintShootoutAnalytics]);

  const sqDriverByCode = useMemo(
    () => buildDriverLookup(sprintQualifyingResults),
    [sprintQualifyingResults],
  );

  const sqConstructorByName = useMemo(
    () => buildConstructorLookup(sprintQualifyingResults),
    [sprintQualifyingResults],
  );

  const fastF1SprintQualifyingRows = useMemo(
    () => buildFastF1QualifyingRows(
      activeSprintQualifyingAnalytics,
      sqDriverByCode,
      sqConstructorByName,
    ),
    [activeSprintQualifyingAnalytics, sqDriverByCode, sqConstructorByName],
  );

  const sprintQualifyingTableData = useMemo(
    () => (fastF1SprintQualifyingRows.length > 0
      ? fastF1SprintQualifyingRows
      : sprintQualifyingResults),
    [fastF1SprintQualifyingRows, sprintQualifyingResults],
  );


  const sqBestLaps = useMemo(
    () => activeSprintQualifyingAnalytics?.qualifyingAnalysis?.bestLaps || [],
    [activeSprintQualifyingAnalytics],
  );

  const sqSectorRows = useMemo(
    () => buildSectorTimeRows(sqBestLaps),
    [sqBestLaps],
  );

  const sqPaceOption = useMemo(
    () => buildPaceChartOption(sqBestLaps, t),
    [sqBestLaps, t],
  );

  const sqTeamMateRows = useMemo(
    () => buildTeamMateRows(activeSprintQualifyingAnalytics?.qualifyingAnalysis?.teamMateComparisons),
    [activeSprintQualifyingAnalytics],
  );

  // ---- Sprint weekend check ----

  const hasSprintQualifying = Boolean(raceInfo?.SprintQualifying)
    || sprintQualifyingTableData.length > 0
    || sqBestLaps.length > 0;

  // ---- Table columns ----

  const sectorColumns = useMemo(
    () => getSectorColumns(t),
    [t],
  );

  const teamMateColumns = useMemo(
    () => getTeamMateColumns(t),
    [t],
  );

  // ---- Render helpers ----

  const renderQualifyingSection = (
    officialResults: QualifyingResult[],
    officialTitle: string,
    officialAriaLabel: string,
    sectorRows: SectorTimeRow[],
    paceOption: Record<string, unknown> | null,
    teamMateRows: TeamMateRow[],
  ) => (
    <div className="fastf1-analysis-stack">
      <OfficialClassificationTable
        ariaLabel={officialAriaLabel}
        title={officialTitle}
        variant="qualifying"
        results={officialResults}
      />

      {/* Sector Times Comparison */}
      {sectorRows.length > 0 ? (
        <Card
          className="race-weekend-post-card"
          title={(
            <h3 style={{ margin: 0 }}>
              {t('sector1')}/{t('sector2')}/{t('sector3')} {t('time')}
            </h3>
          )}
        >
          <Table
            columns={sectorColumns}
            dataSource={sectorRows}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </Card>
      ) : null}

      {/* Qualifying Pace Ranking */}
      {paceOption ? (
        <Card
          className="fastf1-chart-card"
          title={
            <div className="fastf1-chart-header">
              <div>
                <h3 className="fastf1-chart-title">{t('lapPace')}</h3>
              </div>
            </div>
          }
        >
          <Suspense fallback={<ChartLoadingBeacon label="Rendering qualifying order" />}>
            <LazyEChartsPanel
              chartKey={`qualifying-pace-${season}-${round}`}
              height={420}
              option={paceOption}
              ariaLabel="车手排位赛最快圈成绩与差距排名图。"
            />
          </Suspense>
        </Card>
      ) : null}

      {/* Team Mate Comparison */}
      {teamMateRows.length > 0 ? (
        <Card
          className="race-weekend-post-card"
          title={<h3 style={{ margin: 0 }}>{t('teamMateDelta')}</h3>}
        >
          <Table
            columns={teamMateColumns}
            dataSource={teamMateRows}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </Card>
      ) : null}
    </div>
  );

  // ---- Early return (no data) ----

  if (!primaryLoading && !qualifyingResults.length && !fastF1QualifyingAnalytics?.qualifyingAnalysis) {
    const unavailableCopy = getSessionUnavailableCopy({
      label: '排位赛',
      phase: getSessionDataPhase(raceInfo?.Qualifying),
    });
    return (
      <div className="fastf1-analytics-section">
        <RacePageIntro
          index="02"
          eyebrow="QUALIFYING DECONSTRUCTED / 排位解构"
          title={unavailableCopy.title}
          description={unavailableCopy.description}
        />
        <Card className="race-empty-command-card">
          <p>{unavailableCopy.description}</p>
        </Card>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="fastf1-analytics-section">
      <RacePageIntro
        index="02"
        eyebrow="QUALIFYING DECONSTRUCTED / 排位解构"
        title="排位赛分析"
        aside={(
          <div className="race-page-pulse">
            <span><strong>{qSectorRows.length}</strong> 有效圈</span>
            <span><strong>{qTeamMateRows.length}</strong> 组队友</span>
            <span><strong>{hasSprintQualifying ? 2 : 1}</strong> 排位场次</span>
          </div>
        )}
      />

      <Tabs
        className="race-analysis-tabs"
        items={[
          {
            key: 'qualifying',
            label: t('qualifying'),
            children: renderQualifyingSection(
              qualifyingResults,
              '官方排位成绩',
              'Official qualifying classification',
              qSectorRows,
              qPaceOption,
              qTeamMateRows,
            ),
          },
          ...(hasSprintQualifying
            ? [
                {
                  key: 'sprintQualifying',
                  label: t('sprintQualifying'),
                  children: renderQualifyingSection(
                    sprintQualifyingTableData,
                    '官方冲刺排位成绩',
                    'Official sprint qualifying classification',
                    sqSectorRows,
                    sqPaceOption,
                    sqTeamMateRows,
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
};

export default RaceQualifying;
