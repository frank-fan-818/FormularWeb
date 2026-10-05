import { useEffect, useRef, useState } from 'react';
import { BarChart, LineChart, LinesChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { applyChartTextTheme } from '@/utils/chartTheme';
import { ChartDataView } from './ChartDataView';

echarts.use([
  BarChart,
  LineChart,
  LinesChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  GridComponent,
  CanvasRenderer,
]);

interface EChartsPanelProps {
  chartKey: string;
  height: number | string;
  option: unknown;
  ariaLabel?: string;
}

const EChartsPanel = ({ chartKey, height, option, ariaLabel }: EChartsPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartElementRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const accessibleLabel = ariaLabel
    || '赛事数据可视化图表。图表主题与关键结论位于当前模块标题和摘要中。';

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [chartKey]);

  useEffect(() => {
    const chartElement = chartElementRef.current;
    if (!visible || !chartElement) return undefined;

    const chart = echarts.init(chartElement);
    chartInstanceRef.current = chart;
    const resize = () => chart.resize();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resize);
    resizeObserver?.observe(chartElement);
    if (!resizeObserver) window.addEventListener('resize', resize);

    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [chartKey, visible]);

  useEffect(() => {
    if (!visible) return;
    const paint = () => {
      const tokens = getComputedStyle(document.documentElement);
      const themedOption = applyChartTextTheme(option, tokens.getPropertyValue('--text-primary').trim(), tokens.getPropertyValue('--text-secondary').trim());
      const motionOption = typeof themedOption === 'object' && themedOption !== null
        ? {
            ...themedOption,
            animation: !reducedMotion,
            animationDuration: reducedMotion ? 0 : 420,
            animationDurationUpdate: reducedMotion ? 0 : 240,
            animationEasing: 'cubicOut',
            animationEasingUpdate: 'cubicOut',
          }
        : themedOption;
      chartInstanceRef.current?.setOption(motionOption as EChartsCoreOption, {
        notMerge: true,
        lazyUpdate: true,
      });
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [option, reducedMotion, visible]);

  return (
    <figure ref={containerRef} className="chart-panel" style={{ minHeight: height }}>
      <div role="img" aria-label={accessibleLabel}>
      {visible ? (
        <div ref={chartElementRef} key={chartKey} style={{ height }} aria-hidden="true" />
      ) : (
        <div className="chart-viewport-placeholder" style={{ height }} aria-hidden="true" />
      )}
      </div>
      {visible ? <ChartDataView option={option} label={accessibleLabel} /> : null}
    </figure>
  );
};

export default EChartsPanel;
