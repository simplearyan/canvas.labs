import type { ChartType, ColorPalette } from './types';

export interface ChartPreset {
  title: string;
  subtitle: string;
  source: string;
  type: ChartType;
  options: {
    colorPalette: ColorPalette;
    fontFamily: string;
    bgColor: string;
  };
  rawData: string;
}

export const CHART_PRESETS: Record<string, ChartPreset> = {
  hero: {
    title: 'PREVIEW HERO',
    subtitle: '',
    source: '',
    type: 'stacked',
    options: {
      colorPalette: 'vibrant',
      fontFamily: 'JetBrains Mono',
      bgColor: '#ffffff'
    },
    rawData: `Label,Group A,Group B,Group C\n2022,40,80,20\n2023,50,90,30\n2024,80,40,50`
  },
  tech: {
    title: 'Tech Giants Revenue ($B)',
    subtitle: 'Annual revenue over the past decade.',
    source: 'SOURCE: COMPANY EARNINGS REPORTS',
    type: 'horizontal',
    options: {
      colorPalette: 'pastel',
      fontFamily: 'Inter',
      bgColor: '#ffffff'
    },
    rawData: `Label,Value,Color\nApple,383,#94a3b8\nAmazon,574,#f59e0b\nGoogle,305,#3b82f6\nMicrosoft,211,#10b981`
  },
  energy: {
    title: 'Global Electricity Generation (TWh)',
    subtitle: 'The transition to renewable energy sources.',
    source: 'SOURCE: EMBER CLIMATE',
    type: 'stacked',
    options: {
      colorPalette: 'vibrant',
      fontFamily: 'Inter',
      bgColor: '#ffffff'
    },
    rawData: `Label,Fossil,Nuclear,Renewables\n2018,16800,2700,6600\n2019,16600,2800,7000\n2020,15900,2700,7500\n2021,16800,2800,8000\n2022,17000,2700,8600\n2023,17100,2700,9200`
  },
  consoles: {
    title: 'Gaming Console Sales (Millions)',
    subtitle: 'Annual hardware shipments for current generation.',
    source: 'SOURCE: VGCHARTZ / COMPANY REPORTS',
    type: 'multiline',
    options: {
      colorPalette: 'neon',
      fontFamily: 'Roboto',
      bgColor: '#000000'
    },
    rawData: `Label,PS5,Switch,Xbox Series\n2020,4.5,23.5,3.3\n2021,12.8,24.3,8.4\n2022,13.7,19.0,9.2\n2023,22.6,15.5,7.6\n2024,18.0,12.0,6.0`
  },
  sp500: {
    title: 'S&P 500 Index Growth',
    subtitle: 'Historical performance over a 5-year period.',
    source: 'SOURCE: YAHOO FINANCE',
    type: 'multiline',
    options: {
      colorPalette: 'ocean',
      fontFamily: 'Playfair Display',
      bgColor: '#f8fafc'
    },
    rawData: `Label,Close Price\n2019,3230\n2020,3756\n2021,4766\n2022,3839\n2023,4769\n2024,5200`
  },
  crypto: {
    title: 'Cryptocurrency Market Cap ($B)',
    subtitle: 'The meteoric rise of digital assets.',
    source: 'SOURCE: COINMARKETCAP',
    type: 'vertical',
    options: {
      colorPalette: 'sunset',
      fontFamily: 'Inter',
      bgColor: '#ffffff'
    },
    rawData: `Label,Value,Color\nBitcoin,1200,#f59e0b\nEthereum,400,#a855f7\nTether,100,#10b981\nBNB,95,#eab308\nSolana,60,#8b5cf6`
  },
  social: {
    title: 'Social Media MAUs (Millions)',
    subtitle: 'Monthly Active Users across platforms.',
    source: 'SOURCE: STATISTA',
    type: 'pie',
    options: {
      colorPalette: 'vibrant',
      fontFamily: 'Inter',
      bgColor: '#ffffff'
    },
    rawData: `Label,Value,Color\nFacebook,3030,#3b82f6\nYouTube,2500,#ef4444\nWhatsApp,2000,#22c55e\nInstagram,2000,#ec4899\nTikTok,1500,#0f172a`
  },
  climate: {
    title: 'Global Temperature Anomaly (°C)',
    subtitle: 'Deviation from the 20th-century average.',
    source: 'SOURCE: NOAA CLIMATE AT A GLANCE',
    type: 'vertical',
    options: {
      colorPalette: 'sunset',
      fontFamily: 'Carrois Gothic',
      bgColor: '#ffffff'
    },
    rawData: `Label,Value,Color\n2019,0.95,#f43f5e\n2020,1.02,#e11d48\n2021,0.85,#fb923c\n2022,0.86,#f97316\n2023,1.18,#9f1239`
  },
  pie: {
    title: 'Sample Pie Chart',
    subtitle: 'Distribution of components.',
    source: 'SOURCE: DEMO',
    type: 'pie',
    options: { colorPalette: 'pastel', fontFamily: 'Inter', bgColor: '#ffffff' },
    rawData: `Label,Value\nA,30\nB,50\nC,20`
  },
  bar: {
    title: 'Sample Bar Chart',
    subtitle: 'Comparison of metrics.',
    source: 'SOURCE: DEMO',
    type: 'vertical',
    options: { colorPalette: 'vibrant', fontFamily: 'Inter', bgColor: '#ffffff' },
    rawData: `Label,Metric 1,Metric 2\nQ1,100,80\nQ2,120,90\nQ3,90,110\nQ4,140,120`
  },
  line: {
    title: 'Sample Line Chart',
    subtitle: 'Trend over time.',
    source: 'SOURCE: DEMO',
    type: 'multiline',
    options: { colorPalette: 'ocean', fontFamily: 'Inter', bgColor: '#ffffff' },
    rawData: `Label,Trend\nJan,10\nFeb,15\nMar,13\nApr,22\nMay,18\nJun,30`
  }
};
