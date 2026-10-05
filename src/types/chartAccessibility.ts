export interface ChartTablePage {
  seriesNames: string[];
  seriesIndex: number;
  labels: [string, string];
  rows: Array<[string, string]>;
  total: number;
  pageIndex: number;
  pageCount: number;
}
