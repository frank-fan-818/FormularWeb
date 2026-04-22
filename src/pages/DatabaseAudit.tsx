import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TabsProps } from 'antd';
import { DatabaseOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import { supabaseApi } from '@/api/supabase';

type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';
type TableKey =
  | 'circuits'
  | 'drivers'
  | 'constructors'
  | 'races'
  | 'seasons'
  | 'race_results'
  | 'qualifying_results';

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  readOnly?: boolean;
}

interface ProposedFieldConfig {
  key: string;
  label: string;
  pages: string[];
  reason: string;
}

interface TableConfig {
  key: TableKey;
  label: string;
  idField: string;
  fields: FieldConfig[];
  proposedFields: ProposedFieldConfig[];
  derivedNotes: string[];
}

const TABLE_CONFIGS: TableConfig[] = [
  {
    key: 'circuits',
    label: 'Circuits',
    idField: 'circuit_id',
    fields: [
      { key: 'circuit_id', label: 'Circuit ID', type: 'text', readOnly: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'locality', label: 'Locality', type: 'text' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'lat', label: 'Latitude', type: 'number' },
      { key: 'long', label: 'Longitude', type: 'number' },
      { key: 'length', label: 'Length (km)', type: 'number' },
      { key: 'turns', label: 'Turns', type: 'number' },
      { key: 'direction', label: 'Direction', type: 'text' },
      { key: 'first_race', label: 'First Race', type: 'number' },
      { key: 'total_races', label: 'Total Races', type: 'number' },
      { key: 'race_laps', label: 'Race Laps', type: 'number' },
      { key: 'total_distance', label: 'Total Distance', type: 'text' },
      { key: 'lap_record', label: 'Lap Record', type: 'text' },
      { key: 'lap_record_driver', label: 'Lap Record Driver', type: 'text' },
      { key: 'lap_record_year', label: 'Lap Record Year', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [],
    derivedNotes: [
      '赛道详情页展示的本赛季比赛日期和冲刺赛周末标记来自 races 表，不属于 circuits 基础表。',
    ],
  },
  {
    key: 'drivers',
    label: 'Drivers',
    idField: 'driver_id',
    fields: [
      { key: 'driver_id', label: 'Driver ID', type: 'text', readOnly: true },
      { key: 'first_name', label: 'First Name', type: 'text' },
      { key: 'last_name', label: 'Last Name', type: 'text' },
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'permanent_number', label: 'Permanent Number', type: 'text' },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'nationality', label: 'Nationality', type: 'text' },
      { key: 'total_race_entries', label: 'Total Race Entries', type: 'number' },
      { key: 'total_race_starts', label: 'Total Race Starts', type: 'number' },
      { key: 'total_wins', label: 'Total Wins', type: 'number' },
      { key: 'total_podiums', label: 'Total Podiums', type: 'number' },
      { key: 'total_pole_positions', label: 'Total Pole Positions', type: 'number' },
      { key: 'total_fastest_laps', label: 'Total Fastest Laps', type: 'number' },
      { key: 'total_championships', label: 'Total Championships', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [
      {
        key: 'total_points',
        label: 'Total Points',
        pages: ['Driver history', 'Driver detail'],
        reason: '当前页面会展示生涯总积分，但 drivers 表中没有持久化该字段。',
      },
      {
        key: 'best_race_finish_position',
        label: 'Best Race Finish Position',
        pages: ['Driver history'],
        reason: '历史页展示最佳完赛名次，目前只在派生逻辑中计算，没有落库缓存字段。',
      },
    ],
    derivedNotes: [
      'Current Team、Season Rank、Season Points、Season Wins 来自当赛季 standings，不应写入 drivers 基础表。',
      'Best finish seasons 和历史赛季时间线属于跨赛季派生数据，建议保留在聚合层。',
    ],
  },
  {
    key: 'constructors',
    label: 'Constructors',
    idField: 'constructor_id',
    fields: [
      { key: 'constructor_id', label: 'Constructor ID', type: 'text', readOnly: true },
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'nationality', label: 'Nationality', type: 'text' },
      { key: 'founded_year', label: 'Founded Year', type: 'number' },
      { key: 'total_race_entries', label: 'Total Race Entries', type: 'number' },
      { key: 'total_wins', label: 'Total Wins', type: 'number' },
      { key: 'total_podiums', label: 'Total Podiums', type: 'number' },
      { key: 'total_pole_positions', label: 'Total Pole Positions', type: 'number' },
      { key: 'total_fastest_laps', label: 'Total Fastest Laps', type: 'number' },
      { key: 'total_championships', label: 'Total Championships', type: 'number' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [
      {
        key: 'total_points',
        label: 'Total Points',
        pages: ['Constructor history', 'Constructor detail'],
        reason: '当前页面会展示生涯总积分，但 constructors 表中没有持久化该字段。',
      },
      {
        key: 'best_race_finish_position',
        label: 'Best Race Finish Position',
        pages: ['Constructor history'],
        reason: '历史页展示最佳完赛名次，目前只在派生逻辑中计算，没有落库缓存字段。',
      },
    ],
    derivedNotes: [
      'Season Rank、Season Points、Season Wins 和年度走势来自 constructor standings 与赛果聚合，不应直接写入 constructors 基础表。',
    ],
  },
  {
    key: 'races',
    label: 'Races',
    idField: 'id',
    fields: [
      { key: 'id', label: 'Race ID', type: 'number', readOnly: true },
      { key: 'season', label: 'Season', type: 'number' },
      { key: 'round', label: 'Round', type: 'number' },
      { key: 'race_name', label: 'Race Name', type: 'text' },
      { key: 'circuit_id', label: 'Circuit ID', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'is_sprint_weekend', label: 'Sprint Weekend', type: 'boolean' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [
      {
        key: 'circuit_name',
        label: 'Circuit Name',
        pages: ['Home', 'Races', 'Race detail'],
        reason: '当前页面直接展示赛道名，现阶段主要依赖 Ergast 响应或 circuits 关联数据。',
      },
      {
        key: 'locality',
        label: 'Locality',
        pages: ['Home', 'Race detail'],
        reason: '当前页面展示地点城市，races 表本身尚未缓存该字段。',
      },
      {
        key: 'country',
        label: 'Country',
        pages: ['Home', 'Race detail'],
        reason: '当前页面展示国家，races 表本身尚未缓存该字段。',
      },
    ],
    derivedNotes: [
      'Practice / Qualifying / Sprint / Race 明细属于结果表，不建议继续塞入 races 主表。',
      '如果未来改为纯数据库驱动，races 可以通过 circuits 外键 join 出赛道名称和地点。',
    ],
  },
  {
    key: 'seasons',
    label: 'Seasons',
    idField: 'year',
    fields: [
      { key: 'year', label: 'Year', type: 'number', readOnly: true },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [],
    derivedNotes: [
      '赛季积分榜页展示的数据来自 standings 聚合，不适合写入 seasons 基础表。',
    ],
  },
  {
    key: 'race_results',
    label: 'Race Results',
    idField: 'id',
    fields: [
      { key: 'id', label: 'Result ID', type: 'number', readOnly: true },
      { key: 'race_id', label: 'Race ID', type: 'number' },
      { key: 'driver_id', label: 'Driver ID', type: 'text' },
      { key: 'constructor_id', label: 'Constructor ID', type: 'text' },
      { key: 'position', label: 'Position', type: 'number' },
      { key: 'grid_position', label: 'Grid Position', type: 'number' },
      { key: 'points', label: 'Points', type: 'number' },
      { key: 'laps', label: 'Laps', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'fastest_lap_rank', label: 'Fastest Lap Rank', type: 'number' },
      { key: 'fastest_lap_time', label: 'Fastest Lap Time', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [],
    derivedNotes: [
      'Race detail 页展示的车手名和车队名应通过 driver_id / constructor_id 关联取得，不建议冗余落库。',
    ],
  },
  {
    key: 'qualifying_results',
    label: 'Qualifying Results',
    idField: 'id',
    fields: [
      { key: 'id', label: 'Result ID', type: 'number', readOnly: true },
      { key: 'race_id', label: 'Race ID', type: 'number' },
      { key: 'driver_id', label: 'Driver ID', type: 'text' },
      { key: 'constructor_id', label: 'Constructor ID', type: 'text' },
      { key: 'position', label: 'Position', type: 'number' },
      { key: 'q1_time', label: 'Q1 Time', type: 'text' },
      { key: 'q2_time', label: 'Q2 Time', type: 'text' },
      { key: 'q3_time', label: 'Q3 Time', type: 'text' },
      { key: 'created_at', label: 'Created At', type: 'datetime', readOnly: true },
    ],
    proposedFields: [],
    derivedNotes: [
      '页面上的 Q1/Q2/Q3 展示已经和数据库字段 q1_time / q2_time / q3_time 对齐。',
    ],
  },
];

const TABLE_LOADERS: Record<TableKey, (limit?: number) => Promise<any[]>> = {
  circuits: (limit) => supabaseApi.circuits.getAll(limit ?? 400),
  drivers: (limit) => supabaseApi.drivers.getAll(limit ?? 400),
  constructors: (limit) => supabaseApi.constructors.getAll(limit ?? 300),
  races: (limit) => supabaseApi.races.getAll(limit ?? 300),
  seasons: (limit) => supabaseApi.seasons.getAll(limit ?? 200),
  race_results: (limit) => supabaseApi.raceResults.getAll(limit ?? 200),
  qualifying_results: (limit) => supabaseApi.qualifyingResults.getAll(limit ?? 200),
};

const TABLE_SAVERS: Record<TableKey, (id: string | number, patch: Record<string, any>) => Promise<any>> = {
  circuits: (id, patch) => supabaseApi.circuits.update(String(id), patch),
  drivers: (id, patch) => supabaseApi.drivers.update(String(id), patch),
  constructors: (id, patch) => supabaseApi.constructors.update(String(id), patch),
  races: (id, patch) => supabaseApi.races.update(Number(id), patch),
  seasons: (id, patch) => supabaseApi.seasons.update(Number(id), patch),
  race_results: (id, patch) => supabaseApi.raceResults.update(Number(id), patch),
  qualifying_results: (id, patch) => supabaseApi.qualifyingResults.update(Number(id), patch),
};

function buildRecordLabel(record: Record<string, any>, config: TableConfig): string {
  if (config.key === 'circuits') {
    return `${record.name || record.circuit_id} (${record.circuit_id})`;
  }

  if (config.key === 'drivers') {
    return `${record.first_name || ''} ${record.last_name || ''}`.trim() || String(record.driver_id);
  }

  if (config.key === 'constructors') {
    return record.name || String(record.constructor_id);
  }

  if (config.key === 'races') {
    return `${record.season ?? '-'} R${record.round ?? '-'} ${record.race_name || ''}`.trim();
  }

  if (config.key === 'seasons') {
    return String(record.year);
  }

  if (config.key === 'race_results' || config.key === 'qualifying_results') {
    return `#${record.id} | race ${record.race_id} | pos ${record.position}`;
  }

  return String(record[config.idField] ?? '');
}

function normalizeForSubmit(value: any, field: FieldConfig) {
  if (field.type === 'number') {
    return value === '' || typeof value === 'undefined' ? null : value;
  }

  if (field.type === 'boolean') {
    return Boolean(value);
  }

  if (value === '') {
    return null;
  }

  return value ?? null;
}

function buildMigrationSql() {
  return [
    'alter table public.drivers add column if not exists total_points numeric;',
    'alter table public.drivers add column if not exists best_race_finish_position integer;',
    'alter table public.constructors add column if not exists total_points numeric;',
    'alter table public.constructors add column if not exists best_race_finish_position integer;',
    'alter table public.races add column if not exists circuit_name text;',
    'alter table public.races add column if not exists locality text;',
    'alter table public.races add column if not exists country text;',
  ].join('\n');
}

const DatabaseAudit = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [recordsByTable, setRecordsByTable] = useState<Record<string, any[]>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, string | number | null>>({});
  const [messageApi, contextHolder] = message.useMessage();

  const migrationSql = useMemo(() => buildMigrationSql(), []);
  const activeConfig = TABLE_CONFIGS.find((item) => item.key === activeTab);
  const activeRecords = activeConfig ? (recordsByTable[activeConfig.key] || []) : [];
  const selectedRecord = activeConfig
    ? activeRecords.find((item) => item[activeConfig.idField] === selectedIds[activeConfig.key])
    : null;

  useEffect(() => {
    const loadAllTables = async () => {
      await Promise.all(TABLE_CONFIGS.map(async (config) => {
        setLoading((current) => ({ ...current, [config.key]: true }));

        try {
          const data = await TABLE_LOADERS[config.key]();
          setRecordsByTable((current) => ({ ...current, [config.key]: data }));
          setSelectedIds((current) => ({
            ...current,
            [config.key]: data.length > 0 ? data[0][config.idField] : null,
          }));
        } catch (error) {
          console.error(`Failed to load ${config.key}:`, error);
          messageApi.error(`加载 ${config.label} 失败`);
        } finally {
          setLoading((current) => ({ ...current, [config.key]: false }));
        }
      }));
    };

    void loadAllTables();
  }, [messageApi]);

  useEffect(() => {
    if (!activeConfig) {
      return;
    }

    if (!selectedRecord) {
      form.resetFields();
      return;
    }

    const values: Record<string, any> = {};
    activeConfig.fields.forEach((field) => {
      values[field.key] = selectedRecord[field.key];
    });
    activeConfig.proposedFields.forEach((field) => {
      values[field.key] = selectedRecord[field.key];
    });
    form.setFieldsValue(values);
  }, [activeConfig, selectedRecord, form]);

  const handleRecordChange = (value: string | number) => {
    if (!activeConfig) {
      return;
    }

    setSelectedIds((current) => ({
      ...current,
      [activeConfig.key]: value,
    }));
  };

  const handleSave = async () => {
    if (!activeConfig || !selectedRecord) {
      return;
    }

    const values = await form.validateFields();
    const patch = activeConfig.fields.reduce<Record<string, any>>((result, field) => {
      if (field.readOnly) {
        return result;
      }

      result[field.key] = normalizeForSubmit(values[field.key], field);
      return result;
    }, {});

    setSaving((current) => ({ ...current, [activeConfig.key]: true }));

    try {
      const updated = await TABLE_SAVERS[activeConfig.key](selectedRecord[activeConfig.idField], patch);
      setRecordsByTable((current) => ({
        ...current,
        [activeConfig.key]: (current[activeConfig.key] || []).map((record) =>
          record[activeConfig.idField] === updated[activeConfig.idField] ? updated : record),
      }));
      messageApi.success(`${activeConfig.label} 保存成功`);
    } catch (error) {
      console.error(`Failed to save ${activeConfig.key}:`, error);
      messageApi.error(`${activeConfig.label} 保存失败，请检查 Supabase 写入权限`);
    } finally {
      setSaving((current) => ({ ...current, [activeConfig.key]: false }));
    }
  };

  const renderFormControl = (field: FieldConfig) => {
    if (field.type === 'number') {
      return (
        <InputNumber
          style={{ width: '100%' }}
          disabled={field.readOnly}
        />
      );
    }

    if (field.type === 'boolean') {
      return <Switch disabled={field.readOnly} />;
    }

    return (
      <Input
        disabled={field.readOnly}
        placeholder={field.type === 'date' ? 'YYYY-MM-DD' : undefined}
      />
    );
  };

  const overviewItems = TABLE_CONFIGS.map((config) => (
    <Card key={config.key} style={{ marginBottom: 16 }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space wrap>
          <Tag color="blue">{config.label}</Tag>
          <Tag>{config.fields.length} verified columns</Tag>
          {config.proposedFields.length > 0 ? (
            <Tag color="orange">{config.proposedFields.length} pending page fields</Tag>
          ) : (
            <Tag color="green">No pending page fields</Tag>
          )}
        </Space>

        <div>
          {config.fields.map((field) => (
            <Tag key={field.key} style={{ marginBottom: 8 }}>
              {field.key}
            </Tag>
          ))}
        </div>

        {config.proposedFields.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="Page-visible fields not yet persisted"
            description={config.proposedFields.map((field) => `${field.key}: ${field.reason}`).join(' ')}
          />
        ) : null}
      </Space>
    </Card>
  ));

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                当前数据库核验结果
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                已按真实 Supabase 公共表逐列核验当前项目实际使用的 7 张表，并把页面展示字段分成了三类：
                已落库字段、建议补充的持久化字段、以及不建议写入基础表的派生字段。
              </Typography.Paragraph>
            </Space>
          </Card>

          <Card title="Verified Public Tables">
            {overviewItems}
          </Card>

          <Card title="Recommended SQL Migration">
            <Typography.Paragraph>
              下面这组 SQL 用来补齐当前页面已经展示、但基础表尚未缓存的稳定字段。
            </Typography.Paragraph>
            <pre
              style={{
                margin: 0,
                padding: 16,
                overflowX: 'auto',
                borderRadius: 8,
                background: '#0b1020',
                color: '#f5f5f5',
              }}
            >
              {migrationSql}
            </pre>
          </Card>

          <Alert
            type="info"
            showIcon
            message="Derived fields intentionally stay out of base tables"
            description="当前赛季积分榜、年度走势、Recent Team、Championship Seasons、结果表中的车手/车队名称等，建议继续通过 standings 或外键关联计算，不直接冗余到基础表。"
          />
        </Space>
      ),
    },
    ...TABLE_CONFIGS.map((config) => ({
      key: config.key,
      label: config.label,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">{config.label}</Tag>
                <Tag icon={<SearchOutlined />}>
                  已核验 {config.fields.length} 个真实字段
                </Tag>
              </Space>

              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder={`选择一条 ${config.label} 记录`}
                value={selectedIds[config.key] ?? undefined}
                options={(recordsByTable[config.key] || []).map((record) => ({
                  value: record[config.idField],
                  label: buildRecordLabel(record, config),
                }))}
                onChange={handleRecordChange}
                optionFilterProp="label"
              />

              {loading[config.key] ? <Spin /> : null}
              {!loading[config.key] && (recordsByTable[config.key] || []).length === 0 ? (
                <Empty description={`${config.label} 当前没有可编辑记录`} />
              ) : null}
            </Space>
          </Card>

          {config.proposedFields.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message="这些页面字段已加入表单核验范围，但当前数据库表还没有对应列"
              description="你可以先在这里统一确认字段清单；真正持久化前，需要先执行 Overview 里的 SQL migration。"
            />
          ) : null}

          {config.derivedNotes.length > 0 ? (
            <Alert
              type="info"
              showIcon
              message="派生字段说明"
              description={config.derivedNotes.join(' ')}
            />
          ) : null}

          {selectedRecord ? (
            <Card
              title={`${config.label} Editor`}
              extra={(
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving[config.key]}
                  onClick={() => void handleSave()}
                >
                  保存当前记录
                </Button>
              )}
            >
              <Form
                form={form}
                layout="vertical"
              >
                {config.fields.map((field) => (
                  <Form.Item
                    key={field.key}
                    name={field.key}
                    label={field.label}
                    valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
                  >
                    {renderFormControl(field)}
                  </Form.Item>
                ))}

                {config.proposedFields.length > 0 ? (
                  <>
                    <Typography.Title level={5}>Pending Page Fields</Typography.Title>
                    {config.proposedFields.map((field) => (
                      <Form.Item
                        key={field.key}
                        name={field.key}
                        label={`${field.label} (${field.key})`}
                        extra={`来源页面: ${field.pages.join(', ')}。${field.reason}`}
                      >
                        <Input disabled placeholder="需要先执行 SQL migration 才能真正写入数据库" />
                      </Form.Item>
                    ))}
                  </>
                ) : null}
              </Form>
            </Card>
          ) : null}
        </Space>
      ),
    })),
  ];

  return (
    <div className="list-page-container">
      {contextHolder}

      <div style={{ marginBottom: 24 }}>
        <Space align="center" size={12}>
          <DatabaseOutlined style={{ fontSize: 28, color: '#1677ff' }} />
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>
              <span>数据库核验与字段对齐</span>
            </h1>
            <Typography.Text type="secondary">
              覆盖所有当前页面对应的数据库表、真实字段和待补充字段
            </Typography.Text>
          </div>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        items={tabItems}
        onChange={setActiveTab}
      />
    </div>
  );
};

export default DatabaseAudit;
