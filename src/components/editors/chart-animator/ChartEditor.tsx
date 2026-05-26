import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { chartStore, loadStateFromUrl, updateChartOptions, updateChartMetadata, setChartStore } from '@/store/chartStore';
import { ChartEngine } from '@/engines/chart-animator/ChartEngine';
import type { ChartType, ColorPalette, ChartState } from '@/engines/chart-animator/types';
import { CHART_PRESETS, type ChartPreset } from '@/engines/chart-animator/presets';
import ExportModal from '@/components/common/ExportModal';
import { isDarkTheme, toggleTheme } from '@/store/global';
import Icon from '@/components/ui/Icon';

// Reusable Premium Toggle Switch Component
function ToggleSwitch(props: { checked: boolean, onChange: (v: boolean) => void, label: string }) {
  return (
    <button
      onClick={() => props.onChange(!props.checked)}
      class="flex items-center justify-between w-full px-3 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 hover:bg-blueprint-50/50 dark:hover:bg-zinc-800/50 transition-all duration-150 cursor-pointer rounded-lg group text-left animate-fade-in"
      type="button"
    >
      <span class="text-[10px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider group-hover:text-blueprint-900 dark:group-hover:text-brand-500 transition-colors">{props.label}</span>
      <div class={`relative w-8.5 h-5 transition-colors duration-200 rounded-full border shrink-0 ${props.checked ? 'bg-blueprint-900 border-blueprint-950 dark:bg-brand-500 dark:border-brand-600' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-750'}`}>
        <div class={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${props.checked ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
      </div>
    </button>
  );
}

export default function ChartEditor() {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;

  const [isLoaded, setIsLoaded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'grid' | 'csv'>('csv');
  const [isExporting, setIsExporting] = createSignal(false);
  const [customPresets, setCustomPresets] = createSignal<Array<{ name: string, data: any }>>([]);
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1'>('16:9');
  const [editorTab, setEditorTab] = createSignal<'presets' | 'metadata' | 'data' | 'style' | 'canvas'>('presets');
  const [styleSubTab, setStyleSubTab] = createSignal<'layout' | 'colors' | 'motion'>('layout');
  const [activePreset, setActivePreset] = createSignal<string | null>('vertical');

  // Snapshot State
  const [snapshotRes, setSnapshotRes] = createSignal<'1080' | '1440' | '2160'>('1080');
  const [snapshotTransparent, setSnapshotTransparent] = createSignal(false);
  const [isExportingSnapshot, setIsExportingSnapshot] = createSignal(false);

  // Fullscreen & Playback State
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isPlaying, setIsPlaying] = createSignal(false);
  let canvasContainerRef!: HTMLDivElement;
  let playTimeoutId: any = null;

  function RailTab(props: { value: 'presets' | 'metadata' | 'data' | 'style' | 'canvas', label: string, icon: string }) {
    const isActive = () => editorTab() === props.value;
    return (
      <button
        onClick={() => setEditorTab(props.value)}
        class={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
          isActive()
            ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 shadow-md scale-[1.02]'
            : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'
        }`}
        type="button"
      >
        <Icon name={props.icon} class="w-5 h-5" />
        <span class="text-[9px] font-black uppercase tracking-wider">{props.label}</span>
      </button>
    );
  }

  function AspectRatioCard(props: { value: '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1', label: string, shape: string, orientation: string }) {
    const isActive = () => aspectRatio() === props.value;
    return (
      <button
        onClick={() => setAspectRatio(props.value)}
        class={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer group shadow-sm ${
          isActive()
            ? 'bg-blueprint-50/70 border-blueprint-900 dark:bg-brand-500/10 dark:border-brand-500 text-blueprint-900 dark:text-brand-500 ring-2 ring-blueprint-900/10 dark:ring-brand-500/20'
            : 'bg-slate-50 hover:bg-blueprint-50/30 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 border-blueprint-200 dark:border-zinc-800 text-slate-700 dark:text-text-main'
        }`}
        type="button"
      >
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-[11px] font-bold tracking-tight">{props.label}</span>
          <div class={`relative rounded ${isActive() ? 'bg-blueprint-900 dark:bg-brand-500' : 'bg-slate-300 dark:bg-zinc-700'} ${props.shape} flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity duration-200`}></div>
        </div>
        <span class={`text-[8px] uppercase tracking-wider font-semibold ${isActive() ? 'text-blueprint-700 dark:text-brand-400' : 'text-slate-400 dark:text-text-muted'}`}>{props.orientation}</span>
      </button>
    );
  }

  const exportSnapshotFrame = async () => {
    try {
      const res = parseInt(snapshotRes());
      const aspect = aspectRatio();
      
      let targetW = 1920;
      let targetH = 1080;
      
      if (aspect === '16:9') {
        targetW = 1920;
        targetH = 1080;
      } else if (aspect === '9:16') {
        targetW = 1080;
        targetH = 1920;
      } else if (aspect === '1:1') {
        targetW = 1080;
        targetH = 1080;
      } else if (aspect === '4:5') {
        targetW = 1080;
        targetH = 1350;
      } else if (aspect === '3:4') {
        targetW = 1080;
        targetH = 1440;
      } else if (aspect === '4:3') {
        targetW = 1440;
        targetH = 1080;
      } else if (aspect === '2:1') {
        targetW = 2160;
        targetH = 1080;
      }
      
      const isLandscape = aspect === '16:9' || aspect === '4:3' || aspect === '2:1';
      const baseSize = isLandscape ? targetH : targetW;
      const multiplier = res / baseSize;
      
      targetW = Math.round(targetW * multiplier);
      targetH = Math.round(targetH * multiplier);

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
    
    // Initial resize to set dimensions and render first frame before showing canvas
    handleResize();
    setTimeout(handleResize, 100);

    // Fade in canvas smoothly
    setIsLoaded(true);

    // Listen to font loading to redraw immediately when custom fonts finish loading
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (engine) engine.render();
      });
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    if (engine) engine.pause();
    if (playTimeoutId) {
      clearTimeout(playTimeoutId);
    }
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    const wrapper = canvasRef.parentElement;
    if (wrapper) {
      const container = wrapper.parentElement;
      if (container) {
        const isFS = document.fullscreenElement === wrapper;
        const maxW = isFS ? window.innerWidth - 96 : container.clientWidth - 64;
        const maxH = isFS ? window.innerHeight - 160 : container.clientHeight - 64;

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

  const handleUpdateMetadata = (data: Parameters<typeof updateChartMetadata>[0]) => {
    setActivePreset(null);
    updateChartMetadata(data);
  };

  const handleUpdateOptions = (data: Parameters<typeof updateChartOptions>[0]) => {
    setActivePreset(null);
    updateChartOptions(data);
  };

  const handleLoadPreset = (key: string, preset: ChartPreset) => {
    setActivePreset(key);
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

  const handleLoadCustomPreset = (name: string, data: any) => {
    setActivePreset(name);
    setChartStore(data);
  };

  const handleDeleteCustomPreset = (e: Event, index: number) => {
    e.stopPropagation();
    const newPresets = customPresets().filter((_, idx) => idx !== index);
    setCustomPresets(newPresets);
    localStorage.setItem('chart_custom_presets', JSON.stringify(newPresets));
  };

  const handlePlayPause = () => {
    if (!engine) return;
    if (isPlaying()) {
      engine.pause();
      setIsPlaying(false);
      if (playTimeoutId) {
        clearTimeout(playTimeoutId);
        playTimeoutId = null;
      }
    } else {
      engine.play();
      setIsPlaying(true);
      if (playTimeoutId) clearTimeout(playTimeoutId);

      const durationMs = (chartStore.options.duration || 5) * 1000;
      playTimeoutId = setTimeout(() => {
        setIsPlaying(false);
        playTimeoutId = null;
      }, durationMs);
    }
  };

  const toggleFullscreen = () => {
    if (!canvasContainerRef) return;
    if (!document.fullscreenElement) {
      canvasContainerRef.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Failed to enter fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleFullscreenChange = () => {
    const active = document.fullscreenElement === canvasContainerRef;
    setIsFullscreen(active);
    setTimeout(() => {
      handleResize();
    }, 100);
  };

  const handlePlay = () => handlePlayPause();
  return (
    <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative text-slate-800 dark:text-text-main blueprint-grid-bg font-editor">

      {/* TOOLBAR / SIDEBAR (Left Panel) */}
      <aside class="w-full md:w-[480px] h-[45vh] md:h-full order-last md:order-first bg-white dark:bg-zinc-950 border-t md:border-t-0 md:border-r border-blueprint-200 dark:border-zinc-800 flex flex-col md:flex-row z-10 shrink-0 shadow-xl overflow-hidden">
        
        {/* DESKTOP SIDE NAVIGATION RAIL */}
        <div class="hidden md:flex flex-col w-[80px] bg-slate-50 dark:bg-zinc-900 border-r border-blueprint-100 dark:border-zinc-800 py-6 items-center gap-5 shrink-0 select-none">
          <RailTab value="presets" label="Presets" icon="sparkles" />
          <RailTab value="metadata" label="Header" icon="type" />
          <RailTab value="data" label="Data" icon="grid" />
          <RailTab value="style" label="Style" icon="sliders" />
          <RailTab value="canvas" label="Canvas" icon="layout" />
        </div>

        {/* Scrollable form body */}
        <div class="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar flex flex-col gap-4 md:gap-6">
          <div class="hidden md:inline-block text-[10px] font-black text-blueprint-900 dark:text-brand-500 uppercase tracking-widest bg-blueprint-100 dark:bg-brand-500/10 px-2 py-1 w-max mb-[-12px]">Tool Properties</div>

        {/* Presets Category */}
        <div class={editorTab() === 'presets' ? 'flex flex-col gap-5 md:gap-6 shrink-0 animate-fade-in' : 'hidden'}>
          {/* Built-in Preset Templates */}
          <div class="flex flex-col gap-3 shrink-0">
            <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Preset Templates</h2>
            <div class="grid grid-cols-2 gap-2">
              {Object.entries(CHART_PRESETS).map(([key, preset]) => {
                const isActive = () => activePreset() === key;
                return (
                  <button
                    onClick={() => handleLoadPreset(key, preset)}
                    class={`px-3 py-2.5 text-left text-xs font-bold transition-all duration-200 flex flex-col gap-0.5 relative group shadow-sm cursor-pointer rounded-xl border ${
                      isActive()
                        ? 'bg-blueprint-50/70 border-blueprint-900 dark:bg-brand-500/10 dark:border-brand-500 text-blueprint-900 dark:text-brand-500 ring-2 ring-blueprint-900/10 dark:ring-brand-500/20'
                        : 'bg-slate-50 hover:bg-blueprint-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 border-blueprint-200 dark:border-zinc-800 text-slate-700 dark:text-text-main'
                    }`}
                  >
                    <span class="truncate pr-2">{preset.title}</span>
                    <span class={`text-[8px] uppercase tracking-wider font-normal ${isActive() ? 'text-blueprint-700 dark:text-brand-400' : 'text-slate-400 dark:text-text-muted'}`}>{preset.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Presets */}
          <div class="flex flex-col gap-3 shrink-0">
            <div class="flex items-center justify-between">
              <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Custom Presets</h2>
              <button
                onClick={handleSaveCustomPreset}
                class="px-2.5 py-1 bg-blueprint-900 dark:bg-brand-500 text-white font-bold text-[9px] uppercase tracking-widest shadow-sm hover:scale-105 transition cursor-pointer rounded-lg"
              >
                + Save Current
              </button>
            </div>
            {customPresets().length === 0 ? (
              <div class="p-4 border border-dashed border-blueprint-200 dark:border-zinc-800 text-center text-[10px] text-slate-400 dark:text-text-muted font-medium bg-slate-50/50 dark:bg-zinc-900/30 rounded-xl">
                No custom presets saved.
              </div>
            ) : (
              <div class="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar">
                {customPresets().map((preset, idx) => {
                  const isActive = () => activePreset() === preset.name;
                  return (
                    <div
                      onClick={() => handleLoadCustomPreset(preset.name, preset.data)}
                      class={`px-3 py-2.5 text-left text-xs font-bold transition-all duration-200 flex flex-col gap-0.5 relative group shadow-sm cursor-pointer rounded-xl border justify-between ${
                        isActive()
                          ? 'bg-blueprint-50/70 border-blueprint-900 dark:bg-brand-500/10 dark:border-brand-500 text-blueprint-900 dark:text-brand-500 ring-2 ring-blueprint-900/10 dark:ring-brand-500/20'
                          : 'bg-slate-50 hover:bg-blueprint-50/50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50 border-blueprint-200 dark:border-zinc-800 text-slate-700 dark:text-text-main'
                      }`}
                    >
                      <span class="truncate pr-4">{preset.name}</span>
                      <span class={`text-[8px] uppercase tracking-wider font-normal ${isActive() ? 'text-blueprint-700 dark:text-brand-400' : 'text-slate-400 dark:text-text-muted'}`}>{preset.data.type}</span>
                      <button
                        onClick={(e) => handleDeleteCustomPreset(e, idx)}
                        class="absolute top-1.5 right-1.5 text-slate-400 hover:text-brand-red opacity-0 group-hover:opacity-100 transition p-0.5"
                        title="Delete Preset"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div class="hidden"></div>

        {/* Content Editor */}
        <div class={editorTab() === 'metadata' ? 'flex flex-col gap-3 shrink-0 animate-fade-in' : 'hidden'}>
          <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Chart Metadata</h2>

          <div class="flex items-center gap-3">
            <button
              onClick={() => handleUpdateOptions({ showTitle: !chartStore.options.showTitle })}
              class={`relative w-8.5 h-5 transition-colors duration-200 rounded-full border shrink-0 cursor-pointer ${chartStore.options.showTitle ? 'bg-blueprint-900 border-blueprint-950 dark:bg-brand-500 dark:border-brand-600' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-750'}`}
              type="button"
              title="Toggle Title"
            >
              <div class={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${chartStore.options.showTitle ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
            </button>
            <input type="text" value={chartStore.title} onInput={(e) => handleUpdateMetadata({ title: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-sm text-slate-900 dark:text-text-main font-semibold outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all placeholder:font-normal rounded-lg" placeholder="Chart Title" />
          </div>
          <div class="flex items-center gap-3">
            <button
              onClick={() => handleUpdateOptions({ showSubtitle: !chartStore.options.showSubtitle })}
              class={`relative w-8.5 h-5 transition-colors duration-200 rounded-full border shrink-0 cursor-pointer ${chartStore.options.showSubtitle ? 'bg-blueprint-900 border-blueprint-950 dark:bg-brand-500 dark:border-brand-600' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-750'}`}
              type="button"
              title="Toggle Subtitle"
            >
              <div class={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${chartStore.options.showSubtitle ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
            </button>
            <input type="text" value={chartStore.subtitle} onInput={(e) => handleUpdateMetadata({ subtitle: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-text-main outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all rounded-lg" placeholder="Chart Subtitle" />
          </div>
          <div class="flex items-center gap-3">
            <button
              onClick={() => handleUpdateOptions({ showSource: !chartStore.options.showSource })}
              class={`relative w-8.5 h-5 transition-colors duration-200 rounded-full border shrink-0 cursor-pointer ${chartStore.options.showSource ? 'bg-blueprint-900 border-blueprint-950 dark:bg-brand-500 dark:border-brand-600' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-750'}`}
              type="button"
              title="Toggle Source"
            >
              <div class={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform duration-200 ${chartStore.options.showSource ? 'translate-x-4.5' : 'translate-x-0.5'}`}></div>
            </button>
            <input type="text" value={chartStore.source} onInput={(e) => handleUpdateMetadata({ source: e.currentTarget.value })} class="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-text-muted uppercase font-medium outline-none focus:ring-1 focus:ring-blueprint-900 dark:focus:ring-brand-500 focus:border-blueprint-900 dark:focus:border-brand-500 transition-all rounded-lg" placeholder="Source Attribution" />
          </div>
        </div>

        <div class="hidden"></div>

        {/* Enhanced Data Editor */}
        <div class={editorTab() === 'data' ? 'flex flex-col gap-3 flex-1 min-h-[200px] md:min-h-[240px] animate-fade-in' : 'hidden'}>
          <div class="flex items-center justify-between">
            <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Chart Data</h2>
            <div class="flex bg-slate-100 dark:bg-zinc-900 p-1 border border-blueprint-200 dark:border-zinc-800 rounded-lg">
              <button onClick={() => setActiveTab('grid')} class={`px-3 py-1 text-[10px] font-bold transition rounded-md ${activeTab() === 'grid' ? 'text-white bg-blueprint-900 dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main'}`}>Grid View</button>
              <button onClick={() => setActiveTab('csv')} class={`px-3 py-1 text-[10px] font-bold transition rounded-md ${activeTab() === 'csv' ? 'text-white bg-blueprint-900 dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main'}`}>Raw CSV</button>
            </div>
          </div>

          {activeTab() === 'csv' && (
            <div class="flex flex-col gap-2 flex-1">
              <p class="text-[10px] text-slate-500 dark:text-text-muted font-medium">Format: Label, Series1, Series2..., #Color (optional).</p>
              <textarea
                value={chartStore.rawData}
                onInput={(e) => handleUpdateMetadata({ rawData: e.currentTarget.value })}
                class="w-full h-48 flex-1 p-3 border border-blueprint-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-[12px] text-slate-800 dark:text-text-main font-mono outline-none focus:border-blueprint-900 dark:focus:border-brand-500 resize-none whitespace-pre transition-colors leading-relaxed rounded-xl"
                spellcheck="false"
              ></textarea>
            </div>
          )}
          {activeTab() === 'grid' && (
            <div class="flex flex-col items-center justify-center flex-1 border border-dashed border-blueprint-200 dark:border-zinc-800 bg-blueprint-50 dark:bg-zinc-900/35 p-6 text-center rounded-xl">
              <p class="text-sm font-bold text-blueprint-900 dark:text-brand-500">Grid View Coming Soon</p>
              <p class="text-xs text-slate-500 dark:text-text-muted mt-2">Please use the Raw CSV editor for now to manage your dataset.</p>
            </div>
          )}
        </div>

        <div class="hidden"></div>

        {/* Appearance Settings */}
        <div class={editorTab() === 'style' ? 'flex flex-col gap-5 shrink-0 animate-fade-in' : 'hidden'}>
          <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Layout & Style</h2>

          {/* LAYOUT SUB-TAB CONTAINER */}
          <div class={styleSubTab() === 'layout' ? 'flex flex-col gap-4 animate-fade-in' : 'hidden md:flex md:flex-col md:gap-4'}>
            {/* Toggles Grid */}
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1 mb-2">
              <ToggleSwitch label="Grid" checked={chartStore.options.showGrid} onChange={(v) => handleUpdateOptions({ showGrid: v })} />
              <ToggleSwitch label="Legend" checked={chartStore.options.showLegend} onChange={(v) => handleUpdateOptions({ showLegend: v })} />
              <ToggleSwitch label="Values" checked={chartStore.options.showValues} onChange={(v) => handleUpdateOptions({ showValues: v })} />
              <ToggleSwitch label="X-Axis" checked={chartStore.options.showXAxis} onChange={(v) => handleUpdateOptions({ showXAxis: v })} />
              <ToggleSwitch label="Y-Axis" checked={chartStore.options.showYAxis} onChange={(v) => handleUpdateOptions({ showYAxis: v })} />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Chart Type</label>
                <select value={chartStore.type} onInput={(e) => handleUpdateMetadata({ type: e.currentTarget.value as ChartType })} class="w-full px-2 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
                  <option value="vertical">Vertical Bar</option>
                  <option value="horizontal">Horizontal Bar</option>
                  <option value="multiline">Multi-Line</option>
                  <option value="stacked">Stacked Bar</option>
                  <option value="pie">Pie Chart</option>
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Legend Pos</label>
                <select value={chartStore.options.legendPosition || 'bottom'} onInput={(e) => handleUpdateOptions({ legendPosition: e.currentTarget.value as any })} class="w-full px-2 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
                  <option value="bottom">Bottom Horiz</option>
                  <option value="top-right">Top Right Vert</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Font Family</label>
                <select value={chartStore.options.fontFamily} onInput={(e) => handleUpdateOptions({ fontFamily: e.currentTarget.value })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
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
                <select value={chartStore.options.valueFormat} onInput={(e) => handleUpdateOptions({ valueFormat: e.currentTarget.value as any })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
                  <option value="number">Plain Number</option>
                  <option value="currency">$ Currency</option>
                  <option value="percent">% Percentage</option>
                </select>
              </div>
            </div>
          </div>

          {/* COLORS SUB-TAB CONTAINER */}
          <div class={styleSubTab() === 'colors' ? 'flex flex-col gap-4 animate-fade-in' : 'hidden md:flex md:flex-col md:gap-4'}>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Color Palette</label>
              <select value={chartStore.options.colorPalette} onInput={(e) => handleUpdateOptions({ colorPalette: e.currentTarget.value as ColorPalette })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
                <option value="vibrant">Vibrant</option>
                <option value="pastel">Pastel Colors</option>
                <option value="neon">Cyberpunk Neon</option>
                <option value="sunset">Sunset Glow</option>
                <option value="ocean">Deep Ocean</option>
              </select>
            </div>

            {/* Custom Colors */}
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Canvas BG</label>
                <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden rounded-lg"><input type="color" value={chartStore.options.bgColor} onInput={(e) => handleUpdateOptions({ bgColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Title Color</label>
                <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden rounded-lg"><input type="color" value={chartStore.options.titleColor} onInput={(e) => handleUpdateOptions({ titleColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
              </div>
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Text Color</label>
                <div class="relative w-full h-8 border border-blueprint-200 dark:border-zinc-800 overflow-hidden rounded-lg"><input type="color" value={chartStore.options.textColor} onInput={(e) => handleUpdateOptions({ textColor: e.currentTarget.value })} class="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer" /></div>
              </div>
            </div>
          </div>

          {/* MOTION & VIEW SUB-TAB CONTAINER */}
          <div class={styleSubTab() === 'motion' ? 'flex flex-col gap-4 animate-fade-in' : 'hidden md:flex md:flex-col md:gap-4'}>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Source Position</label>
                <select value={chartStore.options.sourcePosition || 'left'} onInput={(e) => handleUpdateOptions({ sourcePosition: e.currentTarget.value as any })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer rounded-lg">
                  <option value="left">Bottom Left</option>
                  <option value="right">Bottom Right</option>
                </select>
              </div>
              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500">Source Top Gap</label>
                  <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.sourcePadding ?? 40}px</span>
                </div>
                <input type="range" min="10" max="150" step="5" value={chartStore.options.sourcePadding ?? 40} onInput={(e) => handleUpdateOptions({ sourcePadding: parseInt(e.currentTarget.value) })} class="w-full h-8 accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
              </div>
            </div>

            <div class="flex flex-col p-3 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800 rounded-xl">
              <div class="flex justify-between items-center mb-2">
                <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Chart Bottom Gap</label>
                <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.chartBottomGap ?? 40}px</span>
              </div>
              <input type="range" min="10" max="150" step="5" value={chartStore.options.chartBottomGap ?? 40} onInput={(e) => handleUpdateOptions({ chartBottomGap: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
            </div>

            {/* Animation Duration */}
            <div class="flex flex-col p-3 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800 rounded-xl">
              <div class="flex justify-between items-center mb-2">
                <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Animation Duration</label>
                <span class="text-[10px] font-bold text-slate-500 dark:text-text-muted">{chartStore.options.duration || 5}s</span>
              </div>
              <input type="range" min="1" max="15" step="0.5" value={chartStore.options.duration || 5} onInput={(e) => handleUpdateOptions({ duration: parseFloat(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
            </div>
          </div>

        </div>

        <div class="hidden"></div>

        {/* Canvas tab */}
        <div class={editorTab() === 'canvas' ? 'flex flex-col gap-5 md:gap-6 shrink-0 animate-fade-in' : 'hidden'}>
          <h2 class="hidden md:block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Canvas & Aspect Ratio</h2>

          {/* Aspect Ratio Cards Grid */}
          <div class="flex flex-col gap-3">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500">Screen Ratio</label>
            <div class="grid grid-cols-2 gap-2">
              <AspectRatioCard value="16:9" label="16:9 Landscape" shape="w-8 h-4.5" orientation="Horizontal Video" />
              <AspectRatioCard value="9:16" label="9:16 Portrait" shape="w-4.5 h-8" orientation="TikTok & Shorts" />
              <AspectRatioCard value="1:1" label="1:1 Square" shape="w-6 h-6" orientation="Instagram Feed" />
              <AspectRatioCard value="4:5" label="4:5 Portrait" shape="w-6.5 h-8" orientation="Social Media" />
              <AspectRatioCard value="3:4" label="3:4 Standard" shape="w-6 h-8" orientation="Pinterest Pin" />
              <AspectRatioCard value="4:3" label="4:3 Standard" shape="w-8 h-6" orientation="Classic Desktop" />
              <AspectRatioCard value="2:1" label="2:1 Panoramic" shape="w-8 h-4" orientation="Panoramic Banner" />
            </div>
          </div>

          <div class="w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

          {/* Zoom & Pan (Moved from style tab to keep layout concise) */}
          <div class="flex flex-col p-4 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 rounded-xl">
            <div class="flex justify-between items-center mb-4">
              <label class="block text-[10px] font-bold uppercase tracking-widest text-blueprint-900 dark:text-brand-500">Zoom & Pan View</label>
              <button onClick={() => handleUpdateOptions({ zoom: 1.0, panX: 0, panY: 0 })} class="text-[10px] font-bold text-blueprint-500 dark:text-text-muted hover:text-blueprint-900 dark:hover:text-brand-500 flex items-center gap-1 transition uppercase cursor-pointer">Reset</button>
            </div>
            <div class="flex flex-col gap-4">
              <div>
                <div class="flex justify-between items-center mb-1.5">
                  <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Zoom Level</label>
                  <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.zoom.toFixed(1)}x</span>
                </div>
                <input type="range" min="0.5" max="3" step="0.1" value={chartStore.options.zoom} onInput={(e) => handleUpdateOptions({ zoom: parseFloat(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="flex justify-between items-center mb-1.5">
                    <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Pan X</label>
                    <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.panX}</span>
                  </div>
                  <input type="range" min="-1000" max="1000" step="10" value={chartStore.options.panX} onInput={(e) => handleUpdateOptions({ panX: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
                </div>
                <div>
                  <div class="flex justify-between items-center mb-1.5">
                    <label class="block text-[10px] font-bold text-slate-500 dark:text-text-muted uppercase tracking-wider">Pan Y</label>
                    <span class="text-[10px] text-blueprint-900 dark:text-brand-500 font-bold">{chartStore.options.panY}</span>
                  </div>
                  <input type="range" min="-1000" max="1000" step="10" value={chartStore.options.panY} onInput={(e) => handleUpdateOptions({ panY: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-900 dark:accent-brand-500 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>

        {/* Mobile Navigation Deck (Fixed/Sticky at the bottom of the drawer on mobile, hidden on desktop) */}
        <div class="md:hidden border-t border-blueprint-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950 flex flex-col gap-2 shrink-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          {/* STYLE Sub-tabs (Only visible when main editorTab is 'style') */}
          <Show when={editorTab() === 'style'}>
            <div class="flex items-center bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg gap-1 border border-slate-200/50 dark:border-zinc-800 animate-fade-in">
              <button
                onClick={() => setStyleSubTab('layout')}
                class={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider text-center transition-all rounded-md ${styleSubTab() === 'layout' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
              >
                Layout
              </button>
              <button
                onClick={() => setStyleSubTab('colors')}
                class={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider text-center transition-all rounded-md ${styleSubTab() === 'colors' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
              >
                Colors
              </button>
              <button
                onClick={() => setStyleSubTab('motion')}
                class={`flex-1 py-1 text-[9px] font-black uppercase tracking-wider text-center transition-all rounded-md ${styleSubTab() === 'motion' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
              >
                Motion
              </button>
            </div>
          </Show>

          {/* Main Category Tabs */}
          <div class="flex items-center bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 p-1 gap-1 rounded-lg">
            <button
              onClick={() => setEditorTab('presets')}
              class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'presets' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
            >
              Presets
            </button>
            <button
              onClick={() => setEditorTab('metadata')}
              class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'metadata' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
            >
              Metadata
            </button>
            <button
              onClick={() => setEditorTab('data')}
              class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'data' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
            >
              Data
            </button>
            <button
              onClick={() => setEditorTab('style')}
              class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'style' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
            >
              Style
            </button>
            <button
              onClick={() => setEditorTab('canvas')}
              class={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-all rounded-md ${editorTab() === 'canvas' ? 'bg-blueprint-900 text-white dark:bg-brand-500 shadow-[1px_1px_0px_#000]' : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'}`}
            >
              Canvas
            </button>
          </div>
        </div>
      </aside>

      {/* CANVAS AREA (Right / Top on Mobile) */}
      <section class="flex-1 h-[55vh] md:h-full order-first md:order-last relative overflow-hidden flex items-center justify-center p-4 sm:p-12 pb-16">
        <div
          ref={canvasContainerRef}
          class={`relative p-2 bg-white dark:bg-zinc-900 border-2 border-blueprint-900 dark:border-zinc-800 blueprint-shadow transition-all duration-300 ${
            isFullscreen() ? '!w-full !h-full !flex !items-center !justify-center !bg-zinc-950 !border-none !p-0' : ''
          }`}
        >
          {/* Mobile Fullscreen Control (Visible only on mobile, when not in fullscreen, in bottom-right corner of canvas container) */}
          <Show when={!isFullscreen()}>
            <button
              onClick={toggleFullscreen}
              class="absolute bottom-3 right-3 md:hidden z-20 flex items-center justify-center bg-black/60 dark:bg-zinc-900/80 backdrop-blur-md w-9 h-9 rounded-lg border border-white/10 dark:border-zinc-800/50 shadow-lg active:scale-95 hover:scale-105 transition-all cursor-pointer animate-fade-in select-none"
              title="Enter Fullscreen"
              type="button"
            >
              <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          </Show>

          {/* Fullscreen Close Button (Only visible in Fullscreen Mode, bottom-right) */}
          <Show when={isFullscreen()}>
            <button
              onClick={toggleFullscreen}
              class="absolute bottom-6 right-6 z-30 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 hover:border-white/20 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group animate-fade-in"
              title="Exit Fullscreen"
              type="button"
            >
              <svg class="w-5 h-5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            </button>
          </Show>

          {/* Fullscreen Play/Pause Button (Only visible in Fullscreen Mode, bottom-left) */}
          <Show when={isFullscreen()}>
            <button
              onClick={handlePlayPause}
              class="absolute bottom-6 left-6 z-30 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 hover:border-white/20 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group animate-fade-in"
              title={isPlaying() ? "Pause Animation" : "Play Animation"}
              type="button"
            >
              <Show when={isPlaying()} fallback={
                <svg class="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }>
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </Show>
            </button>
          </Show>

          {/* Dynamic Interactive Canvas */}
          <canvas 
            ref={canvasRef} 
            class={`block bg-white dark:bg-black object-contain transition-opacity duration-500 ease-in-out ${isLoaded() ? 'opacity-100' : 'opacity-0'}`}
          ></canvas>

          {/* High-Fidelity SVG Skeleton Loader */}
          <div 
            class={`absolute inset-0 w-full h-full flex flex-col justify-between p-[8%] bg-white dark:bg-black animate-pulse pointer-events-none select-none transition-opacity duration-500 ease-in-out ${isLoaded() ? 'opacity-0' : 'opacity-100'}`}
            style={{ "background-color": chartStore.options.bgColor }}
          >
            {/* Skeleton Header (Title & Subtitle) */}
            <div class="space-y-2 text-left">
              <div class="h-6 w-1/3 bg-black/10 dark:bg-white/10 rounded-lg"></div>
              <div class="h-4 w-1/2 bg-black/5 dark:bg-white/5 rounded-md"></div>
            </div>

            {/* Skeleton Chart Content (Bars, Pie or Lines based on active type) */}
            <div class="flex-1 w-full flex items-end justify-between gap-6 py-8">
              <Show when={chartStore.type === 'vertical' || chartStore.type === 'stacked'}>
                {/* Bar Chart Skeletons */}
                <div class="h-[60%] w-1/4 bg-black/10 dark:bg-white/10 rounded-t-lg"></div>
                <div class="h-[80%] w-1/4 bg-black/10 dark:bg-white/10 rounded-t-lg"></div>
                <div class="h-[45%] w-1/4 bg-black/10 dark:bg-white/10 rounded-t-lg"></div>
                <div class="h-[90%] w-1/4 bg-black/10 dark:bg-white/10 rounded-t-lg"></div>
              </Show>

              <Show when={chartStore.type === 'horizontal'}>
                {/* Horizontal Bar Skeletons */}
                <div class="flex-1 flex flex-col gap-4 justify-center h-full">
                  <div class="h-6 w-[70%] bg-black/10 dark:bg-white/10 rounded-r-lg"></div>
                  <div class="h-6 w-[85%] bg-black/10 dark:bg-white/10 rounded-r-lg"></div>
                  <div class="h-6 w-[55%] bg-black/10 dark:bg-white/10 rounded-r-lg"></div>
                  <div class="h-6 w-[90%] bg-black/10 dark:bg-white/10 rounded-r-lg"></div>
                </div>
              </Show>

              <Show when={chartStore.type === 'pie'}>
                {/* Pie Chart Skeleton */}
                <div class="flex-1 flex items-center justify-center">
                  <div class="w-40 h-40 rounded-full border-8 border-dashed border-black/10 dark:border-white/10 flex items-center justify-center">
                    <div class="w-20 h-20 rounded-full border-4 border-black/5 dark:border-white/5"></div>
                  </div>
                </div>
              </Show>

              <Show when={chartStore.type === 'multiline'}>
                {/* Line Chart Skeleton */}
                <div class="flex-1 h-full relative">
                  <svg class="absolute inset-0 w-full h-full text-black/10 dark:text-white/10" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M 0,80 Q 25,20 50,60 T 100,10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                    <path d="M 0,90 Q 25,40 50,75 T 100,30" fill="none" stroke="currentColor" stroke-dasharray="2,2" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </div>
              </Show>
            </div>

            {/* Skeleton Footer (Source) */}
            <div class="flex justify-between items-center border-t border-black/[0.06] dark:border-white/[0.06] pt-3">
              <div class="h-3 w-1/4 bg-black/5 dark:bg-white/5 rounded-md"></div>
              <div class="h-3 w-16 bg-black/10 dark:bg-white/10 rounded-md"></div>
            </div>
          </div>
        </div>

        {/* Mobile Centered Play/Pause Control (Visible only on mobile, when not in fullscreen, centered below canvas area) */}
        <Show when={!isFullscreen()}>
          <div class="absolute bottom-3 left-0 right-0 flex items-center justify-center md:hidden z-20 animate-fade-in select-none">
            <button
              onClick={handlePlayPause}
              class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main border border-blueprint-200 dark:border-zinc-800 shadow-md active:scale-95 transition-all cursor-pointer"
              title={isPlaying() ? "Pause Animation" : "Play Animation"}
              type="button"
            >
              <Show when={isPlaying()} fallback={
                <svg class="w-4 h-4 fill-current ml-0.5 text-slate-700 dark:text-text-main" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }>
                <svg class="w-4 h-4 fill-current text-brand-500 animate-pulse" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </Show>
            </button>
          </div>
        </Show>
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
          {/* Group 1: Canvas Utilities */}
          {/* Aspect Ratio Selector Dropdown */}
          <div class="hidden md:flex relative items-center bg-slate-100 dark:bg-zinc-900/50 rounded-lg border border-slate-200 dark:border-zinc-800 px-2 sm:px-3 py-1.5 gap-1 sm:gap-1.5 shadow-sm">
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

          {/* Divider */}
          <div class="hidden md:block w-[1px] h-4 bg-slate-200 dark:bg-zinc-800 mx-0.5"></div>

          {/* Group 2: Interactive Playback */}
          {/* Preview/Play Button */}
          <button
            onClick={handlePlayPause}
            class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main font-bold text-[10px] sm:text-xs uppercase tracking-widest transition border border-blueprint-200 dark:border-zinc-800 cursor-pointer shadow-sm"
            title={isPlaying() ? "Pause Animation Preview" : "Play Animation Preview"}
          >
            <Show when={isPlaying()} fallback={
              <Icon name="play" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" />
            }>
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-500 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </Show>
            <span class="hidden sm:inline">{isPlaying() ? 'Pause' : 'Preview'}</span>
          </button>

          {/* Fullscreen Trigger Button */}
          <button
            onClick={toggleFullscreen}
            class="hidden md:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main font-bold transition border border-blueprint-200 dark:border-zinc-800 cursor-pointer shadow-sm shrink-0"
            title="Toggle Fullscreen"
            type="button"
          >
            <Show when={isFullscreen()} fallback={
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            }>
              <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
            </Show>
          </button>

          {/* Divider */}
          <div class="hidden md:block w-[1px] h-4 bg-slate-200 dark:bg-zinc-800 mx-0.5"></div>

          {/* Group 3: Outputs & Exports */}
          {/* Camera Snapshot Button */}
          <button
            onClick={() => setIsExportingSnapshot(true)}
            class="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-text-main font-bold text-[10px] sm:text-xs uppercase tracking-widest transition border border-blueprint-200 dark:border-zinc-800 cursor-pointer shadow-sm"
            title="Export High-Res PNG Snapshot"
          >
            <Icon name="camera" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-text-muted" />
            <span class="hidden sm:inline">Camera Snapshot</span>
          </button>

          {/* Export Video Button */}
          <button
            onClick={() => setIsExporting(true)}
            class="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-md bg-blueprint-900 hover:bg-blueprint-800 dark:bg-brand-500 dark:hover:bg-brand-600 font-bold text-[10px] sm:text-xs uppercase tracking-widest transition cursor-pointer shadow-md shrink-0"
            title="Export Video Animation"
            style={{ color: isDarkTheme() ? '#09090b' : '#ffffff' }}
          >
            <Icon name="export" class={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isDarkTheme() ? 'text-zinc-950' : 'text-white'}`} />
            <span class="hidden sm:inline">Export Video</span>
            <span class="inline sm:hidden">Export</span>
          </button>
        </div>
      </Portal>
    </div>
  );
}
