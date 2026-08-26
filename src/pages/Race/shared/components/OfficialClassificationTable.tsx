import { useMemo } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from '@/i18n';
import type { QualifyingResult, Result } from '@/types';
import { SessionDriverCell } from '@/pages/Race/shared/components/SessionDriverCell';

interface OfficialClassificationTableProps {
  ariaLabel: string;
  title: string;
  variant: 'qualifying' | 'race';
  results: QualifyingResult[] | Result[];
}

export function OfficialClassificationTable({
  ariaLabel,
  title,
  variant,
  results,
}: OfficialClassificationTableProps) {
  const { t } = useTranslation();
  const columns = useMemo<ColumnsType<QualifyingResult | Result>>(() => {
    const shared: ColumnsType<QualifyingResult | Result> = [
      { title: t('rank'), dataIndex: 'position', key: 'position', width: 64 },
      {
        title: t('driver'),
        key: 'driver',
        render: (_value: unknown, record: QualifyingResult | Result) => (
          <SessionDriverCell driver={record.Driver} constructor={record.Constructor} />
        ),
      },
    ];

    if (variant === 'qualifying') {
      return [
        ...shared,
        { title: 'Q1', dataIndex: 'Q1', key: 'Q1', width: 100 },
        { title: 'Q2', dataIndex: 'Q2', key: 'Q2', width: 100 },
        { title: 'Q3', dataIndex: 'Q3', key: 'Q3', width: 100 },
      ];
    }

    return [
      ...shared,
      { title: t('grid'), dataIndex: 'grid', key: 'grid', width: 72 },
      { title: t('laps'), dataIndex: 'laps', key: 'laps', width: 72 },
      {
        title: t('result'),
        key: 'result',
        render: (_value: unknown, record: QualifyingResult | Result) => (
          'status' in record ? record.Time?.time || record.status : '-'
        ),
      },
      { title: t('points'), dataIndex: 'points', key: 'points', width: 72 },
    ];
  }, [t, variant]);

  if (!results.length) return null;

  return (
    <section className="race-classification-shell" aria-label={ariaLabel}>
      <div className="race-classification-heading">
        <div>
          <span className="analysis-module-kicker">OFFICIAL CLASSIFICATION</span>
          <h2>{title}</h2>
        </div>
        <p>官方分类始终保留；FastF1 仅用于补充圈速、轮胎与遥测分析。</p>
      </div>
      <div className="race-classification-table">
        <Table<QualifyingResult | Result>
          columns={columns}
          dataSource={results}
          pagination={false}
          rowKey={(record) => record.Driver.driverId}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </div>
    </section>
  );
}
