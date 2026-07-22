import { Button, Card, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FiaRaceUpgradeSummary, FiaRaceUpgradeTeamSummary } from '@/api/fiaCarUpgrades';
import { UPGRADE_REASON_LABELS } from '@/pages/Race/shared/constants';
import ViewportTable from '@/pages/Race/shared/components/ViewportTable';

interface RaceUpgradeSummaryPanelProps {
  summary: FiaRaceUpgradeSummary | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function RaceUpgradeSummaryPanel({ summary, loading, error, onRetry }: RaceUpgradeSummaryPanelProps) {
  const { t } = useTranslation();
  const metrics = useMemo(() => [
    { label: t('upgradeTotal'), value: String(summary?.totalDeclaredUpgradeCount || 0), detail: summary?.grandPrix || '-' },
    { label: t('upgradeIntensity'), value: String(summary?.totalDeclaredUpgradeIntensity || 0), detail: summary?.source || '-' },
    { label: t('upgradeTeams'), value: String(summary?.teams.length || 0), detail: summary?.sourceDocuments[0]?.title || '-' },
  ], [summary, t]);
  const columns = useMemo<ColumnsType<FiaRaceUpgradeTeamSummary>>(() => [
    {
      title: t('constructor'), dataIndex: 'team', key: 'team', fixed: 'left', width: 150,
      render: (team: string) => <strong className="upgrade-team-name">{team}</strong>,
    },
    {
      title: t('upgradeTotal'), dataIndex: 'declaredUpgradeCount', key: 'declaredUpgradeCount', width: 96,
      sorter: (a, b) => a.declaredUpgradeCount - b.declaredUpgradeCount,
    },
    {
      title: t('upgradeIntensity'), dataIndex: 'declaredUpgradeIntensity', key: 'declaredUpgradeIntensity', width: 96,
      sorter: (a, b) => a.declaredUpgradeIntensity - b.declaredUpgradeIntensity,
      render: (value: number, record) => (
        <span className={`upgrade-intensity-pill upgrade-intensity-${record.maxComponentImportance >= 4 ? 'high' : 'normal'}`}>
          {value}
        </span>
      ),
    },
    {
      title: t('upgradeIntent'), key: 'dominantReason', width: 120,
      render: (_: unknown, record) => (
        <Tag color={record.dominantReason === 'Performance' ? 'red' : 'blue'}>
          {UPGRADE_REASON_LABELS[record.dominantReason]}
        </Tag>
      ),
    },
    {
      title: t('upgradeComponents'), key: 'componentNames',
      render: (_: unknown, record) => (
        <div className="upgrade-component-tags">
          {record.componentNames.length
            ? record.componentNames.map((component) => <span key={`${record.team}-${component}`}>{component}</span>)
            : '-'}
        </div>
      ),
    },
    {
      title: t('upgradeSource'), key: 'source', width: 120,
      render: (_: unknown, record) => record.documentUrl ? (
        <a href={record.documentUrl} target="_blank" rel="noreferrer">FIA</a>
      ) : 'FIA',
    },
  ], [t]);

  return (
    <section className="race-info-section" aria-labelledby="race-upgrades-heading">
      <div className="race-info-section-heading">
        <span id="race-upgrades-heading">{t('carUpgrades')}</span>
        <small>{t('carUpgradesDescription')}</small>
      </div>
      <Card className="race-weekend-card upgrade-summary-card" loading={loading}>
        <div className="race-weekend-metric-grid upgrade-metric-grid">
          {metrics.map((item) => (
            <span key={item.label} className="race-weekend-metric">
              <small>{item.label}</small><strong>{item.value}</strong><em>{item.detail}</em>
            </span>
          ))}
        </div>
        {summary?.teams.length ? (
          <>
            <ViewportTable
              className="upgrade-summary-table"
              columns={columns}
              dataSource={summary.teams}
              rowKey={(record) => record.team}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
            {summary.sourceDocuments.length ? (
              <div className="upgrade-source-list" style={{ marginTop: 12 }}>
                {summary.sourceDocuments.slice(0, 2).map((document) => document.url ? (
                  <a key={`${document.title}-${document.url}`} href={document.url} target="_blank" rel="noreferrer">
                    {document.title}
                  </a>
                ) : <span key={document.title}>{document.title}</span>)}
              </div>
            ) : null}
          </>
        ) : error ? (
          <div className="race-weekend-empty" role="alert">
            <span>{t('carUpgradesLoadFailed')}: {error.message}</span>
            <Button onClick={onRetry}>重试升级数据</Button>
          </div>
        ) : (
          <div className="race-weekend-empty">{t('noCarUpgrades')}</div>
        )}
      </Card>
    </section>
  );
}
