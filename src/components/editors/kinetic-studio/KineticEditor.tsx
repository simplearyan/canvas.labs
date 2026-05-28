import { createSignal, createEffect, onCleanup, onMount, For, Show } from 'solid-js';
import Icon from '../../ui/Icon';
import type { KineticState, KineticSlide, KineticElement, KineticElementType } from '@/engines/kinetic-studio/types';
import { serializeKineticState, deserializeKineticState, generateId } from '@/engines/kinetic-studio/KineticEngineUtils';
import { renderFrame, SLIDE_DURATION } from '@/engines/kinetic-studio/KineticEngine';

export default function KineticEditor() {
  const getInitialData = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('data');
  };

  const [state, setState] = createSignal<KineticState>(deserializeKineticState(getInitialData()));

  // Editor UI State
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [activeElementId, setActiveElementId] = createSignal<string | null>(null);
  const [leftTab, setLeftTab] = createSignal<'slides' | 'add'>('slides');
  const [rightTab, setRightTab] = createSignal<'layers' | 'props'>('props');
  const [mobileTab, setMobileTab] = createSignal<'slides' | 'add' | 'layers' | 'props'>('slides');
  
  createEffect(() => {
    const mt = mobileTab();
    if (mt === 'slides' || mt === 'add') setLeftTab(mt);
    if (mt === 'layers' || mt === 'props') setRightTab(mt);
  });
  
  // Playback State
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [globalTime, setGlobalTime] = createSignal(0);
  
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let animationFrameId: number;
  let lastTimestamp = 0;

  // Derive max duration
  const maxDuration = () => state().slides.length * SLIDE_DURATION;

  // Persist State to URL
  createEffect(() => {
    if (typeof window === 'undefined') return;
    const encoded = serializeKineticState(state());
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('data', encoded);
    window.history.replaceState({}, '', newUrl.toString());
  });

  const updateSlide = (idx: number, data: Partial<KineticSlide>) => {
    setState(s => {
      const slides = [...s.slides];
      slides[idx] = { ...slides[idx], ...data };
      return { slides };
    });
  };

  const updateElement = (id: string, data: Partial<KineticElement>) => {
    setState(s => {
      const slides = s.slides.map(slide => ({
        ...slide,
        elements: slide.elements.map(el => el.id === id ? { ...el, ...data } : el)
      }));
      return { slides };
    });
  };

  const addSlide = () => {
    const newSlide: KineticSlide = {
      id: generateId(),
      bg: '#18181b',
      transition: 'slideLeft',
      transDuration: 0.5,
      elements: []
    };
    setState(s => ({ slides: [...s.slides, newSlide] }));
    setActiveSlideIndex(state().slides.length - 1);
    setActiveElementId(null);
    setGlobalTime(activeSlideIndex() * SLIDE_DURATION);
  };

  const deleteSlide = (idx: number) => {
    if (state().slides.length <= 1) return;
    setState(s => {
      const slides = [...s.slides];
      slides.splice(idx, 1);
      return { slides };
    });
    setActiveSlideIndex(Math.min(activeSlideIndex(), state().slides.length - 1));
    setActiveElementId(null);
    setGlobalTime(activeSlideIndex() * SLIDE_DURATION);
  };

  const addElement = (type: KineticElementType) => {
    const startX = 400; // arbitrary center logic for default
    const startY = 250;
    
    const newEl: KineticElement = {
      id: generateId(), type,
      x: startX, y: startY, rotation: 0, size: type === 'text' ? 80 : 150,
      fill: type === 'text' ? '#ffffff' : '#3b82f6',
      stroke: '#000000', strokeWidth: 0,
      shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      animIn: 'scale', animInEase: 'easeOut', inDur: 0.5,
      animLoop: 'none', loopSpeed: 1.0,
      animOut: 'fade', animOutEase: 'easeIn', outDur: 0.5,
      start: 0, end: SLIDE_DURATION
    };

    if (type === 'text') {
      newEl.text = "NEW TEXT";
      newEl.font = "'Inter'";
      newEl.fontWeight = '700';
      newEl.letterSpacing = 0;
    }

    setState(s => {
      const slides = [...s.slides];
      slides[activeSlideIndex()].elements.push(newEl);
      return { slides };
    });
    
    setActiveElementId(newEl.id);
    setRightTab('props');
    setMobileTab('props');
  };

  const deleteElement = (id: string) => {
    setState(s => {
      const slides = s.slides.map((slide, idx) => {
        if (idx !== activeSlideIndex()) return slide;
        return { ...slide, elements: slide.elements.filter(e => e.id !== id) };
      });
      return { slides };
    });
    if (activeElementId() === id) setActiveElementId(null);
  };

  // Rendering
  const requestRender = () => {
    if (!canvasRef || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Map fixed logical coordinates (800x500) to actual fluid canvas
    const scale = Math.min(rect.width / 800, rect.height / 500);
    const offsetX = (rect.width - 800 * scale) / 2;
    const offsetY = (rect.height - 500 * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    renderFrame(ctx, globalTime(), 800, 500, state().slides, false, true, isPlaying(), activeElementId());
  };

  createEffect(() => {
    // Whenever state or visual parameters change, we should request a render
    // Re-run this effect tracking state, globalTime, activeElementId, etc.
    state(); globalTime(); activeElementId();
    requestRender();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => requestRender());
    if (containerRef) observer.observe(containerRef);

    // Interaction handling (Drag)
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (isPlaying() || !canvasRef || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      const scale = Math.min(rect.width / 800, rect.height / 500);
      const offX = (rect.width - 800 * scale) / 2;
      const offY = (rect.height - 500 * scale) / 2;
      
      const x = (e.clientX - rect.left - offX) / scale;
      const y = (e.clientY - rect.top - offY) / scale;

      const slide = state().slides[activeSlideIndex()];
      let clickedEl: KineticElement | null = null;
      
      const ctx = canvasRef.getContext('2d');
      if (!ctx) return;

      // Reverse order for painter's algorithm hit test
      for (let i = slide.elements.length - 1; i >= 0; i--) {
        const el = slide.elements[i];
        let hw = 50, hh = 50;

        if (el.type === 'text' && el.text) {
          ctx.font = `${el.fontWeight || '700'} ${el.size}px ${el.font}`;
          hw = ctx.measureText(el.text).width / 2;
          hh = el.size / 2;
        } else if (el.type === 'rect') {
          hw = el.size * 1.5 / 2; hh = el.size / 2;
        } else if (el.type === 'circle') {
          hw = el.size / 2; hh = el.size / 2;
        }

        const angle = -(el.rotation || 0) * Math.PI / 180;
        const dx = x - el.x;
        const dy = y - el.y;
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (Math.abs(rx) <= hw && Math.abs(ry) <= hh) {
          clickedEl = el;
          break;
        }
      }

      if (clickedEl) {
        setActiveElementId(clickedEl.id);
        isDragging = true;
        dragOffsetX = x - clickedEl.x;
        dragOffsetY = y - clickedEl.y;
        setRightTab('props');
        setMobileTab('props');
      } else {
        setActiveElementId(null);
        setRightTab('props');
        setMobileTab('props');
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !activeElementId() || isPlaying() || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      const scale = Math.min(rect.width / 800, rect.height / 500);
      const offX = (rect.width - 800 * scale) / 2;
      const offY = (rect.height - 500 * scale) / 2;
      
      const x = (e.clientX - rect.left - offX) / scale;
      const y = (e.clientY - rect.top - offY) / scale;
      
      updateElement(activeElementId()!, { x: x - dragOffsetX, y: y - dragOffsetY });
    };

    const handlePointerUp = () => { isDragging = false; };

    canvasRef?.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    onCleanup(() => {
      observer.disconnect();
      canvasRef?.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    requestRender();
    document.fonts.ready.then(requestRender);
  });

  const gameLoop = (timestamp: number) => {
    if (!isPlaying()) { lastTimestamp = timestamp; return; }
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    
    let newTime = globalTime() + dt;
    if (newTime >= maxDuration()) newTime = 0; // Loop
    setGlobalTime(newTime);
    
    // Auto switch active slide visually
    const newActiveIdx = Math.floor(newTime / SLIDE_DURATION) % Math.max(1, state().slides.length);
    if (newActiveIdx !== activeSlideIndex()) {
      setActiveSlideIndex(newActiveIdx || 0);
      setActiveElementId(null);
    }
    
    animationFrameId = requestAnimationFrame(gameLoop);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying());
    if (isPlaying()) {
      lastTimestamp = performance.now();
      setActiveElementId(null);
      animationFrameId = requestAnimationFrame(gameLoop);
    } else {
      cancelAnimationFrame(animationFrameId);
      const currIdx = Math.floor(globalTime() / SLIDE_DURATION);
      if(currIdx !== activeSlideIndex()) setActiveSlideIndex(currIdx);
      requestRender();
    }
  };

  const activeSlide = () => state().slides[activeSlideIndex()];
  const activeElement = () => activeSlide()?.elements.find(e => e.id === activeElementId());

  return (
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 overflow-hidden font-sans">
      
      {/* MAIN LAYOUT */}
      <main class="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative z-10 p-2 sm:p-4 gap-4">
        
        {/* LEFT SIDEBAR */}
        <aside class={`w-full lg:w-64 h-[45vh] lg:h-auto bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 flex-col-reverse lg:flex-col shrink-0 z-20 rounded-2xl overflow-hidden shadow-sm order-2 lg:order-1 ${
          (mobileTab() === 'slides' || mobileTab() === 'add') ? 'flex' : 'hidden lg:flex'
        }`}>
          <div class="hidden lg:flex border-t lg:border-t-0 lg:border-b border-gray-200 dark:border-white/5 bg-gray-100/50 dark:bg-black/20 shrink-0">
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'slides' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('slides')}>Slides</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'add' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('add')}>Add</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <Show when={leftTab() === 'slides'}>
              <button onClick={addSlide} class="w-full py-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm transition-all text-xs font-semibold flex justify-center items-center gap-2">
                <Icon name="plus-circle" class="w-4 h-4" /> New Slide
              </button>
              <div class="h-px bg-gray-200 dark:bg-white/5 my-1"></div>
              <div class="space-y-2">
                <For each={state().slides}>{(slide, idx) => (
                  <div 
                    class={`p-3 rounded-xl border transition-all cursor-pointer group ${idx() === activeSlideIndex() ? 'bg-emerald-50 dark:bg-black/40 border-emerald-500 shadow-inner' : 'bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 hover:border-emerald-300 dark:hover:border-white/20'}`}
                    onClick={() => { setActiveSlideIndex(idx()); setActiveElementId(null); setGlobalTime(idx() * SLIDE_DURATION); }}
                  >
                    <div class="flex justify-between items-center mb-2">
                      <span class={`text-xs font-bold ${idx() === activeSlideIndex() ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-zinc-400'}`}>Slide {idx() + 1}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSlide(idx()); }} class="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Icon name="trash-2" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div class="text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                      <div class="w-3 h-3 rounded-full border border-gray-300 dark:border-white/20" style={{ background: slide.bg === 'transparent' ? '#fff' : slide.bg }}></div>
                      Trans: {slide.transition}
                    </div>
                  </div>
                )}</For>
              </div>
            </Show>

            <Show when={leftTab() === 'add'}>
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 ml-1">Typography</h3>
              <button onClick={() => addElement('text')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-emerald-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center font-serif text-sm font-bold text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-white/5 shadow-inner">T</div>
                Text Layer
              </button>
              
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-4 mb-1 ml-1">Shapes</h3>
              <button onClick={() => addElement('rect')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-blue-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center border border-gray-200 dark:border-white/5 shadow-inner">
                  <div class="w-3.5 h-3.5 border-2 border-blue-500 rounded-[2px]"></div>
                </div>
                Rectangle
              </button>
              <button onClick={() => addElement('circle')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-rose-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center border border-gray-200 dark:border-white/5 shadow-inner">
                  <div class="w-3.5 h-3.5 border-2 border-rose-500 rounded-full"></div>
                </div>
                Circle
              </button>
            </Show>
          </div>
        </aside>

        {/* CENTER CANVASES */}
        <section class="flex-none h-[50vh] lg:h-auto lg:flex-1 flex flex-col relative min-w-0 min-h-0 bg-transparent order-1 lg:order-2">
          {/* Canvas Viewport */}
          <div class="flex-1 relative overflow-hidden" ref={containerRef}>
            <div 
              class="absolute top-2 sm:top-6 left-2 sm:left-6 right-2 sm:right-6 bottom-2 sm:bottom-6 bg-white dark:bg-black rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-200 dark:ring-white/10"
              style={{
                "background-image": "radial-gradient(rgba(128,128,128,0.1) 1px, transparent 1px)",
                "background-size": "24px 24px"
              }}
            >
              <canvas ref={canvasRef} class="absolute inset-0 w-full h-full cursor-pointer touch-none"></canvas>
            </div>
          </div>

          {/* Timeline Bar */}
          <div class="h-20 bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 mx-2 sm:mx-6 mb-2 rounded-2xl flex items-center gap-4 sm:gap-6 px-4 sm:px-6 shrink-0 z-10 shadow-sm">
            <button onClick={togglePlay} class="text-emerald-600 dark:text-zinc-200 hover:scale-105 transition-transform flex items-center justify-center shrink-0 w-10 h-10">
              <Show when={!isPlaying()} fallback={<Icon name="pause" class="w-8 h-8 drop-shadow-sm" />}>
                <Icon name="play" class="w-8 h-8 drop-shadow-sm fill-current" />
              </Show>
            </button>
            <div class="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 w-12 shrink-0 bg-gray-100 dark:bg-black/40 px-2 py-1 rounded border border-gray-200 dark:border-white/5 text-center shadow-inner">
              {globalTime().toFixed(1)}s
            </div>
            <input 
              type="range" 
              min="0" max={maxDuration()} step="0.01" 
              value={globalTime()} 
              onInput={(e) => {
                const t = parseFloat(e.currentTarget.value);
                setGlobalTime(t);
                const newIdx = Math.floor(t / SLIDE_DURATION) % Math.max(1, state().slides.length);
                if (newIdx !== activeSlideIndex()) {
                  setActiveSlideIndex(newIdx);
                  setActiveElementId(null);
                }
              }}
              class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
            />
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside class={`w-full lg:w-[320px] h-[45vh] lg:h-auto bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 flex-col-reverse lg:flex-col shrink-0 z-20 rounded-2xl overflow-hidden shadow-sm order-3 lg:order-3 ${
          (mobileTab() === 'layers' || mobileTab() === 'props') ? 'flex' : 'hidden lg:flex'
        }`}>
          <div class="hidden lg:flex border-t lg:border-t-0 lg:border-b border-gray-200 dark:border-white/5 bg-gray-100/50 dark:bg-black/20 shrink-0">
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${rightTab() === 'layers' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setRightTab('layers')}>Layers</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${rightTab() === 'props' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setRightTab('props')}>Properties</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 relative">
            <Show when={rightTab() === 'layers'}>
              <div class="space-y-2">
                <Show when={activeSlide()?.elements.length > 0} fallback={<div class="text-center text-gray-400 dark:text-zinc-600 text-xs mt-10">No layers on this slide.</div>}>
                  <For each={[...(activeSlide()?.elements || [])].reverse()}>{(el) => (
                    <div 
                      class={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${el.id === activeElementId() ? 'bg-emerald-50 dark:bg-black/40 border-emerald-500 shadow-inner' : 'bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 hover:border-emerald-300 dark:hover:border-white/20'}`}
                      onClick={() => { setActiveElementId(el.id); setRightTab('props'); }}
                    >
                      <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-6 h-6 rounded bg-gray-100 dark:bg-black/50 text-[10px] flex items-center justify-center font-bold text-gray-500 dark:text-zinc-500 border border-gray-200 dark:border-white/5">
                          {el.type === 'text' ? 'T' : el.type === 'rect' ? '■' : '●'}
                        </div>
                        <div class={`text-xs font-semibold truncate ${el.id === activeElementId() ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                          {el.type === 'text' ? `"${el.text?.substring(0, 12)}"` : el.type.toUpperCase()}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} class="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 p-1">
                        <Icon name="trash-2" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}</For>
                </Show>
              </div>
            </Show>

            <Show when={rightTab() === 'props'}>
              <Show when={!activeElement()} fallback={
                <div class="space-y-6">
                  {/* Element Properties */}
                  <div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/10">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/30">
                      <Icon name="settings-2" class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold leading-tight">Element Settings</h2>
                      <p class="text-[10px] text-gray-500 dark:text-zinc-400">Customize appearance & motion</p>
                    </div>
                  </div>

                  <Show when={activeElement()?.type === 'text'}>
                    <div class="space-y-2">
                      <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">Text Content</label>
                      <input 
                        type="text" 
                        value={activeElement()?.text || ''} 
                        onInput={(e) => updateElement(activeElementId()!, { text: e.currentTarget.value })}
                        class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-medium focus:border-emerald-500 outline-none transition-colors" 
                      />
                    </div>
                    <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-3">
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Font Family</label>
                        <select 
                          value={activeElement()?.font} 
                          onChange={(e) => updateElement(activeElementId()!, { font: e.currentTarget.value })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs font-semibold focus:border-emerald-500 outline-none"
                        >
                          <option value="'Inter'">Inter</option>
                          <option value="'Space Grotesk'">Space Grotesk</option>
                          <option value="'Plus Jakarta Sans'">Plus Jakarta Sans</option>
                          <option value="'Outfit'">Outfit</option>
                          <option value="'Caveat'">Caveat</option>
                        </select>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Weight</label>
                          <select 
                            value={activeElement()?.fontWeight} 
                            onChange={(e) => updateElement(activeElementId()!, { fontWeight: e.currentTarget.value })}
                            class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                          >
                            <option value="400">Regular</option>
                            <option value="600">SemiBold</option>
                            <option value="700">Bold</option>
                            <option value="800">ExtraBold</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Spacing</label>
                          <input 
                            type="number" 
                            value={activeElement()?.letterSpacing} 
                            onInput={(e) => updateElement(activeElementId()!, { letterSpacing: parseFloat(e.currentTarget.value) || 0 })}
                            class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  </Show>

                  {/* General Appearance */}
                  <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-4">
                    <div class="grid grid-cols-2 gap-3 pt-1 mb-2 border-b border-gray-200 dark:border-white/5 pb-3">
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Size</label>
                        <input 
                          type="number" 
                          value={activeElement()?.size} 
                          onInput={(e) => updateElement(activeElementId()!, { size: parseInt(e.currentTarget.value) || 10 })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                        />
                      </div>
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Rotate °</label>
                        <input 
                          type="number" 
                          value={activeElement()?.rotation} 
                          onInput={(e) => updateElement(activeElementId()!, { rotation: parseFloat(e.currentTarget.value) || 0 })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                        />
                      </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-gray-700 dark:text-zinc-300">Fill Color</span>
                      <input 
                        type="color" 
                        value={activeElement()?.fill} 
                        onChange={(e) => updateElement(activeElementId()!, { fill: e.currentTarget.value })}
                        class="w-7 h-7 rounded cursor-pointer bg-transparent border-0" 
                      />
                    </div>
                  </div>
                  
                  {/* Animation config could go here if we expand, keeping it simple for the preview */}
                  
                </div>
              }>
                <div class="space-y-6">
                  {/* Slide Properties */}
                  <div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/10">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                      <Icon name="image" class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold leading-tight">Slide Settings</h2>
                      <p class="text-[10px] text-gray-500 dark:text-zinc-400">Configure global slide visuals</p>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <div class="flex items-center justify-between bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner">
                      <span class="text-xs font-semibold text-gray-700 dark:text-zinc-300">Background Color</span>
                      <input 
                        type="color" 
                        value={activeSlide()?.bg === 'transparent' ? '#000000' : activeSlide()?.bg} 
                        onInput={(e) => updateSlide(activeSlideIndex(), { bg: e.currentTarget.value })}
                        class="w-8 h-8 rounded cursor-pointer bg-transparent border-0" 
                      />
                    </div>

                    <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-3">
                      <h3 class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">Transition (Out)</h3>
                      <div>
                        <label class="text-[10px] text-gray-500 dark:text-zinc-400 block mb-1">Effect Type</label>
                        <select 
                          value={activeSlide()?.transition}
                          onChange={(e) => updateSlide(activeSlideIndex(), { transition: e.currentTarget.value as any })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                        >
                          <option value="none">None (Cut)</option>
                          <option value="fade">Crossfade</option>
                          <option value="slideLeft">Slide Left</option>
                          <option value="slideUp">Slide Up</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-[10px] text-gray-500 dark:text-zinc-400 block mb-1 flex justify-between">
                          <span>Duration</span> <span class="text-emerald-600 dark:text-emerald-400">{activeSlide()?.transDuration}s</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.1" max="2.0" step="0.1" 
                          value={activeSlide()?.transDuration} 
                          onInput={(e) => updateSlide(activeSlideIndex(), { transDuration: parseFloat(e.currentTarget.value) })}
                          class="w-full accent-emerald-500 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </aside>

        {/* MOBILE UNIFIED TABS */}
        <div class="flex lg:hidden w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shrink-0 shadow-sm order-4">
          <button 
            class={`flex-1 py-3 text-xs font-bold transition-colors uppercase tracking-wider ${mobileTab() === 'slides' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('slides')}
          >
            Slides
          </button>
          <button 
            class={`flex-1 py-3 text-xs font-bold transition-colors uppercase tracking-wider ${mobileTab() === 'add' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('add')}
          >
            Add
          </button>
          <button 
            class={`flex-1 py-3 text-xs font-bold transition-colors uppercase tracking-wider ${mobileTab() === 'layers' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('layers')}
          >
            Layers
          </button>
          <button 
            class={`flex-1 py-3 text-xs font-bold transition-colors uppercase tracking-wider ${mobileTab() === 'props' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('props')}
          >
            Props
          </button>
        </div>
      </main>
    </div>
  );
}

