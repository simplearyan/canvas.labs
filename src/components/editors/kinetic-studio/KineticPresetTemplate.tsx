import { createSignal, createEffect, onCleanup, onMount, Show, createMemo } from 'solid-js';
import { Portal } from 'solid-js/web';
import { deserializeKineticState } from '@/engines/kinetic-studio/KineticEngineUtils';
import { renderFrame, SLIDE_DURATION, kineticHitTest, getKineticElementHandles, getKineticElementBounds } from '@/engines/kinetic-studio/KineticEngine';
import { InteractionController } from '@/engines/core/interaction/InteractionController';
import type { KineticState, KineticSlide } from '@/engines/kinetic-studio/types';
import { isDarkTheme } from '@/store/global';
import { AD_CONFIG } from '@/config/ads';

const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;

const getPresetBySlug = (slug: string): KineticState => {
  return deserializeKineticState(null); 
};

export default function KineticPresetTemplate(props: { slug: string; encodedState?: string }) {
  const [state, setState] = createSignal<KineticState>(
    props.encodedState ? deserializeKineticState(props.encodedState) : getPresetBySlug(props.slug)
  );

  const [isPlaying, setIsPlaying] = createSignal(true);
  const [globalTime, setGlobalTime] = createSignal(0);
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '4:3'>('16:9');
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [portalTarget, setPortalTarget] = createSignal<HTMLElement | undefined>(undefined);
  const [activeElementId, setActiveElementId] = createSignal<string | null>(null);
  const [isEditingCanvasText, setIsEditingCanvasText] = createSignal(false);
  
  let canvasRef: HTMLCanvasElement | undefined;
  let canvasContainerRef: HTMLDivElement | undefined;
  let editTextAreaRef: HTMLTextAreaElement | undefined;
  let animationFrameId: number;
  let lastTimestamp = 0;

  const inlineEditorStyle = createMemo(() => {
    if (!isEditingCanvasText()) return {};
    const id = activeElementId();
    const el = state().slides[activeSlideIndex()]?.elements.find(e => e.id === id) as KineticElement;
    if (!el || el.type !== 'text' || !canvasRef || !canvasContainerRef) return {};
    
    const bounds = getKineticElementBounds(canvasRef.getContext('2d')!, el);
    const rect = canvasContainerRef.getBoundingClientRect();
    const { nativeW, nativeH } = getNativeDims();
    const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
    const offX = (rect.width - nativeW * scale) / 2;
    const offY = (rect.height - nativeH * scale) / 2;

    const left = offX + bounds.x * scale;
    const top = offY + bounds.y * scale;
    const width = bounds.w * scale;
    const height = bounds.h * scale;

    return {
      left: `${left - width / 2}px`,
      top: `${top - height / 2}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform: `rotate(${bounds.rotation}deg)`
    };
  });

  const inlineEditorTextStyle = createMemo(() => {
    if (!isEditingCanvasText()) return {};
    const id = activeElementId();
    const el = state().slides[activeSlideIndex()]?.elements.find(e => e.id === id) as KineticElement;
    if (!el || el.type !== 'text' || !canvasContainerRef) return {};
    
    const rect = canvasContainerRef.getBoundingClientRect();
    const { nativeW, nativeH } = getNativeDims();
    const scale = Math.min(rect.width / nativeW, rect.height / nativeH);

    return {
      color: el.fill || "#ffffff",
      "caret-color": el.fill || "#10b981",
      "font-family": el.font,
      "font-weight": el.fontWeight || "700",
      "font-size": `${el.size * scale}px`,
      padding: `${10 * scale}px`,
    };
  });

  const maxDuration = () => state().slides.length * SLIDE_DURATION;
  const activeSlideIndex = () => Math.floor(globalTime() / SLIDE_DURATION) % Math.max(1, state().slides.length);

  const updateElement = (id: string, updates: any) => {
    setState(prev => {
      const newSlides = [...prev.slides];
      const sIdx = activeSlideIndex();
      newSlides[sIdx] = {
        ...newSlides[sIdx],
        elements: newSlides[sIdx].elements.map(el => el.id === id ? { ...el, ...updates } : el)
      };
      return { ...prev, slides: newSlides };
    });
    requestRender();
  };

  const getNativeDims = () => {
    const aspect = aspectRatio();
    let nativeW = 1920; let nativeH = 1080;
    if (aspect === '9:16') { nativeW = 1080; nativeH = 1920; }
    else if (aspect === '1:1') { nativeW = 1080; nativeH = 1080; }
    else if (aspect === '4:5') { nativeW = 1080; nativeH = 1350; }
    else if (aspect === '4:3') { nativeW = 1440; nativeH = 1080; }
    return { nativeW, nativeH };
  };

  const interactionCtrl = new InteractionController({
    onSelect: (id) => setActiveElementId(id),
    onUpdate: (id, updates) => updateElement(id, updates),
    onDoubleTap: (id) => {
      const el = state().slides[activeSlideIndex()].elements.find(e => e.id === id);
      if (el && el.type === 'text') {
         setIsEditingCanvasText(true);
         setTimeout(() => {
           if (editTextAreaRef) {
             editTextAreaRef.focus();
             editTextAreaRef.select();
           }
         }, 50);
      }
    },
    hitTest: (x, y) => {
      const ctx = canvasRef?.getContext('2d');
      if (!ctx) return null;
      return kineticHitTest(ctx, state().slides[activeSlideIndex()].elements, x, y);
    },
    getHandles: (id) => {
      const el = state().slides[activeSlideIndex()].elements.find(e => e.id === id);
      if (!el) return null;
      const ctx = canvasRef!.getContext('2d')!;
      const { nativeW } = getNativeDims();
      const displayScale = canvasRef!.clientWidth ? (nativeW / canvasRef!.clientWidth) : 1;
      return getKineticElementHandles(ctx, el, displayScale);
    },
    getElementInfo: (id) => {
      const el = state().slides[activeSlideIndex()].elements.find(e => e.id === id);
      if (!el) return null;
      return { x: el.x, y: el.y, rotation: el.rotation || 0, size: el.size, type: el.type };
    }
  });

  createEffect(() => interactionCtrl.setActiveElement(activeElementId()));

  const getCanvasCoords = (e: PointerEvent) => {
    const rect = canvasContainerRef!.getBoundingClientRect();
    const { nativeW, nativeH } = getNativeDims();
    const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
    const offX = (rect.width - nativeW * scale) / 2;
    const offY = (rect.height - nativeH * scale) / 2;
    const x = (e.clientX - rect.left - offX) / scale;
    const y = (e.clientY - rect.top - offY) / scale;
    return { x, y };
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (isPlaying() || !canvasRef || !canvasContainerRef || isEditingCanvasText()) return;
    const { x, y } = getCanvasCoords(e);
    if (interactionCtrl.handlePointerDown(x, y, e.pointerType === 'touch')) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch(err){}
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (isPlaying() || !canvasRef || !canvasContainerRef || isEditingCanvasText()) return;
    const { x, y } = getCanvasCoords(e);
    interactionCtrl.handlePointerMove(x, y);
  };

  const handlePointerUp = (e: PointerEvent) => {
    interactionCtrl.handlePointerUp();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch(err){}
  };

  const requestRender = () => {
    if (!canvasRef || !canvasContainerRef) return;
    const rect = canvasContainerRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const aspect = aspectRatio();
    let nativeW = 1920; let nativeH = 1080;
    if (aspect === '9:16') { nativeW = 1080; nativeH = 1920; }
    else if (aspect === '1:1') { nativeW = 1080; nativeH = 1080; }
    else if (aspect === '4:5') { nativeW = 1080; nativeH = 1350; }
    else if (aspect === '4:3') { nativeW = 1440; nativeH = 1080; }

    const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
    const offsetX = (rect.width - nativeW * scale) / 2;
    const offsetY = (rect.height - nativeH * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const sState = { ...state(), selectedId: activeElementId() }; // pass selection state

    renderFrame(ctx, globalTime(), nativeW, nativeH, sState.slides, false, true, isPlaying(), sState.selectedId, isEditingCanvasText());
  };

  const gameLoop = (timestamp: number) => {
    if (!isPlaying()) { lastTimestamp = timestamp; return; }
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    
    let newTime = globalTime() + dt;
    if (newTime >= maxDuration()) newTime = 0;
    setGlobalTime(newTime);
    
    requestRender();
    animationFrameId = requestAnimationFrame(gameLoop);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying());
    if (isPlaying()) {
      lastTimestamp = performance.now();
      animationFrameId = requestAnimationFrame(gameLoop);
    } else {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      requestRender();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      canvasContainerRef?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  createEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => requestRender(), 100);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    onCleanup(() => document.removeEventListener('fullscreenchange', handleFullscreenChange));
  });

  createEffect(() => {
    const target = document.getElementById('template-header-controls');
    if (target) setPortalTarget(target);
  });

  createEffect(() => {
    state(); globalTime(); aspectRatio();
    requestRender();
  });

  createEffect(() => {
    if (isPlaying()) {
      setTimeout(() => {
        try {
          (window as any).adsbygoogle = (window as any).adsbygoogle || [];
          (window as any).adsbygoogle.push({});
          (window as any).adsbygoogle.push({});
          (window as any).adsbygoogle.push({});
        } catch (_) { }
      }, 500);
    }
  });

  onMount(() => {
    const observer = new ResizeObserver(() => requestRender());
    if (canvasContainerRef) observer.observe(canvasContainerRef);

    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);

    onCleanup(() => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });
  });

  return (
    <div class="w-full flex justify-center items-start gap-4 xl:gap-8 px-2 xl:px-4 relative bg-app-bg min-h-screen">
      <Show when={isPlaying()}>
        <div
          class="hidden 2xl:flex absolute left-4 top-28 shrink-0 flex-col items-center justify-start h-[600px] bg-black/[0.02] dark:bg-white/[0.01] rounded-2xl border border-border-color p-2 overflow-hidden shadow-sm z-10 animate-fade-in"
          style={{ width: 'clamp(90px, 8vw, 150px)' }}
        >
          <span class="text-[8px] font-black text-text-muted uppercase tracking-wider mb-2 select-none">Advertisement</span>
          <ins
            class="adsbygoogle"
            style={{ display: 'block', 'min-width': '90px', width: '100%', height: '560px' }}
            data-ad-client={AD_CONFIG.adsense.clientId}
            data-ad-slot={AD_CONFIG.adsense.slotId}
            data-ad-format="vertical"
            data-full-width-responsive="true"
          ></ins>
        </div>
      </Show>

      <div class="flex-1 max-w-7xl w-full p-3 sm:p-6 md:p-10 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        <Show when={portalTarget()}>
          <Portal mount={portalTarget()}>
            <div class="flex items-center gap-1.5 sm:gap-2">
              <a
                href={`${base}/editor/kinetic-studio`}
                class="group flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:h-9 text-xs md:text-sm font-semibold text-text-main bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 px-0 md:px-3.5 border border-border-color rounded-xl hover:border-brand-500 transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                title="Open in Full Editor"
              >
                <svg class="w-4 h-4 text-text-muted group-hover:text-brand-500 transition-colors duration-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path class="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300 origin-bottom-left" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span class="hidden md:inline">Open in Full Editor</span>
              </a>
            </div>
          </Portal>
        </Show>

        <a
          href={`${base}/?category=kinetic`}
          class="hidden lg:flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-main transition-colors w-fit group cursor-pointer"
        >
          <svg class="w-4 h-4 group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
          </svg>
          Back to Kinetic Studio
        </a>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div class="lg:col-span-2 flex flex-col gap-4">
            <div
              ref={canvasContainerRef}
              class={`rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative bg-black ${isFullscreen()
                ? '!w-full !h-full !aspect-none !rounded-none !bg-zinc-950 !border-none !p-0'
                : aspectRatio() === '9:16'
                  ? 'aspect-[9/16] w-full max-w-[168px] sm:max-w-[253px] md:max-w-[281px] mx-auto'
                  : aspectRatio() === '1:1'
                    ? 'aspect-square w-full max-w-[300px] sm:max-w-[450px] md:max-w-[500px] mx-auto'
                    : aspectRatio() === '4:5'
                      ? 'aspect-[4/5] w-full max-w-[240px] sm:max-w-[360px] md:max-w-[400px] mx-auto'
                      : aspectRatio() === '4:3'
                        ? 'aspect-[4/3] w-full max-w-[400px] sm:max-w-[600px] md:max-w-[666px] mx-auto'
                        : 'aspect-video w-full'
                }`}
            >
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
                class="object-contain"
                style={{ "touch-action": "none" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              ></canvas>

              {/* Direct Inline Bounding Box Editor Overlay */}
              <Show when={isEditingCanvasText()}>
                <>
                  <div
                    onClick={() => setIsEditingCanvasText(false)}
                    class="absolute inset-0 z-40 pointer-events-auto cursor-default"
                  ></div>
                  <div
                    style={{
                      position: 'absolute',
                      "transform-origin": "center center",
                      "pointer-events": "none",
                      "z-index": "45",
                      ...inlineEditorStyle()
                    }}
                    class="animate-pure-scale-in"
                  >
                    <textarea
                      ref={editTextAreaRef!}
                      rows="2"
                      value={(state().slides[activeSlideIndex()]?.elements.find(e => e.id === activeElementId()) as any)?.text || ''}
                      onInput={(e) => updateElement(activeElementId()!, { text: e.currentTarget.value })}
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "transparent",
                        border: "none",
                        resize: "none",
                        outline: "none",
                        "text-align": "center",
                        "line-height": "1",
                        "pointer-events": "auto",
                        overflow: "hidden",
                        "white-space": "pre-wrap",
                        "word-break": "break-word",
                        "box-sizing": "border-box",
                        ...inlineEditorTextStyle()
                      }}
                      class="focus:ring-0 shadow-inner-sm select-text"
                      placeholder="Type text..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          setIsEditingCanvasText(false);
                        }
                      }}
                    />
                  </div>
                </>
              </Show>
            </div>

            {/* Playback Controls */}
            <div class="flex items-center justify-between text-sm text-text-muted px-2">
              <div class="flex items-center gap-4 w-full md:w-auto">
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

                <div class="h-1.5 w-32 md:w-64 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden flex-shrink-0 relative">
                  <div class="absolute h-full bg-brand-500 transition-all duration-75" style={{ width: `${(globalTime() / maxDuration()) * 100}%` }}></div>
                  <input
                    type="range"
                    min="0"
                    max={maxDuration()}
                    step="0.01"
                    value={globalTime()}
                    onInput={(e) => {
                      setGlobalTime(parseFloat(e.currentTarget.value));
                      if (!isPlaying()) requestRender();
                    }}
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <span class="font-mono text-xs text-brand-500">{globalTime().toFixed(1)}s</span>
              </div>
              <div class="hidden sm:flex items-center gap-3 text-xs">
                <span>{maxDuration().toFixed(1)}s Duration</span>
                <span>•</span>
                <span>SolidJS Engine</span>
              </div>
            </div>

            <Show when={isPlaying()}>
              <div class="hidden lg:flex flex-col bg-black/[0.02] dark:bg-white/[0.01] rounded-2xl border border-border-color p-4.5 items-center justify-center shadow-sm w-full h-[122px] overflow-hidden transition-all duration-300 animate-fade-in shrink-0 mt-6">
                <ins
                  class="adsbygoogle"
                  style={{ display: 'inline-block', width: '728px', height: '90px' }}
                  data-ad-client={AD_CONFIG.adsense.clientId}
                  data-ad-slot={AD_CONFIG.adsense.slotId}
                  data-ad-format="horizontal"
                  data-full-width-responsive="true"
                ></ins>
              </div>
            </Show>
          </div>

          <div class="flex flex-col gap-4 sm:gap-6 bg-card-bg border border-border-color p-3 sm:p-6 rounded-2xl shadow-sm">
            <div class="hidden lg:block">
              <span class="text-[10px] font-extrabold uppercase tracking-widest text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                Kinetic Studio
              </span>
              <h2 class="text-2xl font-extrabold text-text-main mt-3 tracking-tight capitalize">
                {props.slug.replace(/-/g, ' ')}
              </h2>
              <p class="text-xs text-text-muted leading-relaxed mt-1.5">
                Make quick visual tweaks. Click 'Open in Full Editor' to customize text, fonts, colors, and animation timings.
              </p>
            </div>

            <div class="flex lg:hidden flex-col gap-1">
               <span class="text-[10px] font-extrabold uppercase tracking-widest text-brand-500">
                Kinetic Studio
              </span>
              <h2 class="text-xl font-extrabold text-text-main tracking-tight capitalize">
                {props.slug.replace(/-/g, ' ')}
              </h2>
            </div>

            <div class="flex flex-col gap-2.5">
              <a
                href={`${base}/editor/kinetic-studio`}
                class="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><rect width="14" height="14" x="5" y="5" rx="1" ry="1" />
                </svg>
                Open in Full Editor
              </a>

              <a
                href={`${base}/editor/kinetic-studio`}
                class="w-full border-2 border-brand-500 text-brand-500 hover:bg-brand-500 hover:text-white dark:hover:text-black font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                Export Video
              </a>
            </div>

            <div class="lg:border-t border-border-color/50 lg:pt-5 space-y-4">
              <h3 class="hidden lg:flex font-bold text-xs text-text-main uppercase tracking-widest items-center gap-2">
                <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="4" x2="20" y1="21" y2="21" /><line x1="4" x2="20" y1="14" y2="14" /><line x1="4" x2="20" y1="7" y2="7" />
                </svg>
                Quick Adjustments
              </h3>

              <div class="space-y-3 lg:block block">
                <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2">Preview Aspect Ratio</label>
                <div class="grid grid-cols-5 lg:grid-cols-2 xl:grid-cols-5 gap-2">
                  {['16:9', '9:16', '1:1', '4:5', '4:3'].map(ratio => (
                    <button
                      onClick={() => setAspectRatio(ratio as any)}
                      class={`py-2.5 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer ${aspectRatio() === ratio
                        ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                        : 'bg-black/5 dark:bg-white/5 border-border-color text-text-main hover:border-brand-500/30'
                        }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Show when={isPlaying()}>
        <div
          class="hidden 2xl:flex absolute right-4 top-28 shrink-0 flex-col items-center justify-start h-[600px] bg-black/[0.02] dark:bg-white/[0.01] rounded-2xl border border-border-color p-2 overflow-hidden shadow-sm z-10 animate-fade-in"
          style={{ width: 'clamp(90px, 8vw, 150px)' }}
        >
          <span class="text-[8px] font-black text-text-muted uppercase tracking-wider mb-2 select-none">Advertisement</span>
          <ins
            class="adsbygoogle"
            style={{ display: 'block', 'min-width': '90px', width: '100%', height: '560px' }}
            data-ad-client={AD_CONFIG.adsense.clientId}
            data-ad-slot={AD_CONFIG.adsense.slotId}
            data-ad-format="vertical"
            data-full-width-responsive="true"
          ></ins>
        </div>
      </Show>
    </div>
  );
}
