import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { chartStore, loadStateFromUrl, updateChartOptions, updateChartMetadata, setChartStore } from '@/store/chartStore';
import { ChartEngine } from '@/engines/chart-animator/ChartEngine';
import type { ChartType, ColorPalette, ChartState } from '@/engines/chart-animator/types';
import { CHART_PRESETS, type ChartPreset } from '@/engines/chart-animator/presets';
import ExportModal from '@/components/common/ExportModal';
import { isDarkTheme, toggleTheme } from '@/store/global';
import Icon from '@/components/ui/Icon';

export default function ChartEditor() {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;

  const [isLoaded, setIsLoaded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'grid' | 'csv'>('csv');
  const [isExporting, setIsExporting] = createSignal(false);
  const [customPresets, setCustomPresets] = createSignal<Array<{name: string, data: any}>>([]);
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1'>('16:9');
  const [editorTab, setEditorTab] = createSignal<'presets' | 'metadata' | 'data' | 'style'>('presets');

  // Snapshot State
  const [snapshotRes, setSnapshotRes] = createSignal<'1080' | '1440' | '2160'>('1080');
  const [snapshotTransparent, setSnapshotTransparent] = createSignal(false);
  const [isExportingSnapshot, setIsExportingSnapshot] = createSignal(false);

  const exportSnapshotFrame = async () => {
    try {
      const targetH = parseInt(snapshotRes());
      const aspect = aspectRatio();
      let targetW = Math.round(targetH * (16 / 9));
      if (aspect === '9:16') {
        targetW = Math.round(targetH * (9 / 16));
      } else if (aspect === '1:1') {
        targetW = targetH;
      } else if (aspect === '4:5') {
        targetW = Math.round(targetH * (4 / 5));
      } else if (aspect === '3:4') {
        targetW = Math.round(targetH * (3 / 4));
      } else if (aspect === '4:3') {
        targetW = Math.round(targetH * (4 / 3));
      } else if (aspect === '2:1') {
        targetW = Math.round(targetH * (2 / 1));
      }

      const offscreen = new OffscreenCanvas(targetW, targetH);
      const snapEngine = new ChartEngine(offscreen);
      snapEngine.isTransparent = snapshotTransparent();
      snapEngine.setDimensions(targetW, targetH, 1);
      
      const snapshot = JSON.parse(JSON.stringify(chartStore));
      snapEngine.updateState(snapshot);
      snapEngine.seek(1.0);

      const blob = await offscreen.convertToBlob({ type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chartStore.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_snapshot_${snapshotRes()}p.png`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExportingSnapshot(false);
    } catch (err: any) {
      alert("Failed to export snapshot: " + err.message);
    }
  };

  // Parse configuration synchronously on client-side setup before first paint
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    if (encodedConfig) {
      loadStateFromUrl(encodedConfig);
    }
  }

  onMount(() => {
    // Load custom presets
    const saved = localStorage.getItem('chart_custom_presets');
    if (saved) {
      try {
        setCustomPresets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom presets:", e);
      }
    }

    engine = new ChartEngine(canvasRef);
    setIsLoaded(true);

    handleResize();
    setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    if (engine) engine.pause();
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    const wrapper = canvasRef.parentElement;
    if (wrapper) {
      const container = wrapper.parentElement;
      if (container) {
        const maxW = container.clientWidth - 64;
        const maxH = container.clientHeight - 64;
        
        let w = maxW;
        let h = maxH;
        
        const aspect = aspectRatio();
        let targetRatio = 16 / 9;
        let nativeW = 1920;
        let nativeH = 1080;
        
        if (aspect === '9:16') {
          targetRatio = 9 / 16;
          nativeW = 1080;
          nativeH = 1920;
        } else if (aspect === '1:1') {
          targetRatio = 1;
          nativeW = 1080;
          nativeH = 1080;
        } else if (aspect === '4:5') {
          targetRatio = 4 / 5;
          nativeW = 1080;
          nativeH = 1350;
        } else if (aspect === '3:4') {
          targetRatio = 3 / 4;
          nativeW = 1080;
          nativeH = 1440;
        } else if (aspect === '4:3') {
          targetRatio = 4 / 3;
          nativeW = 1440;
          nativeH = 1080;
        } else if (aspect === '2:1') {
          targetRatio = 2 / 1;
          nativeW = 2160;
          nativeH = 1080;
        }
        
        if (maxW / maxH > targetRatio) {
          h = maxH;
          w = h * targetRatio;
        } else {
          w = maxW;
          h = w / targetRatio;
        }
        
        engine.setDimensions(nativeW, nativeH, window.devicePixelRatio || 1);
        canvasRef.style.width = `${w}px`;
        canvasRef.style.height = `${h}px`;
      }
    }
  };

  createEffect(() => {
    aspectRatio();
    handleResize();
  });

  createEffect(() => {
    if (isLoaded() && engine) {
      const snapshot = JSON.parse(JSON.stringify(chartStore));
      engine.updateState(snapshot);
    }
  });

  const handleLoadPreset = (preset: ChartPreset) => {
    setChartStore({
      title: preset.title,
      subtitle: preset.subtitle,
      source: preset.source,
      type: preset.type,
      rawData: preset.rawData,
      options: {
        ...chartStore.options,
        ...preset.options
      }
    });
  };

  const handleSaveCustomPreset = () => {
    const name = prompt("Enter a name for your custom preset:", `My Preset ${customPresets().length + 1}`);
    if (!name) return;
    
    const currentConfig = JSON.parse(JSON.stringify(chartStore));
    const newPresets = [...customPresets(), { name, data: currentConfig }];
    setCustomPresets(newPresets);
    localStorage.setItem('chart_custom_presets', JSON.stringify(newPresets));
  };

  const handleLoadCustomPreset = (data: any) => {
    setChartStore(data);
  };

  const handleDeleteCustomPreset = (e: Event, index: number) => {
    e.stopPropagation();
    const newPresets = customPresets().filter((_, idx) => idx !== index);
    setCustomPresets(newPresets);
    localStorage.setItem('chart_custom_presets', JSON.stringify(newPresets));
  };

  const handlePlay = () => engine.play();
  return (
    <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative text-slate-800 dark:text-text-main blueprint-grid-bg font-editor">
      
      {/* TOOLBAR / SIDEBAR (Left Panel) */}
      <aside class="w-full md:w-[420px] h-[45vh] md:h-full order-last md:order-first bg-white dark:bg-zinc-950 border-t md:border-t-0 md:border-r border-blueprint-200 dark:border-zinc-800 p-4 md:p-5 flex flex-col gap-4 md:gap-6 overflow-y-auto z-10 shrink-0 custom-scrollbar shadow-xl">
        
        <div class="text-[10px] font-black text-blueprint-900 dark:text-brand-500 uppercase tracking-widest bg-blueprint-100 dark:bg-brand-500/10 px-2 py-1 inline-block w-max mb-[-12px]">Tool Properties</div>

        {/* Mobile View Category Tabs */}
        <div class="flex md:hidden items-center bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 p-1 shrink-0 gap-1 rounded-lg">
          <button 
            onClick={() => setEditorTab('presets')}
            class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'presets' ? 'bg-blueprint-900 text-white dark:bg-brand-500' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
          >
            Presets
          </button>
          <button 
            onClick={() => setEditorTab('metadata')}
            class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'metadata' ? 'bg-blueprint-900 text-white dark:bg-brand-500' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
          >
            Metadata
          </button>
          <button 
            onClick={() => setEditorTab('data')}
            class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'data' ? 'bg-blueprint-900 text-white dark:bg-brand-500' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
          >
            Data
          </button>
          <button 
            onClick={() => setEditorTab('style')}
            class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'style' ? 'bg-blueprint-900 text-white dark:bg-brand-500' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
          >
            Style
          </button>
        </div>

        {/* Presets Category */}
        <div class={editorTab() === 'presets' ? 'flex flex-col gap-5 md:gap-6 shrink-0' : 'hidden md:flex md:flex-col md:gap-6 md:shrink-0'}>
          {/* Built-in Preset Templates */}
          <div class="flex flex-col gap-3 shrink-0">
            <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Preset Templates</h2>
            <div class="grid grid-cols-2 gap-2">
              {Object.entries(CHART_PRESETS).map(([key, preset]) => (
                <button 
                  onClick={() => handleLoadPreset(preset)}
                  class="px-2 py-1.5 bg-slate-50 hover:bg-blueprint-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-blueprint-200 dark:border-zinc-800 text-left text-xs text-slate-700 dark:text-text-main hover:text-blueprint-900 dark:hover:text-brand-500 font-bold transition flex flex-col gap-0.5 relative group shadow-sm cursor-pointer"
                >
                  <span class="truncate pr-2">{preset.title}</span>
                  <span class="text-[8px] uppercase tracking-wider text-slate-400 dark:text-text-muted font-normal">{preset.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Presets */}
          <div class="flex flex-col gap-3 shrink-0">
            <div class="flex items-center justify-between">
              <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Custom Presets</h2>
              <button 
                onClick={handleSaveCustomPreset}
                class="px-2 py-1 bg-blueprint-900 dark:bg-brand-500 text-white font-bold text-[9px] uppercase tracking-widest shadow-sm hover:scale-105 transition cursor-pointer"
              >
                + Save Current
              </button>
            </div>
            {customPresets().length === 0 ? (
              <div class="p-3 border border-dashed border-blueprint-200 dark:border-zinc-800 text-center text-[10px] text-slate-400 dark:text-text-muted font-medium bg-slate-50/50 dark:bg-zinc-900/50 animate-pulse">
                No custom presets saved.
              </div>
            ) : (
              <div class="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                {customPresets().map((preset, idx) => (
                  <div 
                    onClick={() => handleLoadCustomPreset(preset.data)}
                    class="px-2 py-1.5 bg-slate-50 hover:bg-blueprint-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-blueprint-200 dark:border-zinc-800 text-left text-xs text-slate-700 dark:text-text-main hover:text-blueprint-900 dark:hover:text-brand-500 font-bold transition flex flex-col gap-0.5 relative group shadow-sm cursor-pointer justify-between"
                  >
                    <span class="truncate pr-4">{preset.name}</span>
                    <span class="text-[8px] uppercase tracking-wider text-slate-400 dark:text-text-muted font-normal">{preset.data.type}</span>
                    <button 
                      onClick={(e) => handleDeleteCustomPreset(e, idx)}
                      class="absolute top-1 right-1 text-slate-400 hover:text-brand-red opacity-0 group-hover:opacity-100 transition p-0.5"
                      title="Delete Preset"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="hidden md:block w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

        {/* Content Editor */}
        <div class={editorTab() === 'metadata' ? 'flex flex-col gap-3 shrink-0 animate-fade-in' : 'hidden md:flex md:flex-col md:gap-3 md:shrink-0'}>
          <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Chart Metadata</h2>
          
          <div class="flex items-center gap-3">
            <input type="checkbox" checked={chartStore.options.showTitle} onInput={(e) => updateChartOptions({ showTitle: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 cursor-pointer" title="Toggle Title" />
            <input type="text" value={chartStore.title} onInput={(e) => updateChartMetadata({ title: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-text-main font-semibold outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all placeholder:font-normal" placeholder="Chart Title" />
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" checked={chartStore.options.showSubtitle} onInput={(e) => updateChartOptions({ showSubtitle: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 cursor-pointer" title="Toggle Subtitle" />
            <input type="text" value={chartStore.subtitle} onInput={(e) => updateChartMetadata({ subtitle: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-text-main outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all" placeholder="Chart Subtitle" />
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" checked={chartStore.options.showSource} onInput={(e) => updateChartOptions({ showSource: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 cursor-pointer" title="Toggle Source" />
            <input type="text" value={chartStore.source} onInput={(e) => updateChartMetadata({ source: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-text-muted uppercase font-medium outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all" placeholder="Source Attribution" />
          </div>
        </div>

        <div class="hidden md:block w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

        {/* Enhanced Data Editor */}
        <div class={editorTab() === 'data' ? 'flex flex-col gap-3 flex-1 min-h-[200px] md:min-h-[240px] animate-fade-in' : 'hidden md:flex md:flex-col md:gap-3 md:flex-1 md:min-h-[240px]'}>
          <div class="flex items-center justify-between">
            <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Chart Data</h2>
            <div class="flex bg-slate-100 dark:bg-zinc-900 p-1 border border-blueprint-200 dark:border-zinc-800">
              <button onClick={() => setActiveTab('grid')} class={`px-3 py-1 text-[10px] font-bold transition ${activeTab() === 'grid' ? 'text-white bg-blueprint-900 dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main'}`}>Grid View</button>
              <button onClick={() => setActiveTab('csv')} class={`px-3 py-1 text-[10px] font-bold transition ${activeTab() === 'csv' ? 'text-white bg-blueprint-900 dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main'}`}>Raw CSV</button>
            </div>
          </div>

          {activeTab() === 'csv' && (
            <div class="flex flex-col gap-2 flex-1">
              <p class="text-[10px] text-slate-500 dark:text-text-muted font-medium">Format: Label, Series1, Series2..., #Color (optional).</p>
              <textarea 
                value={chartStore.rawData}
                onInput={(e) => updateChartMetadata({ rawData: e.currentTarget.value })}
                class="w-full h-48 flex-1 p-3 border-2 border-blueprint-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-[12px] text-slate-800 dark:text-text-main font-mono outline-none focus:border-blueprint-900 dark:focus:border-brand-500 resize-none whitespace-pre transition-colors leading-relaxed" 
                spellcheck="false"
              ></textarea>
            </div>
          )}
          {activeTab() === 'grid' && (
            <div class="flex flex-col items-center justify-center flex-1 border-2 border-dashed border-blueprint-200 dark:border-zinc-800 bg-blueprint-50 dark:bg-zinc-900 p-6 text-center">
              <p class="text-sm font-bold text-blueprint-900 dark:text-brand-500">Grid View Coming Soon</p>
              <p class="text-xs text-slate-500 dark:text-text-muted mt-2">Please use the Raw CSV editor for now to manage your dataset.</p>
            </div>
          )}
        </div>

        <div class="hidden md:block w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

        {/* Appearance Settings */}
        <div class={editorTab() === 'style' ? 'flex flex-col gap-5 shrink-0 animate-fade-in' : 'hidden md:flex md:flex-col md:gap-5 md:shrink-0'}>
          <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Layout & Style</h2>
          
          {/* Toggles */}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 mt-1 mb-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800 p-3">
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showGrid} onInput={(e) => updateChartOptions({ showGrid: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Grid</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showLegend} onInput={(e) => updateChartOptions({ showLegend: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Legend</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showValues} onInput={(e) => updateChartOptions({ showValues: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Values</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showXAxis} onInput={(e) => updateChartOptions({ showXAxis: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">X-Axis</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showYAxis} onInput={(e) => updateChartOptions({ showYAxis: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Y-Axis</span></label>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Chart Type</label>
              <select value={chartStore.type} onInput={(e) => updateChartMetadata({ type: e.currentTarget.value as ChartType })} class="w-full px-2 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="vertical">Vertical Bar</option>
                <option value="horizontal">Horizontal Bar</option>
                <option value="multiline">Multi-Line</option>
                <option value="stacked">Stacked Bar</option>
                <option value="pie">Pie Chart</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Color Palette</label>
              <select value={chartStore.options.colorPalette} onInput={(e) => updateChartOptions({ colorPalette: e.currentTarget.value as ColorPalette })} class="w-full px-2 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="vibrant">Vibrant</option>
                <option value="pastel">Pastel Colors</option>
                <option value="neon">Cyberpunk Neon</option>
                <option value="sunset">Sunset Glow</option>
                <option value="ocean">Deep Ocean</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Legend Pos</label>
              <select value={chartStore.options.legendPosition || 'bottom'} onInput={(e) => updateChartOptions({ legendPosition: e.currentTarget.value as any })} class="w-full px-2 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="bottom">Bottom Horiz</option>
                <option value="top-right">Top Right Vert</option>
              </select>
            </div>
          </div>

          {/* Custom Colors */}
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Canvas BG</label>
              <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden"><input type="color" value={chartStore.options.bgColor} onInput={(e) => updateChartOptions({ bgColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Title Color</label>
              <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden"><input type="color" value={chartStore.options.titleColor} onInput={(e) => updateChartOptions({ titleColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Text Color</label>
              <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden"><input type="color" value={chartStore.options.textColor} onInput={(e) => updateChartOptions({ textColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Font Family</label>
              <select value={chartStore.options.fontFamily} onInput={(e) => updateChartOptions({ fontFamily: e.currentTarget.value })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="Inter">Inter (Modern)</option>
                <option value="Carrois Gothic">Carrois Gothic (Editorial)</option>
                <option value="Roboto">Roboto (Clean)</option>
                <option value="JetBrains Mono">JetBrains (Code)</option>
                <option value="Playfair Display">Playfair (Serif)</option>
                <option value="Caveat">Caveat (Handdrawn)</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Value Format</label>
              <select value={chartStore.options.valueFormat} onInput={(e) => updateChartOptions({ valueFormat: e.currentTarget.value as any })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="number">Plain Number</option>
                <option value="currency">$ Currency</option>
                <option value="percent">% Percentage</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Source Position</label>
              <select value={chartStore.options.sourcePosition || 'left'} onInput={(e) => updateChartOptions({ sourcePosition: e.currentTarget.value as any })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="left">Bottom Left</option>
                <option value="right">Bottom Right</option>
              </select>
            </div>
            <div>
              <div class="flex justify-between items-center mb-1.5">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500">Source Top Gap</label>
                <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.sourcePadding ?? 40}px</span>
              </div>
              <input type="range" min="10" max="150" step="5" value={chartStore.options.sourcePadding ?? 40} onInput={(e) => updateChartOptions({ sourcePadding: parseInt(e.currentTarget.value) })} class="w-full h-8 accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
            </div>
          </div>

          <div class="flex flex-col p-3 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Chart Bottom Gap</label>
              <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.chartBottomGap ?? 40}px</span>
            </div>
            <input type="range" min="10" max="150" step="5" value={chartStore.options.chartBottomGap ?? 40} onInput={(e) => updateChartOptions({ chartBottomGap: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
          </div>

          {/* Animation Duration */}
          <div class="flex flex-col mt-2 p-3 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-2">
              <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Animation Duration</label>
              <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.duration || 5}s</span>
            </div>
            <input type="range" min="1" max="15" step="0.5" value={chartStore.options.duration || 5} onInput={(e) => updateChartOptions({ duration: parseFloat(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500" />
          </div>

          {/* Zoom & Pan */}
          <div class="flex flex-col mt-2 p-3 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800">
            <div class="flex justify-between items-center mb-4">
              <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Zoom & Pan View</label>
              <button onClick={() => updateChartOptions({ zoom: 1.0, panX: 0, panY: 0 })} class="text-[10px] font-bold text-blueprint-500 dark:text-text-muted hover:text-blueprint-900 dark:hover:text-brand-500 flex items-center gap-1 transition uppercase">Reset</button>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Zoom</label>
                  <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.zoom.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="3" step="0.1" value={chartStore.options.zoom} onInput={(e) => updateChartOptions({ zoom: parseFloat(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500" />
              </div>
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Pan X</label>
                  <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.panX}</span>
                </div>
                <input type="range" min="-1000" max="1000" step="10" value={chartStore.options.panX} onInput={(e) => updateChartOptions({ panX: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500" />
              </div>
              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Pan Y</label>
                  <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.panY}</span>
                </div>
                <input type="range" min="-1000" max="1000" step="10" value={chartStore.options.panY} onInput={(e) => updateChartOptions({ panY: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500" />
              </div>
            </div>
          </div>
          
        </div>
      </aside>

      {/* CANVAS AREA (Right / Top on Mobile) */}
      <section class="flex-1 h-[55vh] md:h-full order-first md:order-last relative overflow-hidden flex items-center justify-center p-4 sm:p-12">
        <div class="relative p-2 bg-white dark:bg-zinc-900 border-2 border-blueprint-900 dark:border-zinc-800 blueprint-shadow">
           <canvas ref={canvasRef} class="block bg-white dark:bg-black object-contain"></canvas>
        </div>
      </section>
      
      {/* Unified Reusable Export Modal */}
      <ExportModal 
        isOpen={isExporting()} 
        onClose={() => setIsExporting(false)} 
        chartStore={chartStore} 
        aspectRatio={aspectRatio()} 
      />

      {/* SNAPSHOT EXPORT MODAL */}
      {isExportingSnapshot() && (
        <div class="fixed inset-0 z-50 bg-slate-950/70 dark:bg-black/80 flex items-center justify-center p-4 transition-opacity">
          <div class="bg-white dark:bg-zinc-950 border-2 border-blueprint-900 dark:border-zinc-800 shadow-2xl p-8 max-w-md w-full relative flex flex-col gap-6 text-slate-800 dark:text-text-main">
            <button onClick={() => setIsExportingSnapshot(false)} class="absolute top-4 right-4 text-slate-400 dark:text-text-muted hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer">
               ✕
            </button>
            
            <div class="flex flex-col gap-1">
              <h3 class="text-xl font-black text-blueprint-900 dark:text-brand-500 uppercase tracking-tighter">
                Export Frame Snapshot
              </h3>
              <p class="text-xs text-slate-500 dark:text-text-muted font-medium">
                Save the current frame as a high-resolution PNG image.
              </p>
            </div>
            
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-blueprint-900 dark:text-brand-500 uppercase tracking-widest">Resolution</label>
                <select value={snapshotRes()} onInput={(e) => setSnapshotRes(e.currentTarget.value as any)} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-slate-800 dark:text-text-main text-sm font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 cursor-pointer">
                  <option value="1080">HD (1080p)</option>
                  <option value="1440">2K (1440p)</option>
                  <option value="2160">4K (2160p)</option>
                </select>
              </div>

              <div class="flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50 p-3 border border-blueprint-100 dark:border-zinc-800">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-slate-800 dark:text-text-main uppercase tracking-wider">Transparent Background</span>
                  <span class="text-[9px] text-slate-400 dark:text-text-muted font-medium">PNG alpha layer with no background color fill.</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={snapshotTransparent()} 
                  onChange={(e) => setSnapshotTransparent(e.currentTarget.checked)}
                  class="w-5 h-5 accent-blueprint-900 dark:accent-brand-500 cursor-pointer"
                />
              </div>
              
              <button onClick={exportSnapshotFrame} class="w-full py-3.5 bg-red-650 hover:bg-red-750 bg-blueprint-900 dark:bg-brand-500 text-white font-black uppercase tracking-widest transition shadow-[4px_4px_0px_rgba(0,51,102,0.1)] mt-2 cursor-pointer">
                Download PNG Frame
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portaling controls to header to keep editor interface premium */}
      <Portal mount={document.getElementById('editor-header-controls') || undefined}>
        <div class="flex items-center gap-1.5 sm:gap-3">
          {/* Aspect Ratio Selector Dropdown */}
          <div class="relative flex items-center bg-slate-100 dark:bg-zinc-900/50 rounded-lg border border-slate-200 dark:border-zinc-800 px-2 sm:px-3 py-1.5 gap-1 sm:gap-1.5 shadow-sm">
            <span class="hidden md:inline text-[9px] font-black text-slate-400 dark:text-text-muted uppercase tracking-wider select-none">Aspect:</span>
            <select 
              value={aspectRatio()} 
              onInput={(e) => setAspectRatio(e.currentTarget.value as any)} 
              class="bg-transparent border-none text-[10px] sm:text-[11px] font-extrabold text-slate-700 dark:text-text-main outline-none cursor-pointer appearance-none pr-4 sm:pr-5 relative"
            >
              <option value="16:9" class="bg-white dark:bg-zinc-950">16:9 (Landscape)</option>
              <option value="9:16" class="bg-white dark:bg-zinc-950">9:16 (Vertical)</option>
              <option value="1:1" class="bg-white dark:bg-zinc-950">1:1 (Square)</option>
              <option value="4:5" class="bg-white dark:bg-zinc-950">4:5 (Portrait)</option>
              <option value="3:4" class="bg-white dark:bg-zinc-950">3:4 (Standard Vert.)</option>
              <option value="4:3" class="bg-white dark:bg-zinc-950">4:3 (Standard Horiz.)</option>
              <option value="2:1" class="bg-white dark:bg-zinc-950">2:1 (Panoramics)</option>
            </select>
            <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-text-muted text-[8px]">▼</div>
          </div>

          {/* Theme Switcher Button */}
          <button 
            onClick={toggleTheme} 
            class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-text-muted hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-transparent dark:border-zinc-800/20 shrink-0"
            title="Toggle Light/Dark Theme"
          >
            <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />}>
              <Icon name="sun" class="w-4 h-4 sm:w-5 sm:h-5 text-brand-500" />
            </Show>
          </button>

          {/* Camera Snapshot Button */}
          <button 
            onClick={() => setIsExportingSnapshot(true)} 
            class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main font-bold text-[10px] sm:text-xs uppercase tracking-widest transition border border-blueprint-200 dark:border-zinc-800 cursor-pointer shadow-sm"
            title="Export High-Res PNG Snapshot"
          >
             <Icon name="download" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" />
             <span class="hidden sm:inline">Camera Snapshot</span>
          </button>

          {/* Preview/Play Button */}
          <button 
            onClick={handlePlay} 
            class="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main font-bold text-[10px] sm:text-xs uppercase tracking-widest transition border border-blueprint-200 dark:border-zinc-800 cursor-pointer shadow-sm"
            title="Play Animation Preview"
          >
             <Icon name="play" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" />
             <span class="hidden sm:inline">Preview</span>
          </button>

          {/* Export Video Button */}
          <button 
            onClick={() => setIsExporting(true)} 
            class="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-md bg-blueprint-900 hover:bg-blueprint-800 dark:bg-brand-500 dark:hover:bg-brand-600 font-bold text-[10px] sm:text-xs uppercase tracking-widest transition cursor-pointer shadow-md shrink-0"
            title="Export Video Animation"
            style={{ color: isDarkTheme() ? '#09090b' : '#ffffff' }}
          >
             <Icon name="film" class={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isDarkTheme() ? 'text-zinc-950' : 'text-white'}`} />
             <span class="hidden sm:inline">Export Video</span>
             <span class="inline sm:hidden">Export</span>
          </button>
        </div>
      </Portal>
    </div>
  );
}
