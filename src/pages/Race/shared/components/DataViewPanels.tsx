import { Button, Card, Segmented } from 'antd';
import { TEXT } from '../constants';

export type DataViewMode = 'chart' | 'table';

interface DataViewPanelProps {
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  mode: DataViewMode;
  collapsed: boolean;
  onModeChange: (mode: DataViewMode) => void;
  onToggleCollapse: () => void;
  chart: JSX.Element;
  table: JSX.Element;
}

function DataViewPanel({
  title,
  description,
  className = '',
  loading = false,
  mode,
  collapsed,
  onModeChange,
  onToggleCollapse,
  chart,
  table,
}: DataViewPanelProps) {
  return (
    <Card
      className={`race-weekend-card data-view-card ${className}`}
      loading={loading}
      title={(
        <div className="data-view-title">
          <span>{title}</span>
          {description ? <small>{description}</small> : null}
        </div>
      )}
      extra={(
        <div className="data-view-actions">
          <Segmented<DataViewMode>
            value={mode}
            onChange={onModeChange}
            disabled={collapsed}
            size="small"
            options={[
              { label: TEXT.chart, value: 'chart' },
              { label: TEXT.table, value: 'table' },
            ]}
          />
          <Button type="text" size="small" onClick={onToggleCollapse}>
            {collapsed ? TEXT.expand : TEXT.collapse}
          </Button>
        </div>
      )}
    >
      {collapsed ? null : mode === 'chart' ? chart : table}
    </Card>
  );
}

interface TableOnlyPanelProps {
  title: string;
  description?: string;
  className?: string;
  loading?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: JSX.Element;
}

function TableOnlyPanel({
  title,
  description,
  className = '',
  loading = false,
  collapsed,
  onToggleCollapse,
  children,
}: TableOnlyPanelProps) {
  return (
    <Card
      className={`race-weekend-card data-view-card ${className}`}
      loading={loading}
      title={(
        <div className="data-view-title">
          <span>{title}</span>
          {description ? <small>{description}</small> : null}
        </div>
      )}
      extra={(
        <Button type="text" size="small" onClick={onToggleCollapse}>
          {collapsed ? TEXT.expand : TEXT.collapse}
        </Button>
      )}
    >
      {collapsed ? null : children}
    </Card>
  );
}

export { DataViewPanel, TableOnlyPanel };
export type { DataViewPanelProps, TableOnlyPanelProps };
