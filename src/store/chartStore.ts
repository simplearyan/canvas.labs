import { createStore } from 'solid-js/store';
import { type ChartState, DEFAULT_CHART_OPTIONS } from '../engines/chart-animator/types';
import LZString from 'lz-string';

// Initial default state
const initialState: ChartState = {
  title: 'Global Electricity Generation',
  subtitle: 'The transition to renewable energy sources.',
  source: 'SOURCE: EMBER CLIMATE',
  type: 'stacked',
  labels: ['2018', '2019', '2020'],
  series: [
    { label: 'Fossil', data: [16800, 16600, 15900] },
    { label: 'Renewables', data: [6600, 7000, 7500] }
  ],
  options: { ...DEFAULT_CHART_OPTIONS }
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

export function updateChartMetadata(updates: Partial<Pick<ChartState, 'title' | 'subtitle' | 'source' | 'type'>>) {
  setChartStore(updates);
}
