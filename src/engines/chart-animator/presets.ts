import type { ChartType, ColorPalette, ChartConfigOptions } from './types';
import chartPresetsJson from '../../config/chart-presets.json';

export interface ChartPreset {
  title: string;
  subtitle: string;
  source: string;
  type: ChartType;
  options: Partial<ChartConfigOptions>;
  rawData: string;
}

export const CHART_PRESETS: Record<string, ChartPreset> = chartPresetsJson as unknown as Record<string, ChartPreset>;
