import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { chartStore, loadStateFromUrl, updateChartOptions, updateChartMetadata } from '../../../store/chartStore';
import { ChartEngine } from '../../../engines/chart-animator/ChartEngine';
import type { ChartType, ColorPalette } from '../../../engines/chart-animator/types';

export default function ChartEditor() {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;

  const [isLoaded, setIsLoaded] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'grid' | 'csv'>('csv');
  const [isExporting, setIsExporting] = createSignal(false);

  // Parse configuration synchronously on client-side setup before first paint
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    if (encodedConfig) {
      loadStateFromUrl(encodedConfig);
    }
  }

  onMount(() => {
    engine = new ChartEngine(canvasRef);
    setIsLoaded(true);

    handleResize();
    window.addEventListener('resize', handleResize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    if (engine) engine.pause();
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    const parent = canvasRef.parentElement;
    if (parent) {
      const width = parent.clientWidth - 32;
      const height = (width * 9) / 16;
      engine.setDimensions(1920, 1080, window.devicePixelRatio || 1);
      canvasRef.style.width = `${width}px`;
      canvasRef.style.height = `${height}px`;
    }
  };

  createEffect(() => {
    if (isLoaded() && engine) {
      const snapshot = JSON.parse(JSON.stringify(chartStore));
      engine.updateState(snapshot);
    }
  });

  const handlePlay = () => engine.play();

  return (
    <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative text-slate-800 dark:text-text-main blueprint-grid-bg">
      
      {/* TOOLBAR / SIDEBAR (Left Panel) */}
      <aside class="w-full md:w-[420px] bg-white dark:bg-zinc-950 border-b md:border-b-0 md:border-r border-blueprint-900 dark:border-zinc-800 p-5 flex flex-col gap-6 overflow-y-auto z-10 shrink-0 custom-scrollbar shadow-xl">
        
        <div class="text-[10px] font-black text-blueprint-900 dark:text-brand-500 uppercase tracking-widest bg-blueprint-100 dark:bg-brand-500/10 px-2 py-1 inline-block w-max mb-[-12px]">Tool Properties</div>

        {/* Content Editor */}
        <div class="flex flex-col gap-3 shrink-0">
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

        <div class="w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

        {/* Enhanced Data Editor */}
        <div class="flex flex-col gap-3 flex-1 min-h-[240px]">
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

        <div class="w-full border-b border-dashed border-blueprint-300 dark:border-zinc-800"></div>

        {/* Appearance Settings */}
        <div class="flex flex-col gap-5 shrink-0">
          <h2 class="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-text-muted">Layout & Style</h2>
          
          {/* Toggles */}
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-2 mt-1 mb-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-100 dark:border-zinc-800 p-3">
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showGrid} onInput={(e) => updateChartOptions({ showGrid: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Grid</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showLegend} onInput={(e) => updateChartOptions({ showLegend: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Legend</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showValues} onInput={(e) => updateChartOptions({ showValues: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Values</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showXAxis} onInput={(e) => updateChartOptions({ showXAxis: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">X-Axis</span></label>
            <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={chartStore.options.showYAxis} onInput={(e) => updateChartOptions({ showYAxis: e.currentTarget.checked })} class="w-4 h-4 accent-blueprint-900 dark:accent-brand-500 border-blueprint-300 dark:border-zinc-850" /><span class="text-[11px] font-bold text-slate-700 dark:text-text-main uppercase tracking-wider">Y-Axis</span></label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Chart Type</label>
              <select value={chartStore.type} onInput={(e) => updateChartMetadata({ type: e.currentTarget.value as ChartType })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="vertical">Vertical Bar</option>
                <option value="horizontal">Horizontal Bar</option>
                <option value="multiline">Multi-Line Trend</option>
                <option value="stacked">Stacked Bar</option>
                <option value="pie">Pie Chart</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-blueprint-900 dark:text-brand-500 mb-1.5">Color Palette</label>
              <select value={chartStore.options.colorPalette} onInput={(e) => updateChartOptions({ colorPalette: e.currentTarget.value as ColorPalette })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-text-main font-medium outline-none focus:border-blueprint-900 dark:focus:border-brand-500 appearance-none cursor-pointer">
                <option value="vibrant">Vibrant</option>
                <option value="pastel">Pastel Colors</option>
                <option value="neon">Cyberpunk Neon</option>
                <option value="sunset">Sunset Glow</option>
                <option value="ocean">Deep Ocean</option>
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
          
          <div class="flex flex-col sm:flex-row justify-center gap-2 mt-4">
            <button onClick={handlePlay} class="flex items-center justify-center gap-2 px-4 py-3 w-full sm:flex-1 bg-blueprint-100 dark:bg-zinc-900 hover:bg-blueprint-200 dark:hover:bg-zinc-800 text-blueprint-900 dark:text-text-main font-bold text-xs uppercase tracking-widest transition-colors border border-blueprint-300 dark:border-zinc-800">
               Preview
            </button>
            <button onClick={() => setIsExporting(true)} class="flex items-center justify-center gap-2 px-4 py-3 w-full sm:flex-[2] bg-blueprint-900 dark:bg-brand-500 hover:bg-blueprint-800 dark:hover:bg-brand-600 text-white font-black text-sm uppercase tracking-widest transition-colors shadow-lg">
               Export Video
            </button>
          </div>

        </div>
      </aside>

      {/* CANVAS AREA (Right) */}
      <section class="flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-12">
        <div class="relative p-2 bg-white dark:bg-zinc-900 border-2 border-blueprint-900 dark:border-zinc-800 blueprint-shadow">
           <canvas ref={canvasRef} class="block bg-white dark:bg-black w-full max-w-[1200px] aspect-video object-contain"></canvas>
        </div>
      </section>
      
      {/* MINIMAL EXPORT MODAL */}
      {isExporting() && (
        <div class="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity">
          <div class="bg-white border-2 border-blueprint-900 shadow-2xl p-8 max-w-md w-full relative flex flex-col gap-6">
            <button onClick={() => setIsExporting(false)} class="absolute top-4 right-4 text-slate-400 hover:text-brand-red transition">
              ✕
            </button>
            
            <div class="flex flex-col gap-1">
              <h3 class="text-xl font-black text-blueprint-900 uppercase tracking-tighter">Export Animation</h3>
              <p class="text-xs text-slate-500 font-medium">Select your preferred rendering format.</p>
            </div>
            
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-blueprint-900 uppercase tracking-widest">Resolution</label>
                <select class="w-full px-3 py-2 bg-slate-50 border border-blueprint-200 text-sm font-medium outline-none">
                  <option value="1080">1080p (HD)</option>
                  <option value="1440">1440p (2K)</option>
                  <option value="2160">2160p (4K)</option>
                </select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-blueprint-900 uppercase tracking-widest">Format</label>
                <div class="flex gap-2">
                  <button class="flex-1 py-2 border-2 border-blueprint-900 bg-blueprint-50 text-blueprint-900 font-bold text-xs uppercase tracking-wider">WebM</button>
                  <button class="flex-1 py-2 border border-slate-200 bg-white text-slate-500 hover:border-blueprint-300 font-bold text-xs uppercase tracking-wider transition">GIF</button>
                </div>
              </div>
            </div>
            
            <button onClick={() => { alert("Export Pipeline requires Media Bunny Worker integration. Coming next!"); setIsExporting(false); }} class="w-full py-3 bg-brand-red text-white font-black uppercase tracking-widest hover:bg-red-600 transition shadow-[4px_4px_0px_rgba(0,51,102,0.1)] mt-2">
              Start Render
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
