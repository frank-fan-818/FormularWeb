import { useId, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { getChartTablePage } from '@/utils/chartAccessibility';
import './ChartDataView.css';

export function ChartDataView({ option, label }: { option: unknown; label: string }) {
  const { t } = useTranslation();
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [seriesIndex, setSeriesIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const data = useMemo(() => getChartTablePage(option, seriesIndex, pageIndex), [option, seriesIndex, pageIndex]);
  if (!data.total) return null;
  return (
    <details className="chart-data-view" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{t('chartDataView')}</summary>
      {open ? (
        <div className="chart-data-view__body">
          <div className="chart-data-view__toolbar">
            <label htmlFor={selectId}>{t('chartDataSeries')}</label>
            <select id={selectId} value={data.seriesIndex} onChange={event => { setSeriesIndex(Number(event.target.value)); setPageIndex(0); }}>
              {data.seriesNames.map((name, index) => <option key={index} value={index}>{name}</option>)}
            </select>
          </div>
          <div className="chart-data-view__scroll" tabIndex={0} role="region" aria-label={t('chartDataView')}>
            <table>
              <caption>{label} · {data.seriesNames[data.seriesIndex]}</caption>
              <thead><tr>{data.labels.map((name, index) => <th key={index} scope="col">{name === 'X' ? t('chartDataPoint') : name === 'Y' ? t('chartDataValue') : name}</th>)}</tr></thead>
              <tbody>{data.rows.map((row, index) => <tr key={index}><th scope="row">{row[0]}</th><td>{row[1]}</td></tr>)}</tbody>
            </table>
          </div>
          <nav className="chart-data-view__pagination" aria-label={t('chartDataPagination')}>
            <button type="button" disabled={data.pageIndex === 0} onClick={() => setPageIndex(data.pageIndex - 1)}>{t('chartDataPrevious')}</button>
            <span aria-live="polite">{t('chartDataPage', { page: data.pageIndex + 1, pages: data.pageCount, total: data.total })}</span>
            <button type="button" disabled={data.pageIndex + 1 === data.pageCount} onClick={() => setPageIndex(data.pageIndex + 1)}>{t('chartDataNext')}</button>
          </nav>
        </div>
      ) : null}
    </details>
  );
}
