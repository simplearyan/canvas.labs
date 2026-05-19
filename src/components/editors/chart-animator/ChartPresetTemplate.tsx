import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { chartStore, setChartStore, serializeChartState, updateChartOptions } from '../../../store/chartStore';
import { ChartEngine } from '../../../engines/chart-animator/ChartEngine';

// Hardcoded preset logic for now - in production this would fetch from /presets/charts/[slug].json
const getPresetBySlug = (slug: string) => {
  if (slug === 'energy') {
    return {
      title: 'Global Electricity Generation (TWh)',
      subtitle: 'The transition to renewable energy sources.',
      type: 'stacked',
      options: { bgColor: '#f0f4f8', colorPalette: 'vibrant' }
    };
  }
  // Default fallback
  return {
    title: 'Custom Chart Data',
    subtitle: 'Editing preset: ' + slug,
    type: 'vertical',
    options: { bgColor: '#ffffff', colorPalette: 'pastel' }
  };
};

export default function ChartPresetTemplate(props: { slug: string }) {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [transitionUrl, setTransitionUrl] = createSignal('/editor/chart-animator');

  onMount(() => {
    // 1. Hydrate the store with the template data
    const presetData = getPresetBySlug(props.slug);
    setChartStore('title', presetData.title);
    setChartStore('subtitle', presetData.subtitle);
    setChartStore('type', presetData.type as any);
    updateChartOptions(presetData.options as any);

    // 2. Initialize Engine
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
      // Feed engine
      const snapshot = JSON.parse(JSON.stringify(chartStore));
      engine.updateState(snapshot);
      
      // Every time the user changes a setting, immediately update the "Advanced Editor" URL link!
      // This is the core magic of the URL State Persistence.
      const encoded = serializeChartState();
      setTransitionUrl(`/canvas.labs/editor/chart-animator?config=${encoded}`);
      
      // (Optional) sync to the DOM button if rendered outside SolidJS (Astro island bridging)
      const astroBtn = document.getElementById('btn-open-advanced');
      if (astroBtn) {
        astroBtn.setAttribute('href', `/canvas.labs/editor/chart-animator?config=${encoded}`);
      }
    }
  });

  const handlePlay = () => engine.play();

  return (
    <div class="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-6 animate-fade-in flex flex-col overflow-y-auto custom-scrollbar">
      
      {/* Breadcrumb Back Button */}
      <a 
        href="/canvas.labs"
        class="flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-main transition-colors w-fit group cursor-pointer"
      >
        <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
        </svg>
        Back to Charts
      </a>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left panel: Preview Canvas Frame */}
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div 
            class="w-full aspect-video rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative"
            style={{ "background-color": chartStore.options.bgColor }}
          >
            <canvas 
              ref={canvasRef} 
              class="w-full h-full object-contain"
            ></canvas>
          </div>

          {/* Playback Controls */}
          <div class="flex items-center justify-between text-sm text-text-muted px-2">
            <div class="flex items-center gap-4">
              <button 
                onClick={handlePlay}
                class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors cursor-pointer"
              >
                <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <div class="h-1.5 w-32 md:w-64 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-brand-500" style={{ width: "0%" }}></div>
              </div>
              <span class="font-mono text-xs text-brand-500">Preview Mode</span>
            </div>
            <div class="hidden sm:flex items-center gap-3 text-xs">
              <span>{chartStore.options.duration}s Duration</span>
              <span>•</span>
              <span>SolidJS Engine</span>
            </div>
          </div>
        </div>

        {/* Right panel: Adjustments Controls */}
        <div class="flex flex-col gap-6 bg-card-bg border border-border-color p-6 rounded-2xl shadow-sm">
          
          <div>
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
              Chart Animator
            </span>
            <h2 class="text-2xl font-extrabold text-text-main mt-3 tracking-tight capitalize">
              {props.slug} Template
            </h2>
            <p class="text-xs text-text-muted leading-relaxed mt-1.5">
              Make quick visual tweaks. Live updates compile instantly via the Canvas Engine.
            </p>
          </div>

          <a 
            href={transitionUrl()}
            class="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><rect width="14" height="14" x="5" y="5" rx="1" ry="1"/>
            </svg> 
            Open in Full Editor
          </a>

          <div class="border-t border-border-color/50 pt-5 space-y-4">
            <h3 class="font-bold text-xs text-text-main uppercase tracking-widest flex items-center gap-2">
              <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" x2="20" y1="21" y2="21"/><line x1="4" x2="20" y1="14" y2="14"/><line x1="4" x2="20" y1="7" y2="7"/>
              </svg> 
              Quick Adjustments
            </h3>

            <div class="space-y-3.5">
              <div>
                <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Chart Title</label>
                <input 
                  type="text" 
                  value={chartStore.title}
                  onInput={(e) => setChartStore('title', e.currentTarget.value)}
                  class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-xl px-3.5 py-2 text-sm font-semibold text-text-main focus:bg-card-bg focus:border-brand-500 focus:outline-none transition-all"
                />
              </div>
              
              <div class="grid grid-cols-2 gap-3.5">
                <div>
                  <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Background</label>
                  <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl">
                    <input 
                      type="color" 
                      value={chartStore.options.bgColor}
                      onInput={(e) => updateChartOptions({ bgColor: e.currentTarget.value })}
                      class="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border border-border-color"
                    />
                    <span class="text-xs font-mono font-bold uppercase truncate">{chartStore.options.bgColor}</span>
                  </div>
                </div>

                <div>
                  <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Duration (s)</label>
                  <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl h-11">
                    <input 
                      type="number" 
                      min="1" max="15" step="0.5"
                      value={chartStore.options.duration}
                      onInput={(e) => updateChartOptions({ duration: parseFloat(e.currentTarget.value) })}
                      class="w-full bg-transparent text-xs font-mono font-bold uppercase truncate focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
