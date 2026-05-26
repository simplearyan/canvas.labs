import { createEffect, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { typographyStore, setTypographyStore, serializeTypographyState, updateTypographyGlobal, updateTypographyElement } from '@/store/typographyStore';
import type { TypographyTextElement } from '@/engines/typography-studio/types';
import { isDarkTheme } from '@/store/global';
import { TypographyEngine } from '@/engines/typography-studio/TypographyEngine';
import { TYPOGRAPHY_PRESETS } from '@/engines/typography-studio/presets';
import ExportModal from '@/components/common/ExportModal';
import { typographyExportProject } from '@/engines/typography-studio/ExportEngine';

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

  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'text' | 'settings' | 'ratio' | 'format'>('text');
  let canvasContainerRef!: HTMLDivElement;

  createEffect(() => {
    const selectedId = typographyStore.selectedId;
    if (selectedId) {
      setActiveTab('format');
    } else {
      if (activeTab() === 'format') {
        setActiveTab('text');
      }
    }
  });

  // Hydrate Store
  const presetData = getPresetBySlug(props.slug);
  const initialDuration = presetData.duration || 5.0;
  setTypographyStore({
      width: presetData.width,
      height: presetData.height,
      bgColor: presetData.bgColor,
      duration: initialDuration,
      elements: JSON.parse(JSON.stringify(presetData.elements)),
      time: initialDuration,
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

  let isDragging = false;
  let isRotating = false;
  let activeHandle: string | null = null;
  let dragOffset = { x: 0, y: 0 };
  let initialFontSize = 100;
  let initialW = 100;
  let initialH = 100;
  let initialDistance = 0;

  const handleCanvasPointerDown = (e: PointerEvent) => {
    if (!engine) return;
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = typographyStore.width / rect.width;
    const scaleY = typographyStore.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // 1. If there is a selected element, first hit test its handles
    const selectedId = typographyStore.selectedId;
    if (selectedId) {
      const handles = engine.getElementHandles(selectedId);
      if (handles) {
        const tolerance = e.pointerType === 'touch' ? 24 : 12;
        const hitHandle = handles.find(h => Math.hypot(x - h.x, y - h.y) <= tolerance);
        if (hitHandle) {
          const el = typographyStore.elements.find(el => el.id === selectedId);
          if (el && !el.locked) {
            activeHandle = hitHandle.name;
            if (activeHandle === 'rot') {
              isRotating = true;
            } else {
              initialDistance = Math.hypot(x - el.x, y - el.y);
              if (el.type === 'text') {
                initialFontSize = el.fontSize;
              } else if (el.type === 'shape') {
                initialW = el.w;
                initialH = el.h;
              }
            }
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch (err) {}
            return;
          }
        }
      }
    }

    // 2. Standard element selection / dragging hit test
    const hitId = engine.hitTest(x, y);
    if (hitId) {
      updateTypographyGlobal({ selectedId: hitId });
      const el = typographyStore.elements.find(e => e.id === hitId);
      if (el && !el.locked) {
        isDragging = true;
        dragOffset = { x: el.x - x, y: el.y - y };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    } else {
      updateTypographyGlobal({ selectedId: null });
    }
  };

  const handleCanvasPointerMove = (e: PointerEvent) => {
    if (!engine || !typographyStore.selectedId) return;
    
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = typographyStore.width / rect.width;
    const scaleY = typographyStore.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const el = typographyStore.elements.find(el => el.id === typographyStore.selectedId);
    if (!el || el.locked) return;

    if (isRotating) {
      const angleRad = Math.atan2(y - el.y, x - el.x);
      let angleDeg = angleRad * 180 / Math.PI;
      angleDeg = Math.round(angleDeg + 90);
      updateTypographyElement(el.id, { rotation: angleDeg });
    } else if (activeHandle) {
      const currentDistance = Math.hypot(x - el.x, y - el.y);
      const scaleRatio = currentDistance / (initialDistance || 1);

      if (el.type === 'text') {
        const newFontSize = Math.max(10, Math.round(initialFontSize * scaleRatio));
        updateTypographyElement(el.id, { fontSize: newFontSize });
      } else if (el.type === 'shape') {
        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(activeHandle);
        const isWidth = ['ml', 'mr'].includes(activeHandle);
        const isHeight = ['tc', 'bc'].includes(activeHandle);
        
        const rad = (el.rotation || 0) * Math.PI / 180;
        const dx = x - el.x;
        const dy = y - el.y;

        if (isCorner) {
          const newW = Math.max(10, Math.round(initialW * scaleRatio));
          const newH = Math.max(10, Math.round(initialH * scaleRatio));
          updateTypographyElement(el.id, { w: newW, h: newH });
        } else if (isWidth) {
          const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
          const newW = Math.max(10, Math.round(Math.abs(localX) * 2 - 20));
          updateTypographyElement(el.id, { w: newW });
        } else if (isHeight) {
          const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
          const newH = Math.max(10, Math.round(Math.abs(localY) * 2 - 20));
          updateTypographyElement(el.id, { h: newH });
        }
      }
    } else if (isDragging) {
      updateTypographyElement(el.id, {
        x: x + dragOffset.x,
        y: y + dragOffset.y
      });
    }
  };

  const handleCanvasPointerUp = (e: PointerEvent) => {
    isDragging = false;
    isRotating = false;
    activeHandle = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
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
    } else {
      if (typographyStore.time >= (typographyStore.duration || 5)) {
        updateTypographyGlobal({ time: 0 });
        engine.seek(0);
      }
      engine.play();
      setIsPlaying(true);
    }
  };

  onMount(() => {
    engine = new TypographyEngine(canvasRef);

    engine.onTimeUpdate = (time) => {
      updateTypographyGlobal({ time });
      if (time >= (typographyStore.duration || 5)) {
        setIsPlaying(false);
      }
    };

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
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    let renderW = 1920;
    let renderH = 1080;

    const ratio = aspectRatio();
    if (ratio === '9:16') { renderW = 1080; renderH = 1920; } 
    else if (ratio === '1:1') { renderW = 1080; renderH = 1080; } 
    else if (ratio === '4:5') { renderW = 1080; renderH = 1350; }

    updateTypographyGlobal({ width: renderW, height: renderH });
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
      // Explicitly track layout, design properties, and selection state (excluding time)
      const trackState = {
        width: typographyStore.width,
        height: typographyStore.height,
        bgColor: typographyStore.bgColor,
        duration: typographyStore.duration,
        elements: typographyStore.elements,
        selectedId: typographyStore.selectedId
      };

      const snapshot = JSON.parse(JSON.stringify(trackState));

      // Do not re-apply state if we are currently playing to avoid interrupting the loop
      if (!isPlaying()) {
        const fullSnapshot = { ...snapshot, time: typographyStore.time };
        engine.updateState(fullSnapshot);
      }

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
            class={`rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative ${
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
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              class={`w-full h-full object-contain cursor-pointer transition-opacity duration-500 ease-in-out ${isLoaded() ? 'opacity-100' : 'opacity-0'}`}
              style={{ "touch-action": "none" }}
            ></canvas>

            {/* Floating Context Toolbar */}
            <Show when={typographyStore.selectedId}>
              {() => {
                const el = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId);
                return (
                  <Show when={el()}>
                    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden lg:flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/15 px-3 py-1.5 rounded-full shadow-2xl animate-fade-in pointer-events-auto">
                      <span class="text-[9px] font-black text-white/50 uppercase tracking-widest px-2.5 border-r border-white/10 select-none">
                        {el()?.type === 'text' ? 'Text' : 'Shape'}
                      </span>
                      
                      {/* Align Horizontally */}
                      <button
                        onClick={() => updateTypographyElement(typographyStore.selectedId!, { x: typographyStore.width / 2 })}
                        class="p-2 hover:bg-white/10 text-white/80 hover:text-brand-500 rounded-full transition-all duration-200 cursor-pointer group"
                        title="Align Center Horizontal"
                        type="button"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="12" y1="2" x2="12" y2="22" />
                          <rect x="5" y="8" width="14" height="8" rx="1.5" />
                        </svg>
                      </button>

                      {/* Align Vertically */}
                      <button
                        onClick={() => updateTypographyElement(typographyStore.selectedId!, { y: typographyStore.height / 2 })}
                        class="p-2 hover:bg-white/10 text-white/80 hover:text-brand-500 rounded-full transition-all duration-200 cursor-pointer group"
                        title="Align Center Vertical"
                        type="button"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <rect x="8" y="5" width="8" height="14" rx="1.5" />
                        </svg>
                      </button>

                      <div class="h-4 w-px bg-white/10 mx-1"></div>

                      {/* Rotation Controls (with discrete premium rotation buttons) */}
                      <button
                        onClick={() => {
                          const currentRot = el()?.rotation || 0;
                          updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot - 45) % 360 });
                        }}
                        class="p-2 hover:bg-white/10 text-white/80 hover:text-brand-500 rounded-full transition-all duration-200 cursor-pointer"
                        title="Rotate -45°"
                        type="button"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                      </button>

                      <div class="flex items-center gap-1.5 px-2 bg-white/5 border border-white/10 rounded-full h-8">
                        <button
                          onClick={() => updateTypographyElement(typographyStore.selectedId!, { rotation: 0 })}
                          class="p-0.5 hover:bg-white/10 rounded text-white/60 hover:text-brand-500 transition-colors cursor-pointer group flex items-center justify-center"
                          title="Reset Rotation to 0°"
                          type="button"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                          </svg>
                        </button>
                        <input
                          type="number"
                          value={el()?.rotation || 0}
                          onInput={(e) => updateTypographyElement(typographyStore.selectedId!, { rotation: parseInt(e.currentTarget.value) || 0 })}
                          class="w-9 bg-transparent border-none text-center font-mono text-[11px] font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span class="text-[10px] font-bold text-white/40 select-none">°</span>
                      </div>

                      <button
                        onClick={() => {
                          const currentRot = el()?.rotation || 0;
                          updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot + 45) % 360 });
                        }}
                        class="p-2 hover:bg-white/10 text-white/80 hover:text-brand-500 rounded-full transition-all duration-200 cursor-pointer"
                        title="Rotate +45°"
                        type="button"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </button>

                      {/* Deselect element */}
                      <div class="h-4 w-px bg-white/10 mx-1"></div>
                      <button
                        onClick={() => updateTypographyGlobal({ selectedId: null })}
                        class="p-2 hover:bg-white/10 text-white/60 hover:text-red-400 rounded-full transition-all duration-200 cursor-pointer"
                        title="Clear Selection"
                        type="button"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </Show>
                );
              }}
            </Show>

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
                <div class="h-full bg-brand-500" style={{ width: `${((typographyStore.time) / (typographyStore.duration || 5)) * 100}%` }}></div>
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
                onClick={() => setActiveTab('text')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'text'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Customize Text
              </button>

              <Show when={typographyStore.selectedId}>
                <button
                  onClick={() => setActiveTab('format')}
                  class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'format'
                      ? 'border-brand-500 text-brand-500'
                      : 'border-transparent text-text-muted hover:text-text-main'
                    }`}
                >
                  Format Selection
                </button>
              </Show>

              <button
                onClick={() => setActiveTab('settings')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'settings'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Settings
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

            <div class="space-y-4 pt-2">
              {/* Context-Based Format Section - Tab 4 (only visible when selected, slides in stacked on desktop) */}
              <Show when={typographyStore.selectedId}>
                <div class={`space-y-5 animate-fade-in ${
                  activeTab() === 'format' ? 'block' : 'hidden lg:block'
                }`}>
                  
                  {/* Alignment Section */}
                  <div class="space-y-2">
                    <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Alignment</label>
                    <div class="grid grid-cols-2 gap-2.5">
                      {/* Align Horizontal */}
                      <button
                        onClick={() => updateTypographyElement(typographyStore.selectedId!, { x: typographyStore.width / 2 })}
                        class="flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-border-color hover:border-brand-500 dark:hover:border-brand-500/50 hover:bg-brand-500/5 dark:hover:bg-brand-500/10 rounded-xl text-xs font-bold text-text-main transition-all cursor-pointer active:scale-95"
                        type="button"
                      >
                        <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="12" y1="2" x2="12" y2="22" />
                          <rect x="5" y="8" width="14" height="8" rx="1.5" />
                        </svg>
                        Center Horiz.
                      </button>
                      {/* Align Vertical */}
                      <button
                        onClick={() => updateTypographyElement(typographyStore.selectedId!, { y: typographyStore.height / 2 })}
                        class="flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-zinc-900/50 border border-border-color hover:border-brand-500 dark:hover:border-brand-500/50 hover:bg-brand-500/5 dark:hover:bg-brand-500/10 rounded-xl text-xs font-bold text-text-main transition-all cursor-pointer active:scale-95"
                        type="button"
                      >
                        <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <rect x="8" y="5" width="8" height="14" rx="1.5" />
                        </svg>
                        Center Vert.
                      </button>
                    </div>
                  </div>

                  {/* Rotation Adjustments */}
                  <div class="space-y-2">
                    <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Rotation Angle</label>
                    <div class="flex items-center gap-2.5">
                      <button
                        onClick={() => {
                          const currentRot = typographyStore.elements.find(e => e.id === typographyStore.selectedId)?.rotation || 0;
                          updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot - 45) % 360 });
                        }}
                        class="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-zinc-900/50 border border-border-color hover:border-brand-500 text-text-muted hover:text-brand-500 rounded-xl transition-all cursor-pointer shrink-0 active:scale-90"
                        type="button"
                        title="Rotate -45°"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                      </button>

                      <div class="flex-1 flex items-center justify-between gap-3 px-3.5 bg-slate-50 dark:bg-zinc-900/50 border border-border-color rounded-xl h-10">
                        <input
                          type="range"
                          min="-180" max="180"
                          value={typographyStore.elements.find(e => e.id === typographyStore.selectedId)?.rotation || 0}
                          onInput={(e) => updateTypographyElement(typographyStore.selectedId!, { rotation: parseInt(e.currentTarget.value) || 0 })}
                          class="w-full accent-brand-500 cursor-pointer"
                        />
                        <span class="font-mono text-xs font-bold text-text-main shrink-0 min-w-8 text-right">
                          {typographyStore.elements.find(e => e.id === typographyStore.selectedId)?.rotation || 0}°
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const currentRot = typographyStore.elements.find(e => e.id === typographyStore.selectedId)?.rotation || 0;
                          updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot + 45) % 360 });
                        }}
                        class="w-10 h-10 flex items-center justify-center bg-slate-50 dark:bg-zinc-900/50 border border-border-color hover:border-brand-500 text-text-muted hover:text-brand-500 rounded-xl transition-all cursor-pointer shrink-0 active:scale-90"
                        type="button"
                        title="Rotate +45°"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div class="pt-2">
                    <button
                      onClick={() => updateTypographyGlobal({ selectedId: null })}
                      class="w-full py-2.5 bg-black/5 dark:bg-white/5 border border-border-color hover:border-red-500/50 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-xl text-xs font-bold text-text-muted hover:text-red-500 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                      type="button"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      Deselect Layer
                    </button>
                  </div>

                </div>
              </Show>

              {/* Text Content Inputs - Tab 1 (fully reactive direct iteration to fix empty textarea input bug) */}
              <div class={`space-y-3.5 pb-2 lg:block ${activeTab() === 'text' ? 'block' : 'hidden'}`}>
                <For each={typographyStore.elements}>
                  {(el) => (
                    <Show when={el.type === 'text'}>
                      {(() => {
                        const isSelected = () => typographyStore.selectedId === el.id;
                        return (
                          <div class={`space-y-1.5 p-3 rounded-xl border transition-all ${
                            isSelected() 
                              ? 'border-brand-500 bg-brand-500/5 dark:bg-brand-500/10 shadow-sm animate-fade-in' 
                              : 'border-border-color bg-black/5 dark:bg-white/5'
                          }`}>
                            <div class="flex items-center justify-between">
                              <span class="text-[10px] font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                                <svg class="w-3.5 h-3.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                </svg>
                                Edit Text
                              </span>
                              <div class="flex items-center gap-2">
                                {/* Align Horizontally Center */}
                                <button
                                  onClick={() => updateTypographyElement(el.id, { x: typographyStore.width / 2 })}
                                  class="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors text-text-muted hover:text-brand-500 cursor-pointer"
                                  title="Align Horizontally Center"
                                  type="button"
                                >
                                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="2" x2="12" y2="22" />
                                    <rect x="5" y="8" width="14" height="8" rx="1.5" />
                                  </svg>
                                </button>
                                {/* Selection indicator */}
                                <button
                                  onClick={() => updateTypographyGlobal({ selectedId: isSelected() ? null : el.id })}
                                  class={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                                    isSelected()
                                      ? 'bg-brand-500 border-brand-500 text-white shadow-sm font-black'
                                      : 'bg-black/5 dark:bg-white/5 border-border-color text-text-muted hover:text-text-main hover:border-brand-500/30'
                                  }`}
                                  type="button"
                                >
                                  {isSelected() ? 'Selected' : 'Select'}
                                </button>
                              </div>
                            </div>
                            <textarea
                              rows="2"
                              value={(el as TypographyTextElement).text}
                              onInput={(e) => updateTypographyElement(el.id, { text: e.currentTarget.value })}
                              onFocus={() => updateTypographyGlobal({ selectedId: el.id })}
                              class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-border-color rounded-lg text-xs font-semibold text-text-main resize-none focus:outline-none focus:border-brand-500 transition-colors"
                              placeholder="Type text content..."
                            ></textarea>
                          </div>
                        );
                      })()}
                    </Show>
                  )}
                </For>
              </div>

              {/* Aspect Ratio Selector - Tab 2 */}
              <div class={`space-y-3 lg:block ${activeTab() === 'ratio' ? 'block' : 'hidden'}`}>
                <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2">Preview Aspect Ratio</label>
                <div class="grid grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
                  {['16:9', '9:16', '1:1', '4:5'].map(ratio => (
                    <button
                      onClick={() => setAspectRatio(ratio as any)}
                      class={`py-2.5 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer ${
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
              
              {/* Background & Duration Settings - Tab 3 */}
              <div class={`grid grid-cols-2 gap-3.5 lg:block lg:space-y-3.5 lg:border-t border-border-color/50 lg:pt-4 ${activeTab() === 'settings' ? 'grid' : 'hidden'}`}>
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

      <ExportModal 
        isOpen={isExporting()}
        onClose={() => setIsExporting(false)} 
        store={typographyStore}
        aspectRatio={aspectRatio()}
        projectTitle={`Typography_Preset_${props.slug}`}
        onExport={typographyExportProject}
      />
    </div>
  );
}
