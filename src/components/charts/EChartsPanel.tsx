import ReactEChartsCore from 'echarts-for-react/lib/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import * as echarts from 'echarts/core';

echarts.use([
  LineChart,
  TooltipComponent,
  LegendComponent,
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
