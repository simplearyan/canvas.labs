import { createEffect, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { typographyStore, setTypographyStore, serializeTypographyState, updateTypographyGlobal, updateTypographyElement } from '@/store/typographyStore';
import type { TypographyTextElement } from '@/engines/typography-studio/types';
import { isDarkTheme } from '@/store/global';
import { TypographyEngine } from '@/engines/typography-studio/TypographyEngine';
import { TYPOGRAPHY_PRESETS } from '@/engines/typography-studio/presets';
import ExportModal from '@/components/common/ExportModal';
import { typographyExportProject } from '@/engines/typography-studio/ExportEngine';
import { AD_CONFIG } from '@/config/ads';

const getPresetBySlug = (slug: string) => {
  const preset = TYPOGRAPHY_PRESETS[slug];
  if (preset) return preset;
  return TYPOGRAPHY_PRESETS['sam-hogan-drop'];
};

export default function TypographyPresetTemplate(props: { slug: string }) {
  let canvasRef!: HTMLCanvasElement;
  let editTextAreaRef: HTMLTextAreaElement | undefined;
  let engine: TypographyEngine;
  const [isLoaded, setIsLoaded] = createSignal(false);
  const [transitionUrl, setTransitionUrl] = createSignal('/editor/typography-studio');
  const [portalTarget, setPortalTarget] = createSignal<HTMLElement | undefined>(undefined);

  createEffect(() => {
    if (isEditingCanvasText()) {
      setTimeout(() => {
        if (editTextAreaRef) {
          editTextAreaRef.focus();
          const len = editTextAreaRef.value.length;
          editTextAreaRef.setSelectionRange(len, len);
        }
      }, 60);
    }
  });

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [showCanvasAd, setShowCanvasAd] = createSignal(AD_CONFIG.brandPromo.enabled);

  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '4:3'>('16:9');
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'text' | 'settings' | 'ratio' | 'style'>('text');
  const [activeSlider, setActiveSlider] = createSignal<'none' | 'letterSpacing' | 'wiggle'>('none');
  const [isEditingCanvasText, setIsEditingCanvasText] = createSignal(false);
  const selectedTextElement = () => {
    const id = typographyStore.selectedId;
    if (!id) return null;
    const el = typographyStore.elements.find(e => e.id === id);
    return el && el.type === 'text' ? el : null;
  };
  const [domBounds, setDomBounds] = createSignal<{ left: number, top: number, width: number, height: number, rotation: number, scale: number } | null>(null);

  const updateDomBoundsDirect = () => {
    const el = selectedTextElement();
    if (!el || !canvasRef || !canvasContainerRef || !engine) {
      setDomBounds(null);
      return;
    }
    const containerRect = canvasContainerRef.getBoundingClientRect();
    const canvasRect = canvasRef.getBoundingClientRect();

    const scaleX = canvasRect.width / typographyStore.width;
    const scaleY = canvasRect.height / typographyStore.height;

    const bounds = engine.getElementBounds(el.id);
    if (!bounds) {
      setDomBounds(null);
      return;
    }

    const centerX = canvasRect.left - containerRect.left + (bounds.x * scaleX);
    const centerY = canvasRect.top - containerRect.top + (bounds.y * scaleY);
    const w = bounds.w * scaleX;
    const h = bounds.h * scaleY;

    setDomBounds({
      left: centerX - w / 2,
      top: centerY - h / 2,
      width: w,
      height: h,
      rotation: bounds.rotation,
      scale: scaleX
    });
  };

  const startEditingCanvasText = (elementId: string) => {
    setIsEditingCanvasText(true);
    setTypographyStore('selectedId', elementId);
    
    // Compute the bounds synchronously to prevent any race condition
    const el = typographyStore.elements.find(e => e.id === elementId);
    if (el && el.type === 'text' && canvasRef && canvasContainerRef && engine) {
      const containerRect = canvasContainerRef.getBoundingClientRect();
      const canvasRect = canvasRef.getBoundingClientRect();

      const scaleX = canvasRect.width / typographyStore.width;
      const scaleY = canvasRect.height / typographyStore.height;

      const bounds = engine.getElementBounds(elementId);
      if (bounds) {
        const centerX = canvasRect.left - containerRect.left + (bounds.x * scaleX);
        const centerY = canvasRect.top - containerRect.top + (bounds.y * scaleY);
        const w = bounds.w * scaleX;
        const h = bounds.h * scaleY;

        setDomBounds({
          left: centerX - w / 2,
          top: centerY - h / 2,
          width: w,
          height: h,
          rotation: bounds.rotation,
          scale: scaleX
        });
      }
    }
  };

  createEffect(() => {
    const el = selectedTextElement();
    if (!el || !isLoaded()) {
      setDomBounds(null);
      return;
    }
    aspectRatio();
    isFullscreen();
    
    // Update synchronously on aspect ratio or fullscreen layout shifts
    updateDomBoundsDirect();
  });

  let canvasContainerRef!: HTMLDivElement;
  let prevSelectedId: string | null = null;
  createEffect(() => {
    const selectedId = typographyStore.selectedId;
    setActiveSlider('none'); // Reset floating context slider on select change
    if (selectedId && selectedId !== prevSelectedId) {
      const activeEl = document.activeElement;
      const isTextarea = activeEl && activeEl.tagName === 'TEXTAREA';
      if (!isTextarea && !isEditingCanvasText()) {
        setActiveTab('style');
      }
    }
    prevSelectedId = selectedId;
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

  let lastTapTime = 0;
  let lastTapId: string | null = null;

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
      
      const currentTime = performance.now();
      const tapDelay = currentTime - lastTapTime;
      if (el && el.type === 'text' && hitId === lastTapId && tapDelay < 300) {
        startEditingCanvasText(hitId);
      }
      lastTapTime = currentTime;
      lastTapId = hitId;

      if (el && !el.locked) {
        isDragging = true;
        dragOffset = { x: el.x - x, y: el.y - y };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    } else {
      updateTypographyGlobal({ selectedId: null });
      lastTapId = null;
    }
    updateDomBoundsDirect();
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
    updateDomBoundsDirect();
  };

  const handleCanvasPointerUp = (e: PointerEvent) => {
    isDragging = false;
    isRotating = false;
    activeHandle = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
    updateDomBoundsDirect();
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
    // Register Google AdSense script dynamically
    const ADSENSE_ID = "google-adsense-script";
    if (typeof document !== 'undefined' && !document.getElementById(ADSENSE_ID)) {
      const script = document.createElement("script");
      script.id = ADSENSE_ID;
      script.async = true;
      script.src = `${AD_CONFIG.adsense.scriptUrl}?client=${AD_CONFIG.adsense.clientId}`;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }



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

    // Automation URL parameter parsing for headless preview rendering
    const urlParams = new URLSearchParams(window.location.search);
    const aspect = urlParams.get('aspect');
    const duration = urlParams.get('duration');
    const center = urlParams.get('center');

    if (aspect) {
      setAspectRatio(aspect as any);
    }
    if (duration) {
      const d = parseFloat(duration) || 2.0;
      updateTypographyGlobal({ duration: d, time: d });
    }
    if (center === 'true') {
      setTimeout(() => {
        const currentW = typographyStore.width || 1080;
        const currentH = typographyStore.height || 1080;
        
        const newElements = typographyStore.elements.map(el => ({ ...el }));

        // 1. Center all text and shape layers horizontally
        newElements.forEach(el => {
          if (el.type === 'text' || el.type === 'shape') {
            el.x = currentW / 2;
          }
        });

        // 2. Center vertically as a collective layout group to prevent overlap
        const targetElements = newElements.filter(el => el.type === 'text' || el.type === 'shape');
        if (targetElements.length > 0) {
          const yCoords = targetElements.map(el => el.y);
          const minY = Math.min(...yCoords);
          const maxY = Math.max(...yCoords);
          const groupHeight = maxY - minY;
          const groupCenter = minY + groupHeight / 2;
          const targetCenter = currentH / 2;
          const offsetY = targetCenter - groupCenter;

          newElements.forEach(el => {
            if (el.type === 'text' || el.type === 'shape') {
              el.y += offsetY;
            }
          });
        }

        // Apply centered overrides and clear active selection highlights
        setTypographyStore({ elements: newElements, selectedId: null });
      }, 150);
    }
  });

  onCleanup(() => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
    if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', handleFullscreenChange);
    if (engine) engine.pause();
  });

  const handleResize = () => {
    if (!canvasRef || !engine || !canvasContainerRef) return;
    let renderW = 1920;
    let renderH = 1080;

    const ratio = aspectRatio();
    let targetRatio = 16 / 9;
    if (ratio === '9:16') { renderW = 1080; renderH = 1920; targetRatio = 9 / 16; } 
    else if (ratio === '1:1') { renderW = 1080; renderH = 1080; targetRatio = 1; } 
    else if (ratio === '4:5') { renderW = 1080; renderH = 1350; targetRatio = 4 / 5; }
    else if (ratio === '4:3') { renderW = 1440; renderH = 1080; targetRatio = 4 / 3; }

    const maxW = isFullscreen() ? window.innerWidth : canvasContainerRef.clientWidth;
    const maxH = isFullscreen() ? window.innerHeight : canvasContainerRef.clientHeight;

    let displayW = maxW;
    let displayH = maxH;

    if (maxW / maxH > targetRatio) {
      displayH = maxH;
      displayW = displayH * targetRatio;
    } else {
      displayW = maxW;
      displayH = displayW / targetRatio;
    }

    canvasRef.style.width = `${Math.round(displayW)}px`;
    canvasRef.style.height = `${Math.round(displayH)}px`;

    updateTypographyGlobal({ width: renderW, height: renderH });
    engine.setDimensions(renderW, renderH, window.devicePixelRatio || 1);

    requestAnimationFrame(() => {
      updateDomBoundsDirect();
    });
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
        selectedId: typographyStore.selectedId,
        isEditingText: isEditingCanvasText()
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

      // Synchronously recalculate bounds AFTER the engine has loaded the fresh state
      updateDomBoundsDirect();
    }
  });

  // Load new ads once preset animation starts playing
  createEffect(() => {
    if (isPlaying()) {
      setTimeout(() => {
        try {
          (window as any).adsbygoogle = (window as any).adsbygoogle || [];
          // Hydrate the three playhead-triggered ads (Left Vertical, Right Vertical, Horizontal Leaderboard)
          (window as any).adsbygoogle.push({});
          (window as any).adsbygoogle.push({});
          (window as any).adsbygoogle.push({});
        } catch (_) { }
      }, 500);
    }
  });

  return (
    <div class="w-full flex justify-center items-start gap-4 xl:gap-8 px-2 xl:px-4 relative bg-app-bg min-h-screen">
      
      {/* Left Vertical Skyscraper Ad - only for desktop (2xl and above) */}
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

      {/* Main Content Area */}
      <div class="flex-1 max-w-7xl w-full p-3 sm:p-6 md:p-10 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
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
                      : aspectRatio() === '4:3'
                        ? 'aspect-[4/3] h-[300px] sm:h-[450px] md:h-[500px] w-auto mx-auto'
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

            {/* Desktop Horizontal Promo Ad - Shown when playing and hidden when paused/stopped */}
            <Show when={isPlaying() && !isFullscreen() && showCanvasAd()}>
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-lg bg-neutral-950/85 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2.5 shadow-2xl flex items-center justify-between text-white hidden lg:flex animate-fade-in hover:border-brand-500/40 transition-all duration-300 pointer-events-auto">
                <div class="flex items-center gap-3">
                  <div class={`w-8 h-8 rounded-lg bg-gradient-to-tr ${AD_CONFIG.brandPromo.gradientFrom} ${AD_CONFIG.brandPromo.gradientTo} flex items-center justify-center shadow-md shrink-0`}>
                    <svg class="w-4.5 h-4.5 text-zinc-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                      <line x1="12" y1="22" x2="12" y2="15.5" />
                      <polyline points="22 8.5 12 15.5 2 8.5" />
                      <polyline points="2 15.5 12 8.5 22 15.5" />
                      <line x1="12" y1="2" x2="12" y2="8.5" />
                    </svg>
                  </div>
                  <div class="flex flex-col text-left">
                    <span class="text-[9px] font-black text-brand-500 uppercase tracking-widest leading-none">{AD_CONFIG.brandPromo.brandName}</span>
                    <span class="text-[11px] font-bold text-neutral-200 mt-1 select-none">{AD_CONFIG.brandPromo.promoText}</span>
                  </div>
                </div>
                <a 
                  href={AD_CONFIG.brandPromo.upgradeUrl}
                  class="bg-brand-500 hover:bg-brand-600 text-zinc-950 font-black text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  {AD_CONFIG.brandPromo.buttonText}
                </a>
              </div>
            </Show>

            <canvas
              ref={canvasRef}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              class={`object-contain cursor-pointer transition-opacity duration-500 ease-in-out ${isLoaded() ? 'opacity-100' : 'opacity-0'}`}
              style={{ "touch-action": "none" }}
            ></canvas>

            {/* Direct Inline Bounding Box Editor / Bounding Box Controls */}
            {/* Direct Inline Bounding Box Editor Overlay */}
            <Show when={isEditingCanvasText()}>
              {() => {
                const el = () => selectedTextElement();
                const bounds = () => domBounds();

                return (
                  <Show when={el() && bounds() && !isPlaying()}>
                    {/* Click Outside Invisible Backdrop */}
                    <div 
                      onClick={() => setIsEditingCanvasText(false)}
                      class="absolute inset-0 bg-black/15 z-40 pointer-events-auto cursor-default animate-pure-fade-in"
                    ></div>

                    {/* Rotated & Positioned Input Container exactly matching Bounding Box */}
                    <div 
                      style={{
                        position: 'absolute',
                        left: `${bounds()!.left}px`,
                        top: `${bounds()!.top}px`,
                        width: `${bounds()!.width}px`,
                        height: `${bounds()!.height}px`,
                        transform: `rotate(${bounds()!.rotation}deg)`,
                        "transform-origin": "center center",
                        "pointer-events": "none",
                        "z-index": "45"
                      }}
                      class="animate-pure-scale-in"
                    >
                      <textarea
                        ref={editTextAreaRef}
                        rows="2"
                        value={el()!.text || ''}
                        onInput={(e) => updateTypographyElement(el()!.id, { text: e.currentTarget.value })}
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'transparent',
                          color: el()!.fill || '',
                          "font-family": `"${el()!.fontFamily || ''}"`,
                          "font-size": `${el()!.fontSize * bounds()!.scale}px`,
                          "letter-spacing": `${(el()!.letterSpacing || 0) * bounds()!.scale}px`,
                          "font-weight": el()!.fontWeight || '',
                          "text-align": 'center',
                          "line-height": '1.1',
                          resize: 'none',
                          overflow: 'hidden',
                          outline: 'none',
                          padding: '0px',
                          margin: '0px',
                          "pointer-events": 'auto',
                          "touch-action": 'auto'
                        }}
                        class="border-2 border-dashed border-brand-500 rounded-sm focus:ring-0 focus:border-brand-500 shadow-inner-sm select-text"
                        placeholder="Type text..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setIsEditingCanvasText(false);
                          }
                        }}
                      />

                      {/* Floating circular save/checkmark button in top-right corner */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingCanvasText(false);
                        }}
                        style={{ "pointer-events": "auto" }}
                        class="absolute -top-4.5 -right-4.5 w-9 h-9 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-90 cursor-pointer border-2 border-white dark:border-zinc-950 group/float-save z-50 shrink-0"
                        title="Save changes"
                        type="button"
                      >
                        <svg class="w-4.5 h-4.5 group-hover/float-save:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </div>
                  </Show>
                );
              }}
            </Show>

            {/* Floating Context Toolbar */}
            <Show when={typographyStore.selectedId}>
              {() => {
                const el = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId);
                return (
                  <Show when={el()}>
                    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-30 hidden lg:flex items-center gap-1.5 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 px-3.5 py-1.5 rounded-full shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.5)] animate-fade-in pointer-events-auto transition-all duration-300 text-slate-800 dark:text-text-main">
                      <Show when={activeSlider() === 'none'} fallback={
                        /* In-line Slider Drawer */
                        <div class="flex items-center gap-3 px-1.5 py-0.5 animate-fade-in">
                          <button 
                            onClick={() => setActiveSlider('none')}
                            class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                            title="Back"
                            type="button"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <line x1="19" y1="12" x2="5" y2="12"></line>
                              <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                          </button>
                          
                          <span class="text-[9px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-widest select-none shrink-0 border-r border-slate-200 dark:border-zinc-800 pr-2.5">
                            {activeSlider() === 'letterSpacing' ? 'Spacing' : 'Wiggle'}
                          </span>

                          <input
                            type="range"
                            min={activeSlider() === 'letterSpacing' ? "-10" : "0"}
                            max={activeSlider() === 'letterSpacing' ? "60" : "120"}
                            value={
                              activeSlider() === 'letterSpacing' 
                                ? (el() as TypographyTextElement).letterSpacing || 0 
                                : el()?.animShake !== undefined ? el()?.animShake : 20
                            }
                            onInput={(e) => {
                              const val = parseInt(e.currentTarget.value);
                              if (activeSlider() === 'letterSpacing') {
                                updateTypographyElement(typographyStore.selectedId!, { letterSpacing: val });
                              } else {
                                updateTypographyElement(typographyStore.selectedId!, { animShake: val });
                              }
                            }}
                            class="w-32 md:w-40 h-1.5 accent-brand-600 dark:accent-brand-400 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none"
                          />

                          <span class="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[11px] font-mono font-bold text-brand-600 dark:text-brand-400 min-w-[36px] text-center shrink-0 select-none">
                            {activeSlider() === 'letterSpacing' 
                              ? `${(el() as TypographyTextElement).letterSpacing || 0}px` 
                              : `${el()?.animShake !== undefined ? el()?.animShake : 20}`}
                          </span>

                          <div class="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 shrink-0"></div>

                          <button 
                            onClick={() => setActiveSlider('none')}
                            class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                            title="Close Slider"
                            type="button"
                          >
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </div>
                      }>
                        <span class="px-2.5 py-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800/50 rounded-full text-[9px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest select-none shrink-0">
                          {el()?.type === 'text' ? 'Text' : 'Shape'}
                        </span>
                        
                        <div class="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 shrink-0"></div>

                        {/* Align Horizontally */}
                        <button
                          onClick={() => updateTypographyElement(typographyStore.selectedId!, { x: typographyStore.width / 2 })}
                          class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-full transition-all duration-200 cursor-pointer group flex items-center justify-center shrink-0"
                          title="Align Center Horizontal"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="2" x2="12" y2="22" />
                            <rect x="5" y="8" width="14" height="8" rx="1.5" />
                          </svg>
                        </button>

                        {/* Align Vertically */}
                        <button
                          onClick={() => updateTypographyElement(typographyStore.selectedId!, { y: typographyStore.height / 2 })}
                          class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-full transition-all duration-200 cursor-pointer group flex items-center justify-center shrink-0"
                          title="Align Center Vertical"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <rect x="8" y="5" width="8" height="14" rx="1.5" />
                          </svg>
                        </button>

                        <div class="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 shrink-0"></div>

                        {/* Contextual Properties (Letter Spacing & Wiggle Shake) */}
                        <Show when={el()?.type === 'text'}>
                          <button
                            onClick={() => setActiveSlider('letterSpacing')}
                            class={`p-2 rounded-full transition-all duration-200 cursor-pointer group flex items-center justify-center shrink-0 ${
                              activeSlider() === 'letterSpacing'
                                ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/20'
                                : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400'
                            }`}
                            title="Adjust Letter Spacing"
                            type="button"
                          >
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M4 7V4h16v3" />
                              <path d="M9 20h6" />
                              <path d="M12 4v16" />
                              <path d="m5 12-3 3 3 3" />
                              <path d="m19 12 3 3-3 3" />
                              <path d="M2 15h20" />
                            </svg>
                          </button>
                        </Show>

                        <button
                          onClick={() => setActiveSlider('wiggle')}
                          class={`p-2 rounded-full transition-all duration-200 cursor-pointer group flex items-center justify-center shrink-0 ${
                            activeSlider() === 'wiggle'
                              ? 'bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500/20'
                              : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400'
                          }`}
                          title="Adjust Wiggle Shake"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 12c.6 0 1.2-.4 1.4-1l1.2-4.2c.4-1.2 2-1.2 2.4 0l2 7c.4 1.2 2 1.2 2.4 0l1.2-4.2c.2-.6.8-1 1.4-1h9" />
                          </svg>
                        </button>

                        <div class="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 shrink-0"></div>

                        {/* Rotation Controls (with discrete premium rotation buttons) */}
                        <button
                          onClick={() => {
                            const currentRot = el()?.rotation || 0;
                            updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot - 45) % 360 });
                          }}
                          class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                          title="Rotate -45°"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                        </button>

                        <div class="flex items-center gap-1.5 px-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 rounded-full h-7 shrink-0">
                          <button
                            onClick={() => updateTypographyElement(typographyStore.selectedId!, { rotation: 0 })}
                            class="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded text-slate-400 dark:text-zinc-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer group flex items-center justify-center shrink-0"
                            title="Reset Rotation to 0°"
                            type="button"
                          >
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                          </button>
                          <input
                            type="number"
                            value={el()?.rotation || 0}
                            onInput={(e) => updateTypographyElement(typographyStore.selectedId!, { rotation: parseInt(e.currentTarget.value) || 0 })}
                            class="w-9 bg-transparent border-none text-center font-mono text-[11px] font-extrabold text-slate-800 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span class="text-[10px] font-bold text-slate-400 dark:text-zinc-500 select-none">°</span>
                        </div>

                        <button
                          onClick={() => {
                            const currentRot = el()?.rotation || 0;
                            updateTypographyElement(typographyStore.selectedId!, { rotation: (currentRot + 45) % 360 });
                          }}
                          class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-zinc-300 hover:text-brand-600 dark:hover:text-brand-400 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                          title="Rotate +45°"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        </button>

                        {/* Deselect element */}
                        <div class="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1 shrink-0"></div>
                        <button
                          onClick={() => updateTypographyGlobal({ selectedId: null })}
                          class="p-2 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                          title="Clear Selection"
                          type="button"
                        >
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </Show>
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

          {/* AdSense Horizontal Leaderboard Ad - Shown below the controls only when playing on desktop */}
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

        {/* Right panel: Adjustments Controls */}
        <div class="flex flex-col gap-4 sm:gap-6 bg-card-bg border border-border-color p-3 sm:p-6 rounded-2xl shadow-sm">
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

              <button
                onClick={() => setActiveTab('style')}
                class={`pb-2 text-[11px] font-extrabold uppercase tracking-wider border-b-2 transition-all duration-300 cursor-pointer flex-shrink-0 ${activeTab() === 'style'
                    ? 'border-brand-500 text-brand-500'
                    : 'border-transparent text-text-muted hover:text-text-main'
                  }`}
              >
                Style
              </button>

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

            <div class="space-y-4">
              {/* Context-Based Style Section - always visible on small screens (hidden on desktop) */}
              {(() => {
                  const el = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId) || typographyStore.elements.find(e => e.type === 'text') || typographyStore.elements[0];
                  const [mobileStylePanel, setMobileStylePanel] = createSignal<'none' | 'letterSpacing' | 'wiggle' | 'rotation' | 'dropShadow'>('none');
                  
                  // Auto collapse panel if element type changes
                  createEffect(() => {
                    const type = el()?.type;
                    if (type !== 'text' && mobileStylePanel() === 'letterSpacing') {
                      setMobileStylePanel('none');
                    }
                  });

                  const hasSelection = () => !!typographyStore.selectedId;
                  return (<>
                    <Show when={!hasSelection() && activeTab() === 'style'}>
                      <div class="block lg:hidden py-3 px-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-border-color/20 animate-pure-fade-in">
                        <p class="text-[10px] font-bold text-text-muted uppercase tracking-wider text-center">
                          Tap an element on canvas to style it
                        </p>
                      </div>
                    </Show>
                    <div class={`space-y-4 animate-pure-fade-in ${
                      activeTab() === 'style' ? 'block lg:hidden' : 'hidden'
                    }`}>
                      <Show when={mobileStylePanel() === 'none'} fallback={
                        /* Mobile Slider Views */
                        <Show when={mobileStylePanel() === 'rotation'} fallback={
                          <Show when={mobileStylePanel() === 'dropShadow'} fallback={
                            /* standard letterSpacing or wiggle views */
                            <div class="space-y-4 py-2.5 animate-pure-fade-in">
                              <div class="flex items-center gap-3">
                                <button
                                  onClick={() => setMobileStylePanel('none')}
                                  class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-text-muted hover:text-brand-500 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-zinc-800"
                                  title="Back to Style selection"
                                  type="button"
                                >
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                  </svg>
                                </button>
                                <span class="text-xs font-black text-text-main uppercase tracking-widest select-none">
                                  {mobileStylePanel() === 'letterSpacing' ? 'Character Spacing' : 'Wiggle Intensity'}
                                </span>
                              </div>

                              <div class="w-full border-t border-border-color/30 my-2"></div>

                              <div class="space-y-2">
                                <div class="flex justify-between items-center select-none">
                                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Adjust Parameter</span>
                                  <span class="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[11px] font-mono font-bold text-brand-600 dark:text-brand-400">
                                    {mobileStylePanel() === 'letterSpacing' 
                                      ? `${(el() as TypographyTextElement).letterSpacing || 0}px` 
                                      : `${el()?.animShake !== undefined ? el()?.animShake : 20}`}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={mobileStylePanel() === 'letterSpacing' ? "-10" : "0"}
                                  max={mobileStylePanel() === 'letterSpacing' ? "60" : "120"}
                                  value={
                                    mobileStylePanel() === 'letterSpacing' 
                                      ? (el() as TypographyTextElement).letterSpacing || 0 
                                      : el()?.animShake !== undefined ? el()?.animShake : 20
                                  }
                                  onInput={(e) => {
                                    const val = parseInt(e.currentTarget.value);
                                    if (mobileStylePanel() === 'letterSpacing') {
                                      updateTypographyElement(typographyStore.selectedId!, { letterSpacing: val });
                                    } else {
                                      updateTypographyElement(typographyStore.selectedId!, { animShake: val });
                                    }
                                  }}
                                  class="w-full h-1.5 accent-brand-500 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none"
                                />
                              </div>
                            </div>
                          }>
                            {/* Drop Shadow Slider Panel View */}
                            <div class="space-y-4 py-2.5 animate-pure-fade-in">
                              <div class="flex items-center gap-3">
                                <button
                                  onClick={() => setMobileStylePanel('none')}
                                  class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-text-muted hover:text-brand-500 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-zinc-800"
                                  title="Back to Style selection"
                                  type="button"
                                >
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                  </svg>
                                </button>
                                <span class="text-xs font-black text-text-main uppercase tracking-widest select-none">
                                  Drop Shadow Config
                                </span>
                              </div>

                              <div class="w-full border-t border-border-color/30 my-2"></div>

                              <div class="space-y-3.5">
                                {/* Shadow Color */}
                                <div class="flex items-center justify-between gap-3">
                                  <label class="text-[9px] font-extrabold uppercase tracking-wider text-text-muted select-none">Shadow Color</label>
                                  <div class="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 px-2.5 py-1 rounded-lg shrink-0 shadow-inner-sm">
                                    <input 
                                      type="color" 
                                      value={el().shadowColor || '#000000'}
                                      onInput={(e) => updateTypographyElement(el().id, { shadowColor: e.currentTarget.value })}
                                      class="w-6 h-6 rounded border border-slate-200/60 dark:border-zinc-800 bg-transparent cursor-pointer"
                                    />
                                    <span class="text-[10px] font-mono font-bold uppercase select-all min-w-[50px] text-right">
                                      {el().shadowColor || '#000000'}
                                    </span>
                                  </div>
                                </div>

                                {/* Shadow Blur Slider */}
                                <div class="space-y-1">
                                  <div class="flex justify-between items-center select-none">
                                    <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Blur Radius</label>
                                    <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                      {el().shadowBlur || 0}px
                                    </span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={el().shadowBlur || 0} 
                                    onInput={(e) => updateTypographyElement(el().id, { shadowBlur: parseInt(e.currentTarget.value) })} 
                                    class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                  />
                                </div>

                                {/* Shadow Offset X Slider */}
                                <div class="space-y-1">
                                  <div class="flex justify-between items-center select-none">
                                    <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset X</label>
                                    <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                      {el().shadowOffsetX || 0}px
                                    </span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="-100" 
                                    max="100" 
                                    value={el().shadowOffsetX || 0} 
                                    onInput={(e) => updateTypographyElement(el().id, { shadowOffsetX: parseInt(e.currentTarget.value) })} 
                                    class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                  />
                                </div>

                                {/* Shadow Offset Y Slider */}
                                <div class="space-y-1">
                                  <div class="flex justify-between items-center select-none">
                                    <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset Y</label>
                                    <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                      {el().shadowOffsetY || 0}px
                                    </span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="-100" 
                                    max="100" 
                                    value={el().shadowOffsetY || 0} 
                                    onInput={(e) => updateTypographyElement(el().id, { shadowOffsetY: parseInt(e.currentTarget.value) })} 
                                    class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                  />
                                </div>
                              </div>
                            </div>
                          </Show>
                        }>
                          {/* Rotation Panel View */}
                          <div class="space-y-4 py-2.5 animate-pure-fade-in">
                            <div class="flex items-center gap-3">
                              <button
                                onClick={() => setMobileStylePanel('none')}
                                class="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-text-muted hover:text-brand-500 rounded-xl transition-colors cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/50 dark:border-zinc-800"
                                title="Back to Style selection"
                                type="button"
                              >
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <line x1="19" y1="12" x2="5" y2="12"></line>
                                  <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                              </button>
                              <span class="text-xs font-black text-text-main uppercase tracking-widest select-none">
                                Rotation Angle
                              </span>
                            </div>

                            <div class="w-full border-t border-border-color/30 my-2"></div>

                            <div class="space-y-3.5">
                              <div class="flex justify-between items-center select-none">
                                <span class="text-[10px] font-extrabold uppercase tracking-wider text-text-muted font-bold">Slider Control</span>
                                <span class="px-2 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[11px] font-mono font-bold text-brand-600 dark:text-brand-400">
                                  {el()?.rotation || 0}°
                                </span>
                              </div>

                              <div class="flex items-center gap-3">
                                {/* Rotate -45° */}
                                <button
                                  onClick={() => updateTypographyElement(el().id, { rotation: ((el()?.rotation || 0) - 45) % 360 })}
                                  class="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-slate-200/50 dark:border-zinc-800/80 rounded-xl text-text-muted hover:text-brand-500 transition-all cursor-pointer shrink-0 active:scale-90"
                                  type="button"
                                  title="Rotate -45°"
                                >
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                    <path d="M21 3v5h-5" />
                                  </svg>
                                </button>

                                {/* Range Input */}
                                <input
                                  type="range"
                                  min="-180" max="180"
                                  value={el()?.rotation || 0}
                                  onInput={(e) => updateTypographyElement(el().id, { rotation: parseInt(e.currentTarget.value) || 0 })}
                                  class="flex-1 h-1.5 accent-brand-500 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer focus:outline-none"
                                />

                                {/* Rotate +45° */}
                                <button
                                  onClick={() => updateTypographyElement(el().id, { rotation: ((el()?.rotation || 0) + 45) % 360 })}
                                  class="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-slate-200/50 dark:border-zinc-800/80 rounded-xl text-text-muted hover:text-brand-500 transition-all cursor-pointer shrink-0 active:scale-90"
                                  type="button"
                                  title="Rotate +45°"
                                >
                                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                  </svg>
                                </button>
                              </div>

                              {/* Reset to 0° Button */}
                              <button
                                onClick={() => updateTypographyElement(el().id, { rotation: 0 })}
                                class="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-slate-200/40 dark:border-zinc-800/50 rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-text-muted hover:text-brand-500 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                                type="button"
                              >
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                </svg>
                                Reset to 0°
                              </button>
                            </div>
                          </div>
                        </Show>
                      }>
                        {/* Selector Menu (Spacious grid of style actions with seamless card designs) */}
                        <div class="space-y-3.5">
                          <div class="grid grid-cols-2 gap-3.5 py-1">
                            {/* Center Horizontally */}
                            <button
                              onClick={() => updateTypographyElement(el().id, { x: typographyStore.width / 2 })}
                              class="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm"
                              type="button"
                            >
                              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                  <line x1="12" y1="2" x2="12" y2="22" stroke-dasharray="3 3" />
                                  <rect x="6" y="7" width="12" height="10" rx="2" />
                                </svg>
                              </div>
                              <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Align Horiz.</span>
                            </button>

                            {/* Center Vertically */}
                            <button
                              onClick={() => updateTypographyElement(el().id, { y: typographyStore.height / 2 })}
                              class="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm"
                              type="button"
                            >
                              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                  <line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="3 3" />
                                  <rect x="7" y="6" width="10" height="12" rx="2" />
                                </svg>
                              </div>
                              <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Align Vert.</span>
                            </button>

                            {/* Rotation Button */}
                            <button
                              onClick={() => setMobileStylePanel('rotation')}
                              class="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm"
                              type="button"
                            >
                              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                                </svg>
                              </div>
                              <div class="flex flex-col gap-0.5">
                                <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Rotation</span>
                                <span class="text-[9px] font-bold text-text-muted uppercase tracking-wider">{el()?.rotation || 0}° Active</span>
                              </div>
                            </button>

                            {/* Letter Spacing Button */}
                            <Show when={el()?.type === 'text'}>
                              <button
                                onClick={() => setMobileStylePanel('letterSpacing')}
                                class="flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm"
                                type="button"
                              >
                                <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                  <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M4 7V4h16v3" />
                                    <path d="M9 20h6" />
                                    <path d="M12 4v16" />
                                    <path d="m5 12-3 3 3 3" />
                                    <path d="m19 12 3 3-3 3" />
                                    <path d="M2 15h20" />
                                  </svg>
                                </div>
                                <div class="flex flex-col gap-0.5">
                                  <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Letter Spacing</span>
                                  <span class="text-[9px] font-bold text-text-muted uppercase tracking-wider">{(el() as TypographyTextElement).letterSpacing || 0}px Active</span>
                                </div>
                              </button>
                            </Show>

                            {/* Wiggle Button */}
                            <button
                              onClick={() => setMobileStylePanel('wiggle')}
                              class={`flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm ${
                                el()?.type !== 'text' ? 'col-span-2' : ''
                              }`}
                              type="button"
                            >
                              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M2 12c.6 0 1.2-.4 1.4-1l1.2-4.2c.4-1.2 2-1.2 2.4 0l2 7c.4 1.2 2 1.2 2.4 0l1.2-4.2c.2-.6.8-1 1.4-1h9" />
                                </svg>
                              </div>
                              <div class="flex flex-col gap-0.5">
                                <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Wiggle Shake</span>
                                <span class="text-[9px] font-bold text-text-muted uppercase tracking-wider">{el()?.animShake !== undefined ? el()?.animShake : 20} Intensity</span>
                              </div>
                            </button>

                            {/* Drop Shadow Button */}
                            <button
                              onClick={() => setMobileStylePanel('dropShadow')}
                              class={`flex flex-col items-center justify-center gap-3 p-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800/40 hover:border-brand-500/40 dark:hover:border-brand-500/30 hover:bg-brand-500/[0.02] dark:hover:bg-brand-500/[0.02] rounded-2xl text-center transition-all cursor-pointer group active:scale-95 shadow-sm ${
                                el()?.type !== 'text' ? 'col-span-2' : ''
                              }`}
                              type="button"
                            >
                              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400 group-hover:text-brand-500 group-hover:bg-brand-500/10 transition-all shadow-inner-sm">
                                <svg class="w-5 h-5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <rect width="12" height="12" x="3" y="3" rx="2" />
                                  <path d="M7 17h10a2 2 0 0 0 2-2V5" />
                                  <path d="M11 21h10a2 2 0 0 0 2-2V9" />
                                </svg>
                              </div>
                              <div class="flex flex-col gap-0.5">
                                <span class="text-xs font-bold text-text-main group-hover:text-brand-500 transition-colors">Drop Shadow</span>
                                <span class="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                  {el()?.shadowBlur && el()?.shadowBlur > 0 ? `${el()?.shadowBlur}px Blur` : 'Inactive'}
                                </span>
                              </div>
                            </button>
                          </div>

                          {/* Deselect element */}
                          <div class="w-full border-t border-border-color/30 my-2"></div>
                          <button
                            onClick={() => updateTypographyGlobal({ selectedId: null })}
                            class="w-full py-3 bg-black/5 dark:bg-white/5 border border-slate-200/50 dark:border-zinc-800/80 hover:border-red-500/50 hover:bg-red-500/5 dark:hover:bg-red-500/10 rounded-2xl text-xs font-bold text-text-muted hover:text-red-500 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
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
                      </Show>
                    </div>
                  </>);
              })()}

              {/* Text Content Inputs - Tab 1 (fully reactive direct iteration to fix empty textarea input bug) */}
              <div class={`space-y-3.5 pb-2 lg:block ${activeTab() === 'text' ? 'block' : 'hidden'}`}>
                <For each={typographyStore.elements}>
                  {(el) => (
                    <Show when={el.type === 'text'}>
                      <div 
                        onClick={() => {
                          if (isEditingCanvasText()) return;
                          updateTypographyGlobal({ selectedId: el.id });
                          setActiveTab('style');
                        }}
                        class={`space-y-1.5 py-1.5 transition-all cursor-pointer ${
                          typographyStore.selectedId === el.id 
                            ? 'border-l-2 border-brand-500 pl-3.5' 
                            : 'border-l-2 border-transparent pl-3.5'
                        }`}
                      >
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                            <svg class="w-3.5 h-3.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                            Edit Text
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingCanvasText(el.id);
                            }}
                            class="group/btn flex items-center gap-1 text-[9px] font-extrabold text-brand-500 hover:text-brand-600 bg-brand-500/5 hover:bg-brand-500/10 border border-brand-500/10 px-2 py-0.5 rounded-md cursor-pointer transition-all select-none active:scale-95 flex-shrink-0"
                            type="button"
                            title="Edit directly on canvas"
                          >
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M15 3h6v6" />
                              <path d="M10 14 21 3" />
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            </svg>
                            Edit on Canvas
                          </button>
                        </div>
                        <textarea
                          rows="2"
                          value={(el as TypographyTextElement).text}
                          onInput={(e) => updateTypographyElement(el.id, { text: e.currentTarget.value })}
                          onFocus={() => {
                            updateTypographyGlobal({ selectedId: el.id });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          class="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border-0 rounded-lg text-xs font-semibold text-text-main resize-none focus:outline-none focus:bg-black/[0.08] dark:focus:bg-white/[0.08] transition-all duration-200"
                          placeholder="Type text content..."
                        ></textarea>
                      </div>
                    </Show>
                  )}
                </For>
              </div>

              {/* Desktop Style Adjustments Section - visible permanently on desktop */}
              {(() => {
                const el = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId) || typographyStore.elements.find(e => e.type === 'text') || typographyStore.elements[0];
                const [isShadowOpen, setIsShadowOpen] = createSignal(false);
                
                return (
                  <Show when={el()}>
                    <div class="hidden lg:block space-y-4 border-t border-border-color/30 pt-4.5 animate-pure-fade-in">
                      <h3 class="font-bold text-xs text-text-main uppercase tracking-widest flex items-center gap-2 select-none">
                        <svg class="w-4 h-4 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <rect width="12" height="12" x="3" y="3" rx="2" />
                          <path d="M7 17h10a2 2 0 0 0 2-2V5" />
                          <path d="M11 21h10a2 2 0 0 0 2-2V9" />
                        </svg>
                        Style Adjustments
                        <Show when={!typographyStore.selectedId}>
                          <span class="text-[9px] font-bold text-text-muted bg-black/5 dark:bg-white/5 border border-border-color/30 px-1.5 py-0.5 rounded uppercase tracking-widest ml-1.5 select-none">
                            Default Layer
                          </span>
                        </Show>
                      </h3>

                      <div class="space-y-5 py-1">
                        {/* Collapsible Accordion for Drop Shadow inside new Style section */}
                        <div class="space-y-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsShadowOpen(!isShadowOpen());
                            }}
                            class="w-full flex items-center justify-between py-2 px-2.5 bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-border-color/20 rounded-xl text-[10px] font-bold text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer select-none"
                            type="button"
                          >
                            <div class="flex items-center gap-1.5">
                              <svg class="w-3.5 h-3.5 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="12" height="12" x="3" y="3" rx="2" />
                                <path d="M7 17h10a2 2 0 0 0 2-2V5" />
                                <path d="M11 21h10a2 2 0 0 0 2-2V9" />
                              </svg>
                              <span>Drop Shadow Options</span>
                            </div>
                            <div class="flex items-center gap-2">
                              <Show when={!isShadowOpen() && el()?.shadowBlur && el()!.shadowBlur > 0}>
                                <span class="text-[8px] font-black uppercase text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">
                                  {el()!.shadowBlur}px Blur
                                </span>
                              </Show>
                              <svg 
                                class={`w-3 h-3 text-slate-400 dark:text-zinc-500 ${
                                  isShadowOpen() ? 'rotate-180' : ''
                                }`} 
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                              >
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </div>
                          </button>

                          <Show when={isShadowOpen()}>
                            <div class="space-y-4 px-1 py-2.5 bg-transparent border-0 rounded-none shadow-none mt-2">
                              
                              {/* Shadow Color */}
                              <div class="flex items-center justify-between gap-3">
                                <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted select-none">Shadow Color</label>
                                <div class="flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-border-color/30 px-2 py-1 rounded-lg shrink-0">
                                  <input 
                                    type="color" 
                                    value={el()!.shadowColor || '#000000'}
                                    onInput={(e) => updateTypographyElement(el()!.id, { shadowColor: e.currentTarget.value })}
                                    class="w-6 h-6 rounded border border-border-color/40 bg-transparent cursor-pointer"
                                  />
                                  <span class="text-[10px] font-mono font-bold uppercase select-all min-w-[50px] text-right">
                                    {el()!.shadowColor || '#000000'}
                                  </span>
                                </div>
                              </div>

                              <div class="border-t border-border-color/20 my-1"></div>

                              {/* Shadow Blur Slider */}
                              <div class="space-y-1">
                                <div class="flex justify-between items-center select-none">
                                  <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Blur Radius</label>
                                  <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                    {el()!.shadowBlur || 0}px
                                  </span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={el()!.shadowBlur || 0} 
                                  onInput={(e) => updateTypographyElement(el()!.id, { shadowBlur: parseInt(e.currentTarget.value) })} 
                                  class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                />
                              </div>

                              {/* Shadow Offset X Slider */}
                              <div class="space-y-1">
                                <div class="flex justify-between items-center select-none">
                                  <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset X</label>
                                  <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                    {el()!.shadowOffsetX || 0}px
                                  </span>
                                </div>
                                <input 
                                  type="range" 
                                  min="-100" 
                                  max="100" 
                                  value={el()!.shadowOffsetX || 0} 
                                  onInput={(e) => updateTypographyElement(el()!.id, { shadowOffsetX: parseInt(e.currentTarget.value) })} 
                                  class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                />
                              </div>

                              {/* Shadow Offset Y Slider */}
                              <div class="space-y-1">
                                <div class="flex justify-between items-center select-none">
                                  <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset Y</label>
                                  <span class="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-500/10 text-[10px] font-mono font-black text-brand-600 dark:text-brand-400">
                                    {el()!.shadowOffsetY || 0}px
                                  </span>
                                </div>
                                <input 
                                  type="range" 
                                  min="-100" 
                                  max="100" 
                                  value={el()!.shadowOffsetY || 0} 
                                  onInput={(e) => updateTypographyElement(el()!.id, { shadowOffsetY: parseInt(e.currentTarget.value) })} 
                                  class="w-full accent-brand-500 bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none" 
                                />
                              </div>

                            </div>
                          </Show>
                        </div>

                      </div>
                    </div>
                  </Show>
                );
              })()}
            </div>

              {/* Aspect Ratio Selector - Tab 2 */}
              <div class={`space-y-3 lg:block ${activeTab() === 'ratio' ? 'block' : 'hidden'}`}>
                <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-2">Preview Aspect Ratio</label>
                <div class="grid grid-cols-5 lg:grid-cols-2 xl:grid-cols-5 gap-2">
                  {['16:9', '9:16', '1:1', '4:5', '4:3'].map(ratio => (
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

                <div class="col-span-2 lg:col-span-1 pt-1.5 lg:pt-0">
                  <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Canvas Promo Ad</label>
                  <button
                    onClick={() => setShowCanvasAd(!showCanvasAd())}
                    class="flex items-center justify-between w-full px-3.5 py-2.5 bg-black/5 dark:bg-white/5 border border-border-color rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer text-left"
                    type="button"
                  >
                    <span class="text-xs font-bold text-text-main">Show Canvas Ad</span>
                    <div class={`relative w-8 h-4.5 rounded-full border shrink-0 transition-colors ${showCanvasAd() ? 'bg-brand-500 border-brand-500' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-700'}`}>
                      <div class={`absolute top-0.5 w-3 h-3 bg-white dark:bg-zinc-950 rounded-full shadow transition-transform ${showCanvasAd() ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
                    </div>
                  </button>
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

    {/* Right Vertical Skyscraper Ad - only for desktop (2xl and above) */}
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
