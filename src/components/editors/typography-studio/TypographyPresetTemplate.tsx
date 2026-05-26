import { createEffect, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { typographyStore, setTypographyStore, serializeTypographyState, updateTypographyGlobal } from '@/store/typographyStore';
import { isDarkTheme } from '@/store/global';
import { TypographyEngine } from '@/engines/typography-studio/TypographyEngine';
import { TYPOGRAPHY_PRESETS } from '@/engines/typography-studio/presets';

const getPresetBySlug = (slug: string) => {
  const preset = TYPOGRAPHY_PRESETS[slug];
  if (preset) return preset;
  return TYPOGRAPHY_PRESETS['sam-hogan-drop'];
};

export default function TypographyPresetTemplate(props: { slug: string }) {
  let canvasRef!: HTMLCanvasElement;
  let engine: TypographyEngine;
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [transitionUrl, setTransitionUrl] = createSignal('/editor/typography-studio');
  const [portalTarget, setPortalTarget] = createSignal<HTMLElement | undefined>(undefined);

  const [isPlaying, setIsPlaying] = createSignal(false);
  let playTimeoutId: any = null;

  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  let canvasContainerRef!: HTMLDivElement;

  // Hydrate Store
  const presetData = getPresetBySlug(props.slug);
  setTypographyStore({
      width: presetData.width,
      height: presetData.height,
      bgColor: presetData.bgColor,
      duration: presetData.duration || 5.0,
      elements: JSON.parse(JSON.stringify(presetData.elements)),
      time: 0,
      isPlaying: false,
      selectedId: null
  });

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

      const durationMs = (typographyStore.duration || 5) * 1000;
      playTimeoutId = setTimeout(() => {
        setIsPlaying(false);
        playTimeoutId = null;
      }, durationMs);
    }
  };

  onMount(() => {
    engine = new TypographyEngine(canvasRef);
    handleResize();

    // Fade in canvas smoothly by waiting for next paint
    requestAnimationFrame(() => {
        setIsLoaded(true);
    });

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        if (engine) engine.render();
      });
    }

    window.addEventListener('resize', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

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
    if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', handleFullscreenChange);
    if (engine) engine.pause();
    if (playTimeoutId) clearTimeout(playTimeoutId);
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    let renderW = 1920;
    let renderH = 1080;

    const ratio = aspectRatio();
    if (ratio === '9:16') { renderW = 1080; renderH = 1920; } 
    else if (ratio === '1:1') { renderW = 1080; renderH = 1080; } 
    else if (ratio === '4:5') { renderW = 1080; renderH = 1350; }

    engine.setDimensions(renderW, renderH, window.devicePixelRatio || 1);
  };

  createEffect(() => {
    aspectRatio();
    if (isLoaded() && engine) {
      requestAnimationFrame(() => handleResize());
    }
  });

  createEffect(() => {
    if (isLoaded() && engine) {
      const snapshot = JSON.parse(JSON.stringify(typographyStore));
      engine.updateState(snapshot);

      const encoded = serializeTypographyState();
      setTransitionUrl(`/canvas.labs/editor/typography-studio?config=${encoded}`);

      const astroBtn = document.getElementById('btn-open-advanced');
      if (astroBtn) astroBtn.setAttribute('href', `/canvas.labs/editor/typography-studio?config=${encoded}`);
    }
  });

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
              onClick={() => {}}
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

      <a
        href={`${import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL}/?category=typography`}
        class="hidden lg:flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-main transition-colors w-fit group cursor-pointer"
      >
        <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
        </svg>
        Back to Typography
      </a>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left panel: Preview Canvas Frame */}
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div
            ref={canvasContainerRef}
            class={`rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative transition-all duration-300 ${
              isFullscreen()
                ? '!w-full !h-full !aspect-none !rounded-none !bg-zinc-950 !border-none !p-0'
                : aspectRatio() === '9:16'
                  ? 'aspect-[9/16] h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto'
                  : aspectRatio() === '1:1'
                    ? 'aspect-square h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto'
                    : aspectRatio() === '4:5'
                      ? 'aspect-[4/5] h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto'
                      : 'aspect-video w-full'
            }`}
            style={{ "background-color": typographyStore.bgColor }}
          >
            {/* Fullscreen Close Button */}
            <Show when={isFullscreen()}>
              <button
                onClick={toggleFullscreen}
                class="absolute bottom-6 right-6 z-30 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 hover:border-white/20 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group animate-fade-in"
                title="Exit Fullscreen"
              >
                <svg class="w-5 h-5 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
                </svg>
              </button>
            </Show>

            {/* Fullscreen Play/Pause Button */}
            <Show when={isFullscreen()}>
              <button
                onClick={handlePlayPause}
                class="absolute bottom-6 left-6 z-30 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 hover:border-white/20 text-white rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group animate-fade-in"
                title={isPlaying() ? "Pause Animation" : "Play Animation"}
              >
                <Show when={isPlaying()} fallback={<svg class="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>}>
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                </Show>
              </button>
            </Show>

            <canvas
              ref={canvasRef}
              class={`w-full h-full object-contain transition-opacity duration-500 ease-in-out ${isLoaded() ? 'opacity-100' : 'opacity-0'}`}
            ></canvas>

            <div class={`absolute inset-0 w-full h-full flex flex-col justify-center items-center pointer-events-none select-none transition-all duration-500 ease-in-out ${isLoaded() ? 'opacity-0 invisible' : 'opacity-100 animate-pulse'}`}>
              <div class="h-12 w-2/3 bg-black/10 dark:bg-white/10 rounded-lg mb-4"></div>
              <div class="h-12 w-1/2 bg-black/10 dark:bg-white/10 rounded-lg"></div>
            </div>
          </div>
          
          {/* Playback Controls matching Charts */}
          <div class="flex items-center justify-between text-sm text-text-muted px-2">
            <div class="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
                class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors cursor-pointer flex-shrink-0"
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
              
              <button
                onClick={toggleFullscreen}
                class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors cursor-pointer group flex-shrink-0"
                title="Fullscreen Mode"
                type="button"
              >
                <svg class="w-4 h-4 text-text-muted hover:text-brand-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>

              <div class="h-1.5 w-32 md:w-64 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0">
                <div class="h-full bg-brand-500" style={{ width: "0%" }}></div>
              </div>
              <span class="font-mono text-xs text-brand-500">Preview Mode</span>
            </div>
            <div class="hidden sm:flex items-center gap-3 text-xs">
              <span>{typographyStore.duration || 5}s Duration</span>
              <span>•</span>
              <span>SolidJS Engine</span>
            </div>
          </div>
        </div>

        {/* Right panel: Adjustments Controls */}
        <div class="flex flex-col gap-6 bg-card-bg border border-border-color p-6 rounded-2xl shadow-sm">
          <div class="hidden lg:block">
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
              Typography Studio
            </span>
            <h2 class="text-2xl font-extrabold text-text-main mt-3 tracking-tight capitalize">
              {props.slug.replace(/-/g, ' ')}
            </h2>
            <p class="text-xs text-text-muted leading-relaxed mt-1.5">
              Make quick visual tweaks. Click 'Open in Full Editor' to customize text, fonts, colors, and animation timings.
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
              onClick={() => {}}
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

            <div class="space-y-4 pt-2">
               <div>
                  <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2">Preview Aspect Ratio</label>
                  <div class="grid grid-cols-4 gap-2">
                    {['16:9', '9:16', '1:1', '4:5'].map(ratio => (
                      <button
                        onClick={() => setAspectRatio(ratio as any)}
                        class={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                          aspectRatio() === ratio 
                            ? 'bg-brand-500 text-white border-brand-500 shadow-sm' 
                            : 'bg-black/5 dark:bg-white/5 border-border-color text-text-main hover:border-brand-500/30'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
               </div>
               
               <div class="grid grid-cols-2 gap-3.5 pt-2">
                 <div>
                    <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Background</label>
                    <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl">
                       <input 
                          type="color" 
                          value={typographyStore.bgColor}
                          onInput={(e) => updateTypographyGlobal({ bgColor: e.currentTarget.value })}
                          class="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border border-border-color bg-transparent"
                       />
                       <span class="text-xs font-mono font-bold uppercase truncate">{typographyStore.bgColor}</span>
                    </div>
                 </div>

                 <div>
                    <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Duration (s)</label>
                    <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl h-11">
                       <input 
                          type="number" 
                          step="0.5"
                          value={typographyStore.duration || 5}
                          onInput={(e) => updateTypographyGlobal({ duration: parseFloat(e.currentTarget.value) || 5 })}
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
