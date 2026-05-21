import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useRuntimeMonitor } from '@/hooks/useRuntimeMonitor';
import './Monitor.css';

const TEXT = {
  title: '系统运行监控',
  description: '实时追踪各模块的 API 调用、错误和性能',
  moduleHealth: '模块健康度',
  recentLogs: '近期日志',
  clear: '清空',
  healthy: '正常',
  degraded: '降级',
  down: '异常',
  noData: '暂无日志，浏览页面后日志会自动出现在这里',
  entries: '条',
  avgDuration: '平均耗时',
  errors: '错误',
};

const HEALTH_CONFIG = {
  healthy: { color: 'green' as const, icon: <CheckCircleOutlined />, label: TEXT.healthy },
  degraded: { color: 'orange' as const, icon: <WarningOutlined />, label: TEXT.degraded },
  down: { color: 'red' as const, icon: <CloseCircleOutlined />, label: TEXT.down },
};

const LEVEL_COLORS: Record<string, string> = {
  info: '#52c41a',
  warn: '#faad14',
  error: '#ff4d4f',
};

const Monitor = () => {
  const { entries, moduleHealth, clearLogs } = useRuntimeMonitor();
  const healthList = Array.from(moduleHealth.values());

  return (
    <div className="page-container monitor-page">
      <header className="monitor-header">
        <h2><ClockCircleOutlined style={{ marginRight: 10, color: 'var(--f1-red)' }} />{TEXT.title}</h2>
        <p className="monitor-description">{TEXT.description}</p>
      </header>

      <section className="monitor-section">
        <div className="monitor-section-header">
          <h3>{TEXT.moduleHealth}</h3>
          <span className="monitor-count">{healthList.length} {TEXT.entries}</span>
        </div>
        {healthList.length === 0 ? (
          <div className="monitor-empty">{TEXT.noData}</div>
        ) : (
          <div className="module-health-grid">
            {healthList.map((h) => {
              const cfg = HEALTH_CONFIG[h.status];
              return (
                <div key={h.module} className={`module-health-card health-${h.status}`}>
                  <div className="module-health-top">
                    <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>
                    <span className="module-name">{h.module}</span>
                  </div>
                  <div className="module-health-stats">
                    <div><span className="stat-label">调用</span><span className="stat-value">{h.totalCalls}</span></div>
                    <div><span className="stat-label">{TEXT.errors}</span><span className="stat-value" style={{ color: h.errors > 0 ? 'var(--f1-red)' : undefined }}>{h.errors}</span></div>
                    <div><span className="stat-label">{TEXT.avgDuration}</span><span className="stat-value">{Math.round(h.avgDurationMs)}ms</span></div>
                  </div>
                  {h.lastSeen && <div className="module-last-seen">最近: {new Date(h.lastSeen).toLocaleTimeString()}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="monitor-section">
        <div className="monitor-section-header">
          <h3>{TEXT.recentLogs}</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="monitor-count">{entries.length} {TEXT.entries}</span>
            <button type="button" className="monitor-clear-btn" onClick={clearLogs}><DeleteOutlined /> {TEXT.clear}</button>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="monitor-empty">{TEXT.noData}</div>
        ) : (
          <div className="log-entries">
            {entries.slice(-50).reverse().map((entry) => (
              <div key={entry.id} className={`log-entry log-level-${entry.level}`}>
                <span className="log-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className="log-level-dot" style={{ background: LEVEL_COLORS[entry.level] }} />
                <span className="log-module">{entry.module}</span>
                <span className="log-function">{entry.function}</span>
                <span className="log-event">{entry.event}</span>
                {entry.durationMs != null && <span className="log-duration">{entry.durationMs}ms</span>}
                {entry.status === 'failed' && <span className="log-error">{entry.error}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Monitor;
