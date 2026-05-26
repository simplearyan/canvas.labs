import { createEffect, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { Portal } from 'solid-js/web';
import { 
  typographyStore, 
  updateTypographyGlobal, 
  updateTypographyElement, 
  addTypographyElement, 
  removeTypographyElement, 
  moveTypographyElement,
  setTypographyStore,
  serializeTypographyState,
  loadTypographyStateFromUrl
} from '@/store/typographyStore';
import { TypographyEngine } from '@/engines/typography-studio/TypographyEngine';
import { TYPOGRAPHY_PRESETS } from '@/engines/typography-studio/presets';
import type { TypographyAnimPreset, TypographyElement, TypographyTextElement, TypographyShapeElement } from '@/engines/typography-studio/types';
import Icon from '@/components/ui/Icon';
import ExportModal from '@/components/common/ExportModal';
import { typographyExportProject } from '@/engines/typography-studio/ExportEngine';
import { isDarkTheme, toggleTheme } from '@/store/global';

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

export default function TypographyEditor() {
  let canvasRef!: HTMLCanvasElement;
  let engine: TypographyEngine;

  const [isLoaded, setIsLoaded] = createSignal(false);
  const [editorTab, setEditorTab] = createSignal<'presets' | 'layers' | 'properties' | 'canvas'>('presets');
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1'>('16:9');
  const [selectedCharIndex, setSelectedCharIndex] = createSignal<number>(0);
  
  // Playback & Export
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [isExporting, setIsExporting] = createSignal(false);
  
  let canvasContainerRef!: HTMLDivElement;
  let playTimeoutId: any = null;

  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    if (encodedConfig) {
      loadTypographyStateFromUrl(encodedConfig);
    }
  }

  onMount(() => {
    engine = new TypographyEngine(canvasRef);
    
    engine.onTimeUpdate = (time) => {
      updateTypographyGlobal({ time });
      if (time >= (typographyStore.duration || 5)) {
        setIsPlaying(false);
      }
    };

    handleResize();
    setTimeout(handleResize, 100);

    requestAnimationFrame(() => {
      if (engine) engine.render();
      setIsLoaded(true);
    });

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
  });

  const handleResize = () => {
    if (!canvasRef || !engine) return;
    const wrapper = canvasRef.parentElement;
    if (wrapper) {
      const container = wrapper.parentElement;
      if (container) {
        const isFS = document.fullscreenElement === wrapper;
        const mainNode = wrapper.closest('main');
        const isMobile = window.innerWidth < 768;
        // Calculate max dimensions strictly based on stable bounds to prevent infinite growth feedback loop
        const maxW = isFS ? window.innerWidth : (mainNode ? mainNode.clientWidth - (isMobile ? 0 : 80) : container.clientWidth - (isMobile ? 0 : 64));
        const maxH = isFS ? window.innerHeight : (mainNode ? mainNode.clientHeight - (isMobile ? 80 : 180) : container.clientHeight - (isMobile ? 80 : 64));

        let w = maxW;
        let h = maxH;
        const aspect = aspectRatio();
        let targetRatio = 16 / 9;
        
        if (aspect === '9:16') targetRatio = 9 / 16;
        else if (aspect === '1:1') targetRatio = 1;
        else if (aspect === '4:5') targetRatio = 4 / 5;
        else if (aspect === '3:4') targetRatio = 3 / 4;
        else if (aspect === '4:3') targetRatio = 4 / 3;
        else if (aspect === '2:1') targetRatio = 2 / 1;

        if (maxW / maxH > targetRatio) { h = maxH; w = h * targetRatio; } 
        else { w = maxW; h = w / targetRatio; }

        canvasRef.style.width = `${Math.round(w)}px`;
        canvasRef.style.height = `${Math.round(h)}px`;

        // The engine logic handles base internal resolution.
        // We sync the store's dimension based on aspect ratio
        let renderW = 1920; let renderH = 1080;
        if (aspect === '9:16') { renderW = 1080; renderH = 1920; }
        else if (aspect === '1:1') { renderW = 1080; renderH = 1080; }
        else if (aspect === '4:5') { renderW = 1080; renderH = 1350; }
        else if (aspect === '3:4') { renderW = 1080; renderH = 1440; }
        else if (aspect === '4:3') { renderW = 1440; renderH = 1080; }
        else if (aspect === '2:1') { renderW = 2160; renderH = 1080; }
        
        updateTypographyGlobal({ width: renderW, height: renderH });
        engine.setDimensions(renderW, renderH, window.devicePixelRatio || 1);
      }
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(document.fullscreenElement === canvasContainerRef);
    setTimeout(handleResize, 100);
  };

  const toggleFullscreen = () => {
    if (!canvasContainerRef) return;
    if (!document.fullscreenElement) {
      canvasContainerRef.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  createEffect(() => {
    aspectRatio();
    if (isLoaded() && engine) {
      requestAnimationFrame(() => handleResize());
    }
  });

  createEffect(() => {
    if (isLoaded() && engine) {
      // Explicitly track layout, design properties, and selection state
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
          // We must merge it back with the untracked time so the engine has it
          const fullSnapshot = { ...snapshot, time: typographyStore.time };
          engine.updateState(fullSnapshot);
      }
      
      // Update URL safely without tracking time changes
      window.history.replaceState(null, '', `?config=${serializeTypographyState()}`);
    }
  });

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

  const resetTime = () => {
    engine.pause();
    setIsPlaying(false);
    updateTypographyGlobal({ time: 0 });
    engine.seek(0);
  };

  const scrubTime = (progress: number) => {
    if (isPlaying()) {
        engine.pause();
        setIsPlaying(false);
    }
    const t = progress * (typographyStore.duration || 5);
    updateTypographyGlobal({ time: t });
    engine.seek(progress);
  };

  const TimelineUI = () => (
    <div class={isFullscreen() 
      ? "flex items-center gap-3 sm:gap-6 border-none shadow-2xl rounded-2xl py-3 px-6 w-full max-w-2xl bg-neutral-950/75 backdrop-blur-xl border border-neutral-800/40 text-white"
      : `flex items-center gap-2 sm:gap-4 border shadow-sm rounded-xl px-4 sm:px-6 py-2.5 w-full max-w-2xl transition-all bg-white dark:bg-zinc-950 border-border-color`
    }>
       <button 
         onClick={resetTime} 
         class={isFullscreen() 
           ? "p-1 bg-transparent text-white transition-none shrink-0"
           : `p-1.5 rounded-lg transition-colors text-text-muted hover:text-text-main hover:bg-slate-50 dark:hover:bg-zinc-900`
         } 
         title="Rewind to start"
       >
         <Icon name="skip-back" class={isFullscreen() ? "w-5.5 h-5.5" : "w-4 h-4 sm:w-5 sm:h-5"} />
       </button>
       
       <button 
         onClick={handlePlayPause} 
         class={isFullscreen()
           ? "bg-transparent text-white w-auto h-auto shadow-none scale-100 hover:scale-100 active:scale-95 transition-none shrink-0 p-1 flex items-center justify-center"
           : `rounded-full flex items-center justify-center shadow-md active:scale-95 transition-all shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blueprint-900 dark:bg-brand-500 text-white dark:text-zinc-950 hover:scale-105`
         }
       >
         <Show when={isPlaying()} fallback={
           <svg class={`${isFullscreen() ? 'w-6.5 h-6.5' : 'w-4 h-4 sm:w-5 sm:h-5'} fill-current ml-0.5`} viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
         }>
           <svg class={isFullscreen() ? 'w-6.5 h-6.5' : 'w-4 h-4 sm:w-5 sm:h-5'} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
         </Show>
       </button>

       <Show when={isFullscreen()} fallback={
         <div class="flex-1 flex flex-col gap-1.5 px-2">
           <div class="flex justify-between text-[10px] sm:text-xs font-mono font-bold text-text-muted">
             <span>{(typographyStore.time).toFixed(1)}s</span>
             <span>{(typographyStore.duration || 5).toFixed(1)}s</span>
           </div>
           <div class="relative w-full h-2 rounded-full flex items-center group bg-slate-200 dark:bg-zinc-800">
             <div class="absolute left-0 h-full bg-blueprint-500 dark:bg-brand-500 rounded-full pointer-events-none" style={{ width: `${((typographyStore.time) / (typographyStore.duration || 5)) * 100}%` }}></div>
             <input 
               type="range" 
               min="0" max="1" step="0.001" 
               value={typographyStore.duration ? typographyStore.time / typographyStore.duration : 0}
               onInput={(e) => scrubTime(parseFloat(e.currentTarget.value))}
               class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
             <div class="absolute w-3 h-3 sm:w-4 sm:h-4 bg-white border-2 border-blueprint-600 dark:border-brand-500 rounded-full shadow-sm pointer-events-none transition-transform group-hover:scale-125" style={{ left: `calc(${((typographyStore.time) / (typographyStore.duration || 5)) * 100}% - 6px)` }}></div>
           </div>
         </div>
       }>
         {/* Minimal Fullscreen Timeline Inline layout - macOS style */}
         <div class="flex-1 flex items-center gap-3 px-1">
           <span class="text-xs sm:text-sm font-mono font-black text-white shrink-0">{(typographyStore.time).toFixed(1)}s</span>
           <div class="flex-1 relative h-1.5 rounded-full flex items-center bg-neutral-800">
             <div class="absolute left-0 h-full bg-white rounded-full pointer-events-none" style={{ width: `${((typographyStore.time) / (typographyStore.duration || 5)) * 100}%` }}></div>
             <input 
               type="range" 
               min="0" max="1" step="0.001" 
               value={typographyStore.duration ? typographyStore.time / typographyStore.duration : 0}
               onInput={(e) => scrubTime(parseFloat(e.currentTarget.value))}
               class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
             <div class="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none" style={{ left: `calc(${((typographyStore.time) / (typographyStore.duration || 5)) * 100}% - 6px)` }}></div>
           </div>
           <span class="text-xs sm:text-sm font-mono font-bold text-neutral-500 shrink-0">{(typographyStore.duration || 5).toFixed(1)}s</span>
         </div>
       </Show>

       <button 
         onClick={toggleFullscreen} 
         class={isFullscreen() 
           ? "p-1 bg-transparent text-white transition-none shrink-0"
           : `p-1.5 rounded-lg transition-colors sm:ml-2 text-text-muted hover:text-text-main hover:bg-slate-50 dark:hover:bg-zinc-900`
         } 
         title="Toggle Fullscreen"
       >
         <Icon name={isFullscreen() ? "minimize" : "maximize"} class={isFullscreen() ? "w-5.5 h-5.5" : "w-4 h-4 sm:w-5 sm:h-5"} />
       </button>
    </div>
  );

  function RailTab(props: { value: typeof editorTab extends () => infer R ? R : never, label: string, icon: string }) {
    const isActive = () => editorTab() === props.value;
    return (
      <button
        onClick={() => setEditorTab(props.value)}
        class={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
          isActive()
            ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 shadow-md scale-[1.02]'
            : 'text-slate-500 dark:text-text-muted hover:text-slate-800 dark:hover:text-text-main hover:bg-slate-100 dark:hover:bg-zinc-800/50'
        }`}
      >
        <Icon name={props.icon} class="w-5 h-5" />
        <span class="text-[9px] font-black uppercase tracking-wider">{props.label}</span>
      </button>
    );
  }

  function loadPreset(key: string) {
    const p = TYPOGRAPHY_PRESETS[key];
    if(!p) return;
    engine.pause();
    setIsPlaying(false);
    const duration = p.duration || 5.0;
    setTypographyStore({
      width: p.width,
      height: p.height,
      bgColor: p.bgColor,
      duration: duration,
      elements: JSON.parse(JSON.stringify(p.elements)),
      time: duration,
      selectedId: null
    });
    engine.seek(1.0);
    setEditorTab('layers');
  }

  const selectedEl = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId);

  function handleAddRansomText() {
    const colors = ['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#fb923c'];
    const text = "RANSOM";
    const charStyles = text.split('').map(() => ({
        fill: colors[Math.floor(Math.random() * colors.length)],
        s: +(0.8 + Math.random() * 0.4).toFixed(2), 
        r: Math.floor(-15 + Math.random() * 30) 
    }));
    
    addTypographyElement({
        id: 'text-'+Date.now(),
        type: 'text',
        text: text,
        charStyles: charStyles,
        fontFamily: 'Caveat',
        fontWeight: '900',
        fontSize: 180,
        fill: '#ffffff',
        roughness: 4,
        innerShadowColor: '#000000',
        innerShadowBlur: 4,
        innerShadowX: 2,
        innerShadowY: 2,
        innerShadowOpacity: 30,
        shadowColor: '#000000',
        shadowBlur: 10,
        shadowOffsetX: 6,
        shadowOffsetY: 6,
        animPreset: 'pop-up',
        animDuration: 1,
        x: typographyStore.width / 2,
        y: typographyStore.height / 2,
        visible: true,
        locked: false
    } as TypographyTextElement);
  }

  let isDragging = false;
  let isRotating = false;
  let activeHandle: string | null = null;
  let dragOffset = { x: 0, y: 0 };
  let initialFontSize = 100;
  let initialW = 100;
  let initialH = 100;
  let initialDistance = 0;

  const handlePointerDown = (e: PointerEvent) => {
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
      setTypographyStore('selectedId', hitId);
      setEditorTab('properties');
      const el = typographyStore.elements.find(e => e.id === hitId);
      if (el && !el.locked) {
        isDragging = true;
        dragOffset = { x: el.x - x, y: el.y - y };
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    } else {
      setTypographyStore('selectedId', null);
    }
  };

  const handlePointerMove = (e: PointerEvent) => {
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

  const handlePointerUp = (e: PointerEvent) => {
    isDragging = false;
    isRotating = false;
    activeHandle = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  return (
    <div class="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] w-full overflow-hidden relative text-slate-800 dark:text-text-main bg-app-bg font-sans">
      
      {/* TOOLBAR / SIDEBAR (Left Panel) */}
      <aside class="w-full md:w-[420px] flex-1 md:flex-none md:h-full order-last md:order-first bg-white dark:bg-zinc-950 border-t md:border-t-0 md:border-r border-blueprint-200 dark:border-zinc-800 flex flex-col md:flex-row z-10 shrink-0 shadow-xl overflow-hidden">
        
        {/* DESKTOP SIDE NAVIGATION RAIL */}
        <div class="hidden md:flex flex-col w-[80px] bg-slate-50 dark:bg-zinc-900 border-r border-blueprint-100 dark:border-zinc-800 py-6 items-center gap-5 shrink-0 select-none">
          <RailTab value="presets" label="Presets" icon="grid" />
          <RailTab value="layers" label="Layers" icon="layers" />
          <RailTab value="properties" label="Props" icon="sliders" />
          <RailTab value="canvas" label="Canvas" icon="layout" />
        </div>

        {/* Scrollable form body */}
        <div class="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar flex flex-col gap-4 md:gap-6 relative">
          
          <div class="h-8 border-b border-border-color flex items-center shrink-0 -mx-5 px-5 -mt-5 pt-5 pb-8 mb-[-12px] bg-slate-50/50 dark:bg-zinc-900/50">
            <h2 class="text-xs font-black tracking-wider uppercase text-text-main mt-4">
              {editorTab() === 'presets' ? 'Template Gallery' : 
               editorTab() === 'layers' ? 'Layer Management' : 
               editorTab() === 'properties' ? 'Layer Properties' : 'Canvas Settings'}
            </h2>
          </div>
          
          <Show when={editorTab() === 'presets'}>
             <div class="flex flex-col gap-3">
               <For each={Object.entries(TYPOGRAPHY_PRESETS)}>
                 {([key, p]) => (
                   <button 
                     onClick={() => loadPreset(key)}
                     class="text-left p-4 rounded-xl border border-border-color hover:border-blueprint-500 dark:hover:border-brand-500 bg-slate-50 dark:bg-zinc-900/50 hover:bg-blueprint-50 dark:hover:bg-brand-500/10 transition-all group shadow-sm"
                   >
                     <div class="font-bold text-text-main group-hover:text-blueprint-700 dark:group-hover:text-brand-400">{p.title}</div>
                     <div class="text-[10px] text-text-muted mt-1 uppercase font-semibold tracking-wider">{p.width}x{p.height} • {p.duration}s</div>
                   </button>
                 )}
               </For>
             </div>
          </Show>

          <Show when={editorTab() === 'canvas'}>
             <div class="space-y-6 animate-fade-in">
                <div class="space-y-3">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Aspect Ratio</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button onClick={() => setAspectRatio('16:9')} class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${aspectRatio()==='16:9' ? 'bg-blueprint-50 dark:bg-brand-500/10 border-blueprint-500 dark:border-brand-500 text-blueprint-700 dark:text-brand-400 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900/50 border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 text-text-muted hover:text-text-main'}`}>
                      <Icon name="monitor" class="w-5 h-5" />
                      <span class="text-[10px] font-bold">16:9</span>
                    </button>
                    <button onClick={() => setAspectRatio('9:16')} class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${aspectRatio()==='9:16' ? 'bg-blueprint-50 dark:bg-brand-500/10 border-blueprint-500 dark:border-brand-500 text-blueprint-700 dark:text-brand-400 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900/50 border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 text-text-muted hover:text-text-main'}`}>
                      <Icon name="smartphone" class="w-5 h-5" />
                      <span class="text-[10px] font-bold">9:16</span>
                    </button>
                    <button onClick={() => setAspectRatio('1:1')} class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${aspectRatio()==='1:1' ? 'bg-blueprint-50 dark:bg-brand-500/10 border-blueprint-500 dark:border-brand-500 text-blueprint-700 dark:text-brand-400 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900/50 border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 text-text-muted hover:text-text-main'}`}>
                      <Icon name="square" class="w-5 h-5" />
                      <span class="text-[10px] font-bold">1:1</span>
                    </button>
                    <button onClick={() => setAspectRatio('4:5')} class={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${aspectRatio()==='4:5' ? 'bg-blueprint-50 dark:bg-brand-500/10 border-blueprint-500 dark:border-brand-500 text-blueprint-700 dark:text-brand-400 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900/50 border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 text-text-muted hover:text-text-main'}`}>
                      <Icon name="layout" class="w-5 h-5" />
                      <span class="text-[10px] font-bold">4:5</span>
                    </button>
                  </div>
                </div>

                <div class="space-y-3">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Background Color</label>
                  <div class="flex items-center gap-3">
                    <input type="color" value={typographyStore.bgColor} onInput={(e) => updateTypographyGlobal({ bgColor: e.currentTarget.value })} class="w-8 h-8 rounded cursor-pointer border border-border-color bg-transparent" />
                    <span class="text-sm font-mono font-bold text-text-main">{typographyStore.bgColor}</span>
                  </div>
                </div>

                <div class="space-y-3">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Duration (Seconds)</label>
                  <input type="number" step="0.5" value={typographyStore.duration} onInput={(e) => updateTypographyGlobal({ duration: parseFloat(e.currentTarget.value) || 5 })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm text-text-main focus:border-brand-500 outline-none" />
                </div>
             </div>
          </Show>

          <Show when={editorTab() === 'layers'}>
             <div class="flex flex-col gap-4 animate-fade-in h-full">
               <div class="grid grid-cols-2 gap-2 shrink-0">
                 <button onClick={() => addTypographyElement({ id: 'text-'+Date.now(), type: 'text', text: 'NEW TEXT', fontFamily: 'Inter', fontWeight: '800', fontSize: 100, fill: '#ffffff', strokeWidth: 0, x: typographyStore.width/2, y: typographyStore.height/2, animPreset: 'none', animDuration: 1, visible: true, locked: false })} class="py-2 bg-blueprint-50 dark:bg-brand-500/10 text-blueprint-700 dark:text-brand-400 font-bold text-xs rounded-lg border border-blueprint-200 dark:border-brand-500/30 hover:bg-blueprint-100 dark:hover:bg-brand-500/20 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"><Icon name="type" class="w-4 h-4"/> Add Text</button>
                 <button onClick={handleAddRansomText} class="py-2 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 font-bold text-xs rounded-lg border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"><Icon name="type" class="w-4 h-4"/> Ransom Text</button>
                 <button onClick={() => addTypographyElement({ id: 'shape-'+Date.now(), type: 'shape', shapeType: 'rect', w: 200, h: 100, borderRadius: 0, fill: '#3b82f6', strokeWidth: 0, x: typographyStore.width/2, y: typographyStore.height/2, animPreset: 'none', animDuration: 1, visible: true, locked: false })} class="py-2 bg-blueprint-50 dark:bg-brand-500/10 text-blueprint-700 dark:text-brand-400 font-bold text-xs rounded-lg border border-blueprint-200 dark:border-brand-500/30 hover:bg-blueprint-100 dark:hover:bg-brand-500/20 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"><Icon name="square" class="w-4 h-4"/> Add Rect</button>
                 <button onClick={() => addTypographyElement({ id: 'shape-'+Date.now(), type: 'shape', shapeType: 'circle', w: 200, h: 200, fill: '#ef4444', strokeWidth: 0, x: typographyStore.width/2, y: typographyStore.height/2, animPreset: 'none', animDuration: 1, visible: true, locked: false })} class="py-2 bg-blueprint-50 dark:bg-brand-500/10 text-blueprint-700 dark:text-brand-400 font-bold text-xs rounded-lg border border-blueprint-200 dark:border-brand-500/30 hover:bg-blueprint-100 dark:hover:bg-brand-500/20 transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"><Icon name="circle" class="w-4 h-4"/> Add Circle</button>
               </div>
               
               <div class="flex-1 overflow-y-auto space-y-2 pb-10">
                 <For each={[...typographyStore.elements].reverse()}>
                   {(el, index) => {
                     const isSelected = () => typographyStore.selectedId === el.id;
                     return (
                       <div 
                         onClick={() => { setTypographyStore('selectedId', el.id); setEditorTab('properties'); }}
                         class={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected() ? 'border-blueprint-500 dark:border-brand-500 bg-blueprint-50/50 dark:bg-brand-500/10 shadow-sm' : 'border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50'}`}
                       >
                         <div class="flex items-center gap-2 overflow-hidden flex-1">
                           <button onClick={(e) => { e.stopPropagation(); updateTypographyElement(el.id, { visible: !el.visible }); }} class={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 ${el.visible===false ? 'text-text-muted' : 'text-text-main'}`}><Icon name={el.visible===false ? 'eye-off' : 'eye'} class="w-4 h-4" /></button>
                           <button onClick={(e) => { e.stopPropagation(); updateTypographyElement(el.id, { locked: !el.locked }); }} class={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 ${el.locked ? 'text-brand-red' : 'text-text-muted'}`}><Icon name={el.locked ? 'lock' : 'unlock'} class="w-4 h-4" /></button>
                           <Icon name={el.type === 'text' ? 'type' : el.type === 'shape' && (el as any).shapeType==='circle' ? 'circle' : 'square'} class="w-4 h-4 text-blueprint-500 dark:text-brand-500 shrink-0 ml-1" />
                           <span class="text-xs font-bold truncate tracking-tight">{el.type === 'text' ? (el as TypographyTextElement).text : 'Shape'}</span>
                         </div>
                         <div class="flex items-center gap-0.5 shrink-0 ml-2">
                           <button onClick={(e) => { e.stopPropagation(); moveTypographyElement(el.id, 1); }} class="p-1 hover:bg-black/5 dark:hover:bg-white/5 text-text-muted rounded"><Icon name="chevron-up" class="w-4 h-4" /></button>
                           <button onClick={(e) => { e.stopPropagation(); moveTypographyElement(el.id, -1); }} class="p-1 hover:bg-black/5 dark:hover:bg-white/5 text-text-muted rounded"><Icon name="chevron-down" class="w-4 h-4" /></button>
                           <button onClick={(e) => { e.stopPropagation(); removeTypographyElement(el.id); }} class="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-brand-red rounded"><Icon name="trash-2" class="w-4 h-4" /></button>
                         </div>
                       </div>
                     );
                   }}
                 </For>
               </div>
             </div>
          </Show>

          <Show when={editorTab() === 'properties'}>
             <Show when={selectedEl()} fallback={<div class="text-center text-text-muted text-xs font-semibold py-10 bg-slate-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-border-color">Select a layer to edit properties.</div>}>
                {(el) => (
                   <div class="space-y-6 animate-fade-in pb-10">
                     
                     <Show when={el().type === 'text'}>
                       <div class="space-y-3">
                         <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Text Content</label>
                         <textarea 
                           rows="2"
                           value={(el() as TypographyTextElement).text}
                           onInput={(e) => updateTypographyElement(el().id, { text: e.currentTarget.value })}
                           class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm font-semibold text-text-main resize-none focus:border-brand-500 outline-none"
                         ></textarea>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Font Family</label>
                           <select value={(el() as TypographyTextElement).fontFamily} onChange={(e) => updateTypographyElement(el().id, { fontFamily: e.currentTarget.value })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-semibold focus:border-brand-500 outline-none">
                             <option value="Inter">Inter</option>
                             <option value="Caveat">Caveat (Organic)</option>
                             <option value="Montserrat">Montserrat</option>
                             <option value="Plus Jakarta Sans">Plus Jakarta</option>
                             <option value="Outfit">Outfit</option>
                             <option value="Rubik">Rubik</option>
                             <option value="Barlow Condensed">Barlow Cond</option>
                             <option value="Carrois Gothic">Carrois Gothic</option>
                             <option value="Roboto">Roboto</option>
                             <option value="Playfair Display">Playfair Display</option>
                             <option value="JetBrains Mono">JetBrains Mono</option>
                           </select>
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Weight</label>
                           <select value={(el() as TypographyTextElement).fontWeight} onChange={(e) => updateTypographyElement(el().id, { fontWeight: e.currentTarget.value })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-semibold focus:border-brand-500 outline-none">
                             <option value="400">Regular (400)</option>
                             <option value="500">Medium (500)</option>
                             <option value="600">Semibold (600)</option>
                             <option value="700">Bold (700)</option>
                             <option value="800">Extra Bold (800)</option>
                             <option value="900">Black (900)</option>
                           </select>
                         </div>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Size</label>
                           <input type="number" value={(el() as TypographyTextElement).fontSize} onInput={(e) => updateTypographyElement(el().id, { fontSize: parseInt(e.currentTarget.value) })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                         <div class="space-y-1.5">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Letter Spacing</label>
                            <input type="number" value={(el() as TypographyTextElement).letterSpacing || 0} onInput={(e) => updateTypographyElement(el().id, { letterSpacing: parseInt(e.currentTarget.value) })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                          </div>
                        </div>

                       <div class="space-y-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl shadow-sm mt-4">
                         <label class="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 flex items-center gap-1.5"><Icon name="edit-3" class="w-3.5 h-3.5" /> Per-Character Styling</label>
                         
                         <div class="flex items-center gap-2">
                           <label class="text-[9px] font-bold uppercase text-text-muted shrink-0">Select Letter:</label>
                           <select 
                             value={selectedCharIndex()} 
                             onChange={(e) => setSelectedCharIndex(parseInt(e.currentTarget.value))}
                             class="flex-1 px-2 py-1.5 bg-white dark:bg-zinc-950 border border-amber-200 dark:border-amber-900/50 rounded text-xs font-bold focus:border-amber-500 outline-none"
                           >
                             <For each={(el() as TypographyTextElement).text.replace(/\n/g, '').split('')}>
                               {(char, i) => (
                                 <option value={i()}>Index {i()}: '{char}'</option>
                               )}
                             </For>
                           </select>
                         </div>

                         <div class="grid grid-cols-2 gap-3 mt-2">
                           <div class="space-y-1.5">
                             <label class="text-[8px] font-bold uppercase text-text-muted">Fill Override</label>
                             <div class="flex items-center gap-2">
                               <input type="color" value={(el().charStyles && el().charStyles[selectedCharIndex()]?.fill) || (el() as TypographyTextElement).fill || '#ffffff'} onInput={(e) => {
                                 const styles = JSON.parse(JSON.stringify(el().charStyles || {}));
                                 if(!styles[selectedCharIndex()]) styles[selectedCharIndex()] = {};
                                 styles[selectedCharIndex()].fill = e.currentTarget.value;
                                 updateTypographyElement(el().id, { charStyles: styles });
                               }} class="w-full h-7 rounded border border-amber-200 dark:border-amber-900/50 bg-transparent cursor-pointer" />
                               <button onClick={() => {
                                 const styles = JSON.parse(JSON.stringify(el().charStyles || {}));
                                 if(styles[selectedCharIndex()]) {
                                   delete styles[selectedCharIndex()].fill;
                                   updateTypographyElement(el().id, { charStyles: styles });
                                 }
                               }} class="p-1 text-text-muted hover:text-brand-red" title="Clear override"><Icon name="x" class="w-3.5 h-3.5" /></button>
                             </div>
                           </div>
                           <div class="space-y-1.5">
                             <div class="flex justify-between"><label class="text-[8px] font-bold uppercase text-text-muted">Scale</label><span class="text-[8px] font-bold text-amber-600 dark:text-amber-500">{(el().charStyles && el().charStyles[selectedCharIndex()]?.s) || 1}x</span></div>
                             <input type="range" min="0.1" max="3" step="0.1" value={(el().charStyles && el().charStyles[selectedCharIndex()]?.s) || 1} onInput={(e) => {
                               const styles = JSON.parse(JSON.stringify(el().charStyles || {}));
                               if(!styles[selectedCharIndex()]) styles[selectedCharIndex()] = {};
                               styles[selectedCharIndex()].s = parseFloat(e.currentTarget.value);
                               updateTypographyElement(el().id, { charStyles: styles });
                             }} class="w-full accent-amber-600 dark:accent-amber-500" />
                           </div>
                         </div>
                         <div class="space-y-1.5">
                           <div class="flex justify-between"><label class="text-[8px] font-bold uppercase text-text-muted">Rotation</label><span class="text-[8px] font-bold text-amber-600 dark:text-amber-500">{(el().charStyles && el().charStyles[selectedCharIndex()]?.r) || 0}°</span></div>
                           <input type="range" min="-180" max="180" value={(el().charStyles && el().charStyles[selectedCharIndex()]?.r) || 0} onInput={(e) => {
                             const styles = JSON.parse(JSON.stringify(el().charStyles || {}));
                             if(!styles[selectedCharIndex()]) styles[selectedCharIndex()] = {};
                             styles[selectedCharIndex()].r = parseInt(e.currentTarget.value);
                             updateTypographyElement(el().id, { charStyles: styles });
                           }} class="w-full accent-amber-600 dark:accent-amber-500" />
                         </div>
                       </div>
                     </Show>

                     <Show when={el().type === 'shape'}>
                       <div class="space-y-3">
                         <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Shape Type</label>
                         <select 
                           value={(el() as TypographyShapeElement).shapeType} 
                           onChange={(e) => updateTypographyElement(el().id, { shapeType: e.currentTarget.value as 'rect'|'circle' })}
                           class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm font-semibold focus:border-brand-500 outline-none"
                         >
                           <option value="rect">Rectangle</option>
                           <option value="circle">Circle</option>
                         </select>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Width</label>
                           <input type="number" value={(el() as TypographyShapeElement).w} onInput={(e) => updateTypographyElement(el().id, { w: parseInt(e.currentTarget.value) })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Height</label>
                           <input type="number" value={(el() as TypographyShapeElement).h} onInput={(e) => updateTypographyElement(el().id, { h: parseInt(e.currentTarget.value) })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                       </div>
                       <Show when={(el() as TypographyShapeElement).shapeType === 'rect'}>
                         <div class="space-y-1.5">
                           <div class="flex justify-between"><label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Border Radius</label><span class="text-[9px] font-bold text-blueprint-600 dark:text-brand-500">{(el() as TypographyShapeElement).borderRadius || 0}px</span></div>
                           <input type="range" min="0" max="500" value={(el() as TypographyShapeElement).borderRadius || 0} onInput={(e) => updateTypographyElement(el().id, { borderRadius: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-600 dark:accent-brand-500" />
                         </div>
                       </Show>
                     </Show>

                     <div class="w-full border-t border-border-color"></div>
                     
                     <div class="space-y-3">
                       <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Position & Rotation</label>
                       <div class="grid grid-cols-3 gap-2">
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1">X</span><input type="number" value={Math.round(el().x)} onInput={(e) => updateTypographyElement(el().id, { x: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-border-color bg-slate-50 dark:bg-zinc-900 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" /></div>
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1">Y</span><input type="number" value={Math.round(el().y)} onInput={(e) => updateTypographyElement(el().id, { y: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-border-color bg-slate-50 dark:bg-zinc-900 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" /></div>
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1">ROT</span><input type="number" value={el().rotation || 0} onInput={(e) => updateTypographyElement(el().id, { rotation: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-border-color bg-slate-50 dark:bg-zinc-900 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" /></div>
                       </div>
                     </div>

                     <div class="space-y-3">
                       <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Fill & Stroke</label>
                       <div class="flex items-center gap-3">
                         <input type="color" value={(el() as any).fill || '#ffffff'} onInput={(e) => updateTypographyElement(el().id, { fill: e.currentTarget.value })} class="w-8 h-8 rounded border border-border-color bg-transparent cursor-pointer shadow-sm" title="Fill Color" />
                         <input type="color" value={(el() as any).stroke || '#000000'} onInput={(e) => updateTypographyElement(el().id, { stroke: e.currentTarget.value })} class="w-8 h-8 rounded border border-border-color bg-transparent cursor-pointer shadow-sm" title="Stroke Color" />
                         <div class="flex-1 flex flex-col gap-1.5 ml-2">
                           <span class="text-[8px] font-bold text-text-muted tracking-wider uppercase">Stroke Width: {(el() as any).strokeWidth || 0}px</span>
                           <input type="range" min="0" max="100" value={(el() as any).strokeWidth || 0} onInput={(e) => updateTypographyElement(el().id, { strokeWidth: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-600 dark:accent-brand-500" />
                         </div>
                       </div>
                     </div>

                     <div class="w-full border-t border-border-color"></div>

                     <div class="space-y-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 p-4 rounded-xl shadow-sm">
                       <label class="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5"><Icon name="scissors" class="w-3.5 h-3.5" /> Paper Cutout FX</label>
                       
                       <div class="space-y-1.5">
                         <div class="flex justify-between"><label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Edge Roughness</label><span class="text-[9px] font-bold text-purple-600 dark:text-purple-400">{el().roughness || 0}</span></div>
                         <input type="range" min="0" max="50" value={el().roughness || 0} onInput={(e) => updateTypographyElement(el().id, { roughness: parseInt(e.currentTarget.value) })} class="w-full accent-purple-600 dark:accent-purple-500" />
                       </div>

                       <div class="w-full border-t border-purple-200 dark:border-purple-900/30 my-2"></div>
                       
                       <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Inner Shadow (Depth)</label>
                       <div class="flex items-center gap-3">
                         <input type="color" value={el().innerShadowColor || '#000000'} onInput={(e) => updateTypographyElement(el().id, { innerShadowColor: e.currentTarget.value })} class="w-8 h-8 rounded border border-purple-200 dark:border-purple-900/50 bg-transparent cursor-pointer shadow-sm shrink-0" />
                         <div class="flex-1 flex flex-col gap-1">
                           <div class="flex justify-between"><label class="text-[8px] font-bold uppercase text-text-muted">Opacity</label><span class="text-[8px] font-bold text-purple-600 dark:text-purple-400">{el().innerShadowOpacity ?? 50}%</span></div>
                           <input type="range" min="0" max="100" value={el().innerShadowOpacity ?? 50} onInput={(e) => updateTypographyElement(el().id, { innerShadowOpacity: parseInt(e.currentTarget.value) })} class="w-full accent-purple-600 dark:accent-purple-500" />
                         </div>
                       </div>
                       
                       <div class="grid grid-cols-3 gap-2">
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1 uppercase">Blur</span><input type="number" value={el().innerShadowBlur || 0} onInput={(e) => updateTypographyElement(el().id, { innerShadowBlur: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-zinc-950 rounded text-xs font-mono font-semibold outline-none" /></div>
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1 uppercase">X Offset</span><input type="number" value={el().innerShadowX || 0} onInput={(e) => updateTypographyElement(el().id, { innerShadowX: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-zinc-950 rounded text-xs font-mono font-semibold outline-none" /></div>
                         <div class="space-y-1"><span class="text-[8px] font-bold text-text-muted ml-1 uppercase">Y Offset</span><input type="number" value={el().innerShadowY || 0} onInput={(e) => updateTypographyElement(el().id, { innerShadowY: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-zinc-950 rounded text-xs font-mono font-semibold outline-none" /></div>
                       </div>
                     </div>

                     <div class="space-y-4 bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm mt-3">
                       <label class="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"><Icon name="drop" class="w-3.5 h-3.5" /> Drop Shadow</label>
                       <div class="space-y-1.5">
                         <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Color</label>
                         <input type="color" value={el().shadowColor || '#000000'} onInput={(e) => updateTypographyElement(el().id, { shadowColor: e.currentTarget.value })} class="w-full h-8 rounded border border-border-color bg-transparent cursor-pointer shadow-sm" />
                       </div>
                       <div class="space-y-1.5">
                         <div class="flex justify-between"><label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Blur</label><span class="text-[9px] font-bold text-blueprint-600 dark:text-brand-500">{el().shadowBlur || 0}px</span></div>
                         <input type="range" min="0" max="100" value={el().shadowBlur || 0} onInput={(e) => updateTypographyElement(el().id, { shadowBlur: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-600 dark:accent-brand-500" />
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <div class="flex justify-between"><label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset X</label><span class="text-[9px] font-bold text-blueprint-600 dark:text-brand-500">{el().shadowOffsetX || 0}px</span></div>
                           <input type="range" min="-100" max="100" value={el().shadowOffsetX || 0} onInput={(e) => updateTypographyElement(el().id, { shadowOffsetX: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-600 dark:accent-brand-500" />
                         </div>
                         <div class="space-y-1.5">
                           <div class="flex justify-between"><label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Offset Y</label><span class="text-[9px] font-bold text-blueprint-600 dark:text-brand-500">{el().shadowOffsetY || 0}px</span></div>
                           <input type="range" min="-100" max="100" value={el().shadowOffsetY || 0} onInput={(e) => updateTypographyElement(el().id, { shadowOffsetY: parseInt(e.currentTarget.value) })} class="w-full accent-blueprint-600 dark:accent-brand-500" />
                         </div>
                       </div>
                     </div>

                     <div class="w-full border-t border-border-color mt-3"></div>

                     <div class="space-y-4 bg-blueprint-50/50 dark:bg-brand-500/5 border border-blueprint-100 dark:border-brand-500/10 p-4 rounded-xl shadow-sm">
                       <label class="text-[10px] font-black uppercase tracking-wider text-blueprint-700 dark:text-brand-400 flex items-center gap-1.5"><Icon name="zap" class="w-3.5 h-3.5" /> Animation Mode</label>
                       <select 
                         value={el().animPreset || 'none'} 
                         onChange={(e) => updateTypographyElement(el().id, { animPreset: e.currentTarget.value as TypographyAnimPreset })}
                         class="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-brand-500/20 rounded-lg text-sm font-bold shadow-sm focus:border-brand-500 outline-none"
                       >
                         <option value="none">None (Static)</option>
                         <option value="stop-motion">Organic Stop Motion</option>
                         <option value="pop-up">Pop Up</option>
                         <option value="drop-down">Drop Down</option>
                         <option value="kinetic-drop">Kinetic Drop</option>
                         <option value="throw">Throw / Bounce</option>
                         <option value="sam-hogan">Slam & Shake</option>
                       </select>
                       <div class="grid grid-cols-2 gap-3 mt-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Duration (s)</label>
                           <input type="number" step="0.1" value={el().animDuration || 1} onInput={(e) => updateTypographyElement(el().id, { animDuration: parseFloat(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-zinc-800 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Stagger (s)</label>
                           <input type="number" step="0.05" value={el().animStagger || 0} onInput={(e) => updateTypographyElement(el().id, { animStagger: parseFloat(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-zinc-800 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                       </div>
                       <div class="grid grid-cols-2 gap-3 mt-1">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Impact Shake</label>
                           <input type="number" value={el().animShake !== undefined ? el().animShake : 20} onInput={(e) => updateTypographyElement(el().id, { animShake: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-zinc-800 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Motion Blur</label>
                           <input type="number" value={el().animMotionBlur || 0} onInput={(e) => updateTypographyElement(el().id, { animMotionBlur: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-zinc-800 rounded text-xs font-mono font-semibold focus:border-brand-500 outline-none" />
                         </div>
                       </div>
                     </div>

                   </div>
                )}
             </Show>
          </Show>
        </div>

        {/* MOBILE BOTTOM NAVIGATION RAIL */}
        <div class="flex md:hidden flex-row w-full bg-slate-50 dark:bg-zinc-900 border-t border-blueprint-100 dark:border-zinc-800 py-2 px-2 sm:px-4 items-center justify-around shrink-0 select-none z-20">
          <RailTab value="presets" label="Presets" icon="grid" />
          <RailTab value="layers" label="Layers" icon="layers" />
          <RailTab value="properties" label="Props" icon="sliders" />
          <RailTab value="canvas" label="Canvas" icon="layout" />
        </div>
      </aside>

      {/* CANVAS WORKSPACE (Right Panel) */}
      <main class="h-[50vh] shrink-0 md:h-auto md:flex-1 flex flex-col relative md:min-h-full min-w-0 bg-slate-100/50 dark:bg-black/20 p-0 md:p-6 lg:p-10 custom-scrollbar">
        
        <div class="flex-1 flex flex-col justify-center max-w-[1200px] mx-auto w-full">
          <div 
            ref={canvasContainerRef}
            class={`relative flex items-center justify-center border-t border-b md:border border-border-color md:shadow-md transition-all duration-300 bg-white dark:bg-zinc-950 ${
              isFullscreen() ? '!fixed inset-0 z-50 bg-black border-none !rounded-none p-0' : 'rounded-none md:rounded-2xl overflow-hidden'
            }`}
          >
            <canvas ref={canvasRef} class="object-contain cursor-crosshair active:cursor-grabbing" style={{ "background-color": typographyStore.bgColor, "touch-action": "none", "pointer-events": "auto" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}></canvas>
            
            <Show when={isFullscreen()}>
              <div class="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 animate-fade-in-up">
                <TimelineUI />
              </div>
            </Show>
          </div>

          <Show when={!isFullscreen()}>
            <div class="mt-4 md:mt-8 px-4 pb-4 flex items-center justify-center w-full animate-fade-in">
              <TimelineUI />
            </div>
          </Show>
        </div>
      </main>

      {/* Portaling controls to header to keep editor interface premium */}
      <Portal mount={document.getElementById('editor-header-controls') || undefined}>
        <div class="flex items-center gap-1.5 sm:gap-3">
          
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

          <button onClick={toggleTheme} class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-text-muted hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-transparent dark:border-zinc-800/20 shrink-0" title="Toggle Light/Dark Theme">
            <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />}>
              <Icon name="sun" class="w-4 h-4 sm:w-5 sm:h-5 text-brand-500" />
            </Show>
          </button>

          <div class="hidden md:block w-[1px] h-4 bg-slate-200 dark:bg-zinc-800 mx-0.5"></div>

          <button onClick={() => setIsExporting(true)} class="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-md bg-blueprint-900 hover:bg-blueprint-800 dark:bg-brand-500 dark:hover:bg-brand-600 font-bold text-[10px] sm:text-xs uppercase tracking-widest transition cursor-pointer shadow-md shrink-0" title="Export Video Animation" style={{ color: isDarkTheme() ? '#09090b' : '#ffffff' }}>
            <Icon name="export" class={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isDarkTheme() ? 'text-zinc-950' : 'text-white'}`} />
            <span class="hidden sm:inline">Export Video</span>
            <span class="inline sm:hidden">Export</span>
          </button>
        </div>
      </Portal>

      {/* Export Modal integration */}
      <ExportModal 
        isOpen={isExporting()}
        onClose={() => setIsExporting(false)} 
        store={typographyStore}
        aspectRatio={aspectRatio()}
        projectTitle="Typography_Animation"
        onExport={typographyExportProject}
      />

    </div>
  );
}
