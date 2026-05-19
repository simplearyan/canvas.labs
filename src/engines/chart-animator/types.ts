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
  
  titleSize: number;
  subtitleSize: number;
  sourceSize: number;
  
  duration: number; // in seconds
  glow: number;
  zoom: number;
  panX: number;
  panY: number;
  format: ValueFormat;
}

export interface ChartState {
  title: string;
  subtitle: string;
  source: string;
  type: ChartType;
  
  labels: string[]; // X-axis labels or Pie slice labels
  series: ChartDataSeries[];
  
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
  titleSize: 64,
  subtitleSize: 38,
  sourceSize: 20,
  duration: 2.0,
  glow: 15,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  format: 'number'
};
