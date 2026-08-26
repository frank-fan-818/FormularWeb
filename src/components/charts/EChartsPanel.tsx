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
    const motionOption = typeof option === 'object' && option !== null
      ? {
          ...option,
          animation: !reducedMotion,
          animationDuration: reducedMotion ? 0 : 420,
          animationDurationUpdate: reducedMotion ? 0 : 240,
          animationEasing: 'cubicOut',
          animationEasingUpdate: 'cubicOut',
        }
      : option;
    chartInstanceRef.current?.setOption(motionOption as EChartsCoreOption, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [option, reducedMotion, visible]);

  return (
    <div ref={containerRef} style={{ minHeight: height }} role="img" aria-label={accessibleLabel}>
      {visible ? (
        <div ref={chartElementRef} key={chartKey} style={{ height }} aria-hidden="true" />
      ) : (
        <div className="chart-viewport-placeholder" style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
};

export default EChartsPanel;
