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

export const DEFAULT_CHART_OPTIONS: ChartConfigOptions = {
  showTitle: true,
  showSubtitle: true,
  showSource: true,
  showXAxis: true,
  showYAxis: true,
  showGrid: true,
  showLegend: true,
  showValues: true,
  colorPalette: 'vibrant',
  fontFamily: 'Inter',
  bgColor: '#ffffff',
  titleColor: '#1e293b',
  textColor: '#64748b',
  valueFormat: 'number',
  titleSize: 64,
  subtitleSize: 38,
  sourceSize: 20,
  lineGlow: 15,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  duration: 5
};
