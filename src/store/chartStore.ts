import { createStore } from 'solid-js/store';
import { type ChartState, DEFAULT_CHART_OPTIONS } from '../engines/chart-animator/types';
import LZString from 'lz-string';

// Initial default state
const initialState: ChartState = {
  type: 'vertical',
  title: 'Global Electricity Generation (TWh)',
  subtitle: 'The transition to renewable energy sources.',
  source: 'SOURCE: EMBER CLIMATE',
  rawData: `Label,Fossil,Nuclear,Renewables
2018,16800,2700,6600
2019,16600,2800,7000
2020,15900,2700,7500
2021,16800,2800,8000
2022,17000,2700,8600
2023,17100,2700,9200`,
  labels: [],
  series: [],
  options: DEFAULT_CHART_OPTIONS,
};

export const [chartStore, setChartStore] = createStore<ChartState>(initialState);

// --- URL State Serialization / Deserialization ---

/**
 * Serializes the current chart store into a Base64 LZString for the URL
 */
export function serializeChartState(): string {
  const jsonString = JSON.stringify(chartStore);
  return LZString.compressToEncodedURIComponent(jsonString);
}

/**
 * Parses a Base64 LZString back into the store
 */
export function loadStateFromUrl(encodedState: string): boolean {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(encodedState);
    if (!jsonString) return false;
    
    const parsedState = JSON.parse(jsonString) as ChartState;
    // Merge options with defaults to prevent missing keys from old URL configs
    parsedState.options = { ...DEFAULT_CHART_OPTIONS, ...parsedState.options };
    setChartStore(parsedState);
    return true;
  } catch (err) {
    console.error("Failed to parse state from URL:", err);
    return false;
  }
}

// Action Helpers
export function updateChartOptions(updates: Partial<typeof DEFAULT_CHART_OPTIONS>) {
  setChartStore('options', (opts) => ({ ...opts, ...updates }));
}

export function updateChartMetadata(updates: Partial<Pick<ChartState, 'title' | 'subtitle' | 'source' | 'type' | 'rawData'>>) {
  setChartStore(updates);
}
