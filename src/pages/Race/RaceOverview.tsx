import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Result } from '@/types';
import { getTeamColor } from '@/utils/teamColors';
import { formatNumber, formatPercent } from '@/utils/raceDetailFormatters';
import { LIGHT_TAG_COLORS, TRACK_STATUS_STYLES } from '@/pages/RaceDetail/constants';
import { buildFastF1Summary } from '@/pages/RaceDetail/sessionData';
import { useRaceData } from './RaceContext';
import '../RaceDetail.css';

function formatStatRange(summary?: { min: number | null; max: number | null }) {
  if (!summary || summary.min === null || summary.max === null) {
    return '-';
  }

  return `${formatNumber(summary.min, 1)}-${formatNumber(summary.max, 1)} C`;
}

const RaceOverview = () => {
  const { t } = useTranslation();
  const {
    raceResults,
    fastF1Analytics,
    primaryLoading,
  } = useRaceData();

  const fastF1Summary = useMemo(
    () => buildFastF1Summary(fastF1Analytics),
    [fastF1Analytics],
  );

  const fastestLapTime = useMemo(() => {
    let best = '';
    raceResults.forEach((result) => {
      if (result.FastestLap?.Time?.time) {
        if (!best || result.FastestLap.Time.time < best) {
          best = result.FastestLap.Time.time;
        }
      }
    });
    return best;
  }, [raceResults]);

  const raceColumns: ColumnsType<Result> = [
    { title: t('rank'), dataIndex: 'position', key: 'position', width: 60 },
    { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 60 },
    {
      title: t('driver'),
      key: 'driver',
      render: (_: unknown, record: Result) => {
        const color = getTeamColor(record.Constructor.constructorId);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: color,
                color: LIGHT_TAG_COLORS.has(color) ? '#111827' : '#fff',
                fontWeight: 700,
                fontSize: 12,
                padding: '2px 6px',
                borderRadius: 3,
                minWidth: 36,
                textAlign: 'center',
              }}
            >
              {record.Driver.code}
            </span>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{record.Constructor.name}</span>
          </div>
        );
      },
    },
    { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 60 },
    {
      title: t('result'),
      key: 'time',
      render: (_: unknown, record: Result) => record.Time?.time || record.status,
    },
    {
      title: t('fastestLap'),
      key: 'fastestLap',
      render: (_: unknown, record: Result) => {
        const time = record.FastestLap?.Time?.time;
        if (!time) {
          return '-';
        }

        return time === fastestLapTime ? (
          <span className="fastest-lap">{time} *</span>
        ) : time;
      },
    },
    {
      title: t('points'),
      dataIndex: 'points',
      key: 'points',
      width: 60,
      render: (points: string) => <span className="points">{points}</span>,
    },
  ];

  return (
    <div className="race-overview-page">
      <Card
        className="race-weekend-card data-view-card"
        title={<div className="data-view-title"><span>{t('result')}</span></div>}
      >
        <Table
          columns={raceColumns}
          dataSource={raceResults}
          rowKey={(record) => record.Driver.driverId}
          pagination={false}
          loading={primaryLoading}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {fastF1Analytics && fastF1Summary ? (
        <Card
          className="race-weekend-card"
          title={<div className="data-view-title"><span>{t('raceStatus')} &amp; FastF1</span></div>}
        >
          <div className="fastf1-summary-strip">
            <span>{fastF1Summary.driverCount} {t('drivers')}</span>
            <span>{fastF1Summary.maxLap} {t('summaryLaps')}</span>
            <span>{fastF1Summary.stints} {t('stints')}</span>
            <span>{fastF1Summary.statusCount} {t('raceStatus')}</span>
            {fastF1Summary.weatherSummary ? (
              <>
                <span>{t('trackTemp')} {formatStatRange(fastF1Summary.weatherSummary.trackTempC)}</span>
                <span>{t('airTemp')} {formatStatRange(fastF1Summary.weatherSummary.airTempC)}</span>
                <span>{t('humidity')} {formatPercent(fastF1Summary.weatherSummary.humidityPct.average)}</span>
              </>
            ) : null}
          </div>

          {fastF1Analytics.trackStatusPeriods?.length ? (
            <div className="track-status-legend" style={{ marginTop: 12 }}>
              {fastF1Analytics.trackStatusPeriods.map((period, index) => (
                <span key={`${period.type}-${period.startLap}-${index}`} style={{ marginRight: 12 }}>
                  <span
                    className="track-status-swatch"
                    style={{ backgroundColor: TRACK_STATUS_STYLES[period.type]?.color }}
                  />
                  {period.label} L{period.startLap}-L{period.endLap}
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};

export default RaceOverview;
