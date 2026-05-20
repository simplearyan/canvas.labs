export type ChartType = 'vertical' | 'horizontal' | 'multiline' | 'stacked' | 'pie';
export type ValueFormat = 'number' | 'currency' | 'percent';
export type ColorPalette = 'vibrant' | 'pastel' | 'neon' | 'sunset' | 'ocean';

export interface ChartDataSeries {
  label: string;
  data: number[];
  color?: string; // Optional custom color per series
}

export interface ChartConfigOptions {
  showTitle: boolean;
  showSubtitle: boolean;
  showSource: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  showGrid: boolean;
  showLegend: boolean;
  showValues: boolean;
  
  colorPalette: ColorPalette;
  fontFamily: string;
  bgColor: string;
  titleColor: string;
  textColor: string;
  valueFormat: "number" | "currency" | "percent";
  titleSize: number;
  subtitleSize: number;
  sourceSize: number;
  legendPosition: 'bottom' | 'top-right';
  sourcePosition: 'left' | 'right';
  sourcePadding: number;
  chartBottomGap: number;

  // Effects & Camera
  lineGlow: number;
  zoom: number;
  panX: number;
  panY: number;
  duration: number;
}

export interface ChartState {
  type: ChartType;
  title: string;
  subtitle: string;
  source: string;
  rawData: string;
  labels: string[]; // parsed X-axis labels
  series: ChartDataSeries[]; // parsed data series
  options: ChartConfigOptions;
}

import chartDefaults from '../../config/chart-defaults.json';

export const DEFAULT_CHART_OPTIONS: ChartConfigOptions = {
  showTitle: chartDefaults.showTitle,
  showSubtitle: chartDefaults.showSubtitle,
  showSource: chartDefaults.showSource,
  showXAxis: chartDefaults.showXAxis,
  showYAxis: chartDefaults.showYAxis,
  showGrid: chartDefaults.showGrid,
  showLegend: chartDefaults.showLegend,
  showValues: chartDefaults.showValues,
  colorPalette: chartDefaults.colorPalette as ColorPalette,
  fontFamily: chartDefaults.fontFamily,
  bgColor: chartDefaults.bgColor,
  titleColor: chartDefaults.titleColor,
  textColor: chartDefaults.textColor,
  valueFormat: chartDefaults.valueFormat as "number" | "currency" | "percent",
  titleSize: chartDefaults.titleSize,
  subtitleSize: chartDefaults.subtitleSize,
  sourceSize: chartDefaults.sourceSize,
  legendPosition: chartDefaults.legendPosition as 'bottom' | 'top-right',
  sourcePosition: chartDefaults.sourcePosition as 'left' | 'right',
  sourcePadding: chartDefaults.sourcePadding,
  chartBottomGap: chartDefaults.chartBottomGap,
  lineGlow: chartDefaults.lineGlow,
  zoom: chartDefaults.zoom,
  panX: chartDefaults.panX,
  panY: chartDefaults.panY,
  duration: chartDefaults.duration
};
