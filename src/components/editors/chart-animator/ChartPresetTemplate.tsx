import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { chartStore, setChartStore, serializeChartState, updateChartOptions, updateChartMetadata } from '@/store/chartStore';
import { isDarkTheme } from '@/store/global';
import { ChartEngine } from '@/engines/chart-animator/ChartEngine';
import { CHART_PRESETS } from '@/engines/chart-animator/presets';
import ExportModal from '@/components/common/ExportModal';

const getPresetBySlug = (slug: string) => {
  const preset = CHART_PRESETS[slug];
  if (preset) return preset;

  // Default fallback if slug not found
  return {
    title: 'Custom Chart Data',
    subtitle: 'Editing preset: ' + slug,
    source: 'SOURCE: UNKNOWN',
    type: 'vertical',
    options: { bgColor: '#ffffff', colorPalette: 'pastel', fontFamily: 'Inter' },
    rawData: `Label,Value\nA,10\nB,20`
  };
};

const ToggleSwitch = (props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <label class="flex items-center justify-between px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-border-color hover:border-brand-500/20 transition-all duration-300 cursor-pointer select-none">
      <span class="text-[10px] font-extrabold uppercase tracking-wide text-text-muted mr-2">{props.label}</span>
      <div class="relative inline-block w-8 h-5 transition duration-200 ease-in-out flex-shrink-0">
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.currentTarget.checked)}
          class="opacity-0 w-0 h-0 peer"
        />
        <span class={`absolute cursor-pointer inset-0 rounded-full transition-all duration-300 ${props.checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-zinc-700'}`}>
          <span class={`absolute left-0.5 bottom-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${props.checked ? 'translate-x-3' : 'translate-x-0'}`}></span>
        </span>
      </div>
    </label>
  );
};

