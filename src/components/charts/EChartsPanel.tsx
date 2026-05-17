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
  option: any;
}

const EChartsPanel = ({ chartKey, height, option }: EChartsPanelProps) => {
  return (
    <ReactEChartsCore
      echarts={echarts}
      key={chartKey}
      option={option}
      style={{ height }}
      notMerge
      lazyUpdate
    />
  );
};

export default EChartsPanel;
