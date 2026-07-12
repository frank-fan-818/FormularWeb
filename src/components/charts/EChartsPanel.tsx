import ReactEChartsCore from 'echarts-for-react/lib/core';
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
import type { EChartsCoreOption } from 'echarts/core';

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
}

const EChartsPanel = ({ chartKey, height, option }: EChartsPanelProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

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

  return (
    <div ref={containerRef} style={{ minHeight: height }}>
      {visible ? (
        <ReactEChartsCore
          echarts={echarts}
          key={chartKey}
          option={option as EChartsCoreOption}
          style={{ height }}
          notMerge
          lazyUpdate
        />
      ) : (
        <div className="chart-viewport-placeholder" style={{ height }} aria-hidden="true" />
      )}
    </div>
  );
};

export default EChartsPanel;
import { useEffect, useRef, useState } from 'react';