const WavyText = (props: { text: string; class?: string }) => {
  return (
    <span class={`letter-wave ${props.class || ''}`}>
      {props.text.split('').map((char, index) => (
        <span style={{ "animation-delay": `${index * 0.05}s` }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

export default function ChartPresetTemplate(props: { slug: string }) {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [transitionUrl, setTransitionUrl] = createSignal('/editor/chart-animator');
  const [portalTarget, setPortalTarget] = createSignal<HTMLElement | undefined>(undefined);

  // Export State Toggle
  const [isExporting, setIsExporting] = createSignal(false);

  // Playback Control State
  const [isPlaying, setIsPlaying] = createSignal(false);
  let playTimeoutId: any = null;

  // Active tab state for mobile Quick Adjustments
  const [activeTab, setActiveTab] = createSignal<'general' | 'visibility' | 'ratio'>('general');

  // Canvas aspect ratio state
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');

  // Fullscreen State & Ref
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  let canvasContainerRef!: HTMLDivElement;

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

  onMount(() => {
    // 1. Hydrate the store with the template data
    const presetData = getPresetBySlug(props.slug);
    setChartStore('title', presetData.title);
    setChartStore('subtitle', presetData.subtitle);
    setChartStore('source', presetData.source);
    setChartStore('rawData', presetData.rawData);
    setChartStore('type', presetData.type as any);
    updateChartOptions(presetData.options as any);

    // 2. Initialize Engine
    engine = new ChartEngine(canvasRef);
    setIsLoaded(true);

    handleResize();
    window.addEventListener('resize', handleResize);

    // Listen to fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Wait until #template-header-controls is available in the DOM
    const findTarget = () => {
      const el = document.getElementById('template-header-controls');
      if (el) {
        setPortalTarget(el);
      } else {
        requestAnimationFrame(findTarget);
      }
    };
    findTarget();
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
    const rect = canvasRef.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let renderW = 1920;
    let renderH = 1080;

    const ratio = aspectRatio();
    if (ratio === '9:16') {
      renderW = 1080;
      renderH = 1920;
    } else if (ratio === '1:1') {
      renderW = 1080;
      renderH = 1080;
    } else if (ratio === '4:5') {
      renderW = 1080;
      renderH = 1350;
    }

    engine.setDimensions(renderW, renderH, window.devicePixelRatio || 1);
  };

  createEffect(() => {
    aspectRatio(); // register dependency
    if (isLoaded() && engine) {
      // Let the DOM recalculate the layout first, then resize and re-render
      requestAnimationFrame(() => {
        handleResize();
      });
    }
  });

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
    <div class="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">

      {/* Portal buttons to template-header-controls in Header */}
      <Show when={portalTarget()}>
        <Portal mount={portalTarget()}>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <a
              href={transitionUrl()}
              class="group flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:h-9 text-xs md:text-sm font-semibold text-text-main bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-0 md:px-3.5 border border-border-color rounded-xl hover:border-brand-500 transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-sm"
              title="Open in Full Editor"
            >
              {/* Premium Editor Edit Icon with drawing micro-animation */}
              <svg class="w-4 h-4 text-text-muted group-hover:text-brand-500 transition-colors duration-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path class="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300 origin-bottom-left" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span class="hidden md:inline">Open in Full Editor</span>
            </a>

            <button
              onClick={() => setIsExporting(true)}
              class="group flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:h-9 text-xs md:text-sm font-semibold bg-brand-500 hover:bg-brand-600 px-0 md:px-3.5 border border-transparent rounded-xl transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
              style={{ color: isDarkTheme() ? '#09090b' : '#ffffff' }}
              title="Export Video"
            >
              <svg class="w-4 h-4 fill-current group-hover:translate-y-0.5 transition-transform duration-300 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              <span class="hidden md:inline">Export Video</span>
            </button>
          </div>
        </Portal>
      </Show>

      {/* Breadcrumb Back Button */}
      <a
        href={`${import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL}/?category=charts`}
        class="hidden lg:flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-main transition-colors w-fit group cursor-pointer"
      >
        <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
        </svg>
        Back to Charts
      </a>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Left panel: Preview Canvas Frame */}
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div
            ref={canvasContainerRef}
            class={`rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative fullscreen:w-screen fullscreen:h-screen fullscreen:aspect-none fullscreen:rounded-none fullscreen:bg-zinc-950 fullscreen:border-none ${aspectRatio() === '9:16' ? 'aspect-[9/16] h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto' :
                aspectRatio() === '1:1' ? 'aspect-square h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto' :
                  aspectRatio() === '4:5' ? 'aspect-[4/5] h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto' :
                    'aspect-video w-full'
              }`}
            style={{ "background-color": chartStore.options.bgColor }}
          >
            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              class="absolute top-3 right-3 z-30 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/20 text-white rounded-xl shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer group"
              title={isFullscreen() ? "Exit Fullscreen" : "Fullscreen Mode"}
              type="button"
            >
              <Show when={isFullscreen()} fallback={
                <svg class="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              }>
                <svg class="w-4.5 h-4.5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                </svg>
              </Show>
            </button>

            <canvas
              ref={canvasRef}
              class="w-full h-full object-contain"
            ></canvas>
          </div>

          {/* Playback Controls */}
          <div class="flex items-center justify-between text-sm text-text-muted px-2">
            <div class="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors cursor-pointer"
              >
                <Show when={isPlaying()} fallback={
                  <svg class="w-4 h-4 fill-current ml-0.5 text-text-muted hover:text-brand-500 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                }>
                  <svg class="w-4 h-4 fill-current text-brand-500" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                </Show>
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

          <div class="hidden lg:block">
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

          <div class="hidden lg:flex flex-col gap-2.5">
            <a
              href={transitionUrl()}
              class="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><rect width="14" height="14" x="5" y="5" rx="1" ry="1" />
              </svg>
              Open in Full Editor
            </a>

            <button
              onClick={() => setIsExporting(true)}
              class="w-full border-2 border-brand-500 text-brand-500 hover:bg-brand-500 hover:text-white dark:hover:text-black font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
            >
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
              Export Video
            </button>
          </div>

          <div class="lg:border-t border-border-color/50 lg:pt-5 space-y-4">
            <h3 class="hidden lg:flex font-bold text-xs text-text-main uppercase tracking-widest items-center gap-2">
              <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" x2="20" y1="21" y2="21" /><line x1="4" x2="20" y1="14" y2="14" /><line x1="4" x2="20" y1="7" y2="7" />
              </svg>
              Quick Adjustments
            </h3>

            {/* Tab Switcher - only visible on small screens (< lg) with horizontal scrolling */}
            <div class="flex border-b border-border-color/30 lg:hidden mb-4 overflow-x-auto whitespace-nowrap gap-4 scrollbar-none pb-1">
              <button
                onClick={() => setActiveTab('general')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'general'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('visibility')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'visibility'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Visibility
              </button>
              <button
                onClick={() => setActiveTab('ratio')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'ratio'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Canvas Ratio
              </button>
            </div>

            <div class={`space-y-3.5 lg:block ${activeTab() === 'general' ? 'block' : 'hidden'}`}>
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

            {/* Visibility Toggles Grid */}
            <div class={`lg:border-t border-border-color/50 lg:pt-4 space-y-2.5 lg:block ${activeTab() === 'visibility' ? 'block' : 'hidden'}`}>
              <label class="hidden lg:block text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Visibility Toggles</label>
              <div class="grid grid-cols-2 gap-2.5">
                <ToggleSwitch
                  label="Title"
                  checked={chartStore.options.showTitle}
                  onChange={(val) => updateChartOptions({ showTitle: val })}
                />
                <ToggleSwitch
                  label="Subtitle"
                  checked={chartStore.options.showSubtitle}
                  onChange={(val) => updateChartOptions({ showSubtitle: val })}
                />
                <ToggleSwitch
                  label="Source"
                  checked={chartStore.options.showSource}
                  onChange={(val) => updateChartOptions({ showSource: val })}
                />
                <ToggleSwitch
                  label="Legends"
                  checked={chartStore.options.showLegend}
                  onChange={(val) => updateChartOptions({ showLegend: val })}
                />
                <ToggleSwitch
                  label="X-Axis"
                  checked={chartStore.options.showXAxis}
                  onChange={(val) => updateChartOptions({ showXAxis: val })}
                />
                <ToggleSwitch
                  label="Y-Axis"
                  checked={chartStore.options.showYAxis}
                  onChange={(val) => updateChartOptions({ showYAxis: val })}
                />
                <ToggleSwitch
                  label="Grid Lines"
                  checked={chartStore.options.showGrid}
                  onChange={(val) => updateChartOptions({ showGrid: val })}
                />
                <ToggleSwitch
                  label="Values"
                  checked={chartStore.options.showValues}
                  onChange={(val) => updateChartOptions({ showValues: val })}
                />
              </div>
            </div>

            {/* Aspect Ratio Selector Section */}
            <div class={`lg:border-t border-border-color/50 lg:pt-4 space-y-3 lg:block ${activeTab() === 'ratio' ? 'block' : 'hidden'}`}>
              <label class="hidden lg:block text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Canvas Ratio</label>
              <div class="grid grid-cols-2 gap-3">

                {/* 16:9 */}
                <button
                  onClick={() => setAspectRatio('16:9')}
                  class={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${aspectRatio() === '16:9'
                      ? 'border-brand-500 bg-brand-500/[0.04] text-brand-500'
                      : 'border-border-color bg-black/5 hover:border-brand-500/30 text-text-muted hover:text-text-main'
                    }`}
                >
                  <div class="w-12 h-7 rounded border border-current mb-2 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span class="text-[8px] font-bold">16:9</span>
                  </div>
                  <span class="text-xs font-extrabold tracking-wide">Landscape</span>
                  <span class="text-[9px] text-text-muted mt-0.5 font-semibold">YouTube / Web</span>
                </button>

                {/* 9:16 */}
                <button
                  onClick={() => setAspectRatio('9:16')}
                  class={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${aspectRatio() === '9:16'
                      ? 'border-brand-500 bg-brand-500/[0.04] text-brand-500'
                      : 'border-border-color bg-black/5 hover:border-brand-500/30 text-text-muted hover:text-text-main'
                    }`}
                >
                  <div class="w-7 h-12 rounded border border-current mb-2 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span class="text-[8px] font-bold">9:16</span>
                  </div>
                  <span class="text-xs font-extrabold tracking-wide">Portrait</span>
                  <span class="text-[9px] text-text-muted mt-0.5 font-semibold">Shorts / Reels</span>
                </button>

                {/* 1:1 */}
                <button
                  onClick={() => setAspectRatio('1:1')}
                  class={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${aspectRatio() === '1:1'
                      ? 'border-brand-500 bg-brand-500/[0.04] text-brand-500'
                      : 'border-border-color bg-black/5 hover:border-brand-500/30 text-text-muted hover:text-text-main'
                    }`}
                >
                  <div class="w-9 h-9 rounded border border-current mb-2 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span class="text-[8px] font-bold">1:1</span>
                  </div>
                  <span class="text-xs font-extrabold tracking-wide">Square</span>
                  <span class="text-[9px] text-text-muted mt-0.5 font-semibold">Feed Grid</span>
                </button>

                {/* 4:5 */}
                <button
                  onClick={() => setAspectRatio('4:5')}
                  class={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 cursor-pointer group ${aspectRatio() === '4:5'
                      ? 'border-brand-500 bg-brand-500/[0.04] text-brand-500'
                      : 'border-border-color bg-black/5 hover:border-brand-500/30 text-text-muted hover:text-text-main'
                    }`}
                >
                  <div class="w-8 h-10 rounded border border-current mb-2 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                    <span class="text-[8px] font-bold">4:5</span>
                  </div>
                  <span class="text-xs font-extrabold tracking-wide">Vertical</span>
                  <span class="text-[9px] text-text-muted mt-0.5 font-semibold">Social Post</span>
                </button>

              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Unified Reusable Export Modal */}
      <ExportModal
        isOpen={isExporting()}
        onClose={() => setIsExporting(false)}
        chartStore={chartStore}
        aspectRatio={aspectRatio()}
      />
    </div>
  );
}
