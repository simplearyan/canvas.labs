import { createEffect, createSignal, onMount, onCleanup, Show, For } from 'solid-js';
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
import { isDarkTheme } from '@/store/global';

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
    if (playTimeoutId) clearTimeout(playTimeoutId);
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
      const snapshot = JSON.parse(JSON.stringify(typographyStore));
      engine.updateState(snapshot);
      window.history.replaceState(null, '', `?config=${serializeTypographyState()}`);
    }
  });

  const handlePlayPause = () => {
    if (!engine) return;
    if (isPlaying()) {
      engine.pause();
      setIsPlaying(false);
      if (playTimeoutId) clearTimeout(playTimeoutId);
    } else {
      engine.play();
      setIsPlaying(true);
      if (playTimeoutId) clearTimeout(playTimeoutId);
      playTimeoutId = setTimeout(() => {
        setIsPlaying(false);
        playTimeoutId = null;
      }, (typographyStore.duration || 5) * 1000);
    }
  };

  const resetTime = () => {
    engine.pause();
    setIsPlaying(false);
    if (playTimeoutId) clearTimeout(playTimeoutId);
    updateTypographyGlobal({ time: 0 });
    engine.seek(0);
  };

  const scrubTime = (progress: number) => {
    if (isPlaying()) {
        engine.pause();
        setIsPlaying(false);
        if (playTimeoutId) clearTimeout(playTimeoutId);
    }
    const t = progress * (typographyStore.duration || 5);
    updateTypographyGlobal({ time: t });
    engine.seek(progress);
  };

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
    resetTime();
    setTypographyStore({
      width: p.width,
      height: p.height,
      bgColor: p.bgColor,
      duration: p.duration || 5.0,
      elements: JSON.parse(JSON.stringify(p.elements)),
      time: 0,
      selectedId: null
    });
    setEditorTab('layers');
  }

  const selectedEl = () => typographyStore.elements.find(e => e.id === typographyStore.selectedId);

  return (
    <div class="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-app-bg transition-colors duration-300">
      
      {/* Left Rail */}
      <div class="w-20 shrink-0 border-r border-border-color bg-surface flex flex-col items-center py-6 gap-4 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
        <RailTab value="presets" label="Presets" icon="grid" />
        <RailTab value="layers" label="Layers" icon="layers" />
        <RailTab value="properties" label="Props" icon="sliders" />
        <RailTab value="canvas" label="Canvas" icon="monitor" />
      </div>

      {/* Main Workspace */}
      <div class="flex-1 flex flex-col relative min-w-0">
        
        {/* Header Toolbar */}
        <header class="h-14 border-b border-border-color bg-surface/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10 relative">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blueprint-500 to-blueprint-700 dark:from-brand-500 dark:to-brand-700 flex items-center justify-center shadow-sm">
              <Icon name="type" class="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 class="text-sm font-bold text-text-main leading-none">Typography Studio</h1>
              <p class="text-[10px] text-text-muted mt-0.5">Motion Graphics Engine</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              onClick={() => setIsExporting(true)}
              class="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold rounded-lg transition-all shadow-sm active:scale-95"
            >
              <Icon name="download" class="w-4 h-4" /> Export
            </button>
          </div>
        </header>

        {/* Canvas Area */}
        <div class="flex-1 overflow-hidden relative flex flex-col items-center justify-center bg-slate-100/50 dark:bg-black/20 p-8 custom-scrollbar">
          
          {/* Timeline & Playback floating top */}
          <div class="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-surface border border-border-color shadow-sm rounded-full px-4 py-2 z-20">
             <button onClick={resetTime} class="p-1.5 text-text-muted hover:text-text-main transition-colors"><Icon name="skip-back" class="w-4 h-4" /></button>
             <button onClick={handlePlayPause} class="w-8 h-8 rounded-full bg-blueprint-900 dark:bg-brand-500 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all">
               <Show when={isPlaying()} fallback={<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>}>
                 <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
               </Show>
             </button>
             <div class="w-48 px-2 flex items-center gap-2">
               <span class="text-[10px] font-mono text-text-muted w-8 text-right">{(typographyStore.time).toFixed(1)}s</span>
               <input 
                 type="range" 
                 min="0" max="1" step="0.001" 
                 value={typographyStore.time / (typographyStore.duration || 5)}
                 onInput={(e) => scrubTime(parseFloat(e.currentTarget.value))}
                 class="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blueprint-600 dark:[&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
               />
               <span class="text-[10px] font-mono text-text-muted w-8">{(typographyStore.duration || 5).toFixed(1)}s</span>
             </div>
             <button onClick={toggleFullscreen} class="p-1.5 text-text-muted hover:text-text-main transition-colors border-l border-border-color pl-3 ml-1"><Icon name="maximize" class="w-4 h-4" /></button>
          </div>

          <div 
            ref={canvasContainerRef}
            class={`relative flex items-center justify-center border border-border-color shadow-sm transition-all duration-300 ${
              isFullscreen() ? '!fixed inset-0 z-50 bg-black border-none !rounded-none p-0' : 'rounded-xl overflow-hidden'
            }`}
          >
            <Show when={isFullscreen()}>
               <button onClick={toggleFullscreen} class="absolute bottom-6 right-6 z-30 p-3 bg-black/60 text-white rounded-full"><Icon name="minimize" class="w-5 h-5"/></button>
            </Show>
            <canvas ref={canvasRef} class="object-contain" style={{ "background-color": typographyStore.bgColor }}></canvas>
          </div>
        </div>

      </div>

      {/* Right Properties Panel */}
      <div class="w-80 shrink-0 border-l border-border-color bg-surface flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10 relative">
        <div class="h-14 border-b border-border-color flex items-center px-5 shrink-0 bg-slate-50/50 dark:bg-zinc-900/50">
          <h2 class="text-xs font-black tracking-wider uppercase text-text-main">
            {editorTab() === 'presets' ? 'Template Gallery' : 
             editorTab() === 'layers' ? 'Layer Management' : 
             editorTab() === 'properties' ? 'Layer Properties' : 'Canvas Settings'}
          </h2>
        </div>
        
        <div class="flex-1 overflow-y-auto custom-scrollbar p-5">
          
          <Show when={editorTab() === 'presets'}>
             <div class="flex flex-col gap-3">
               <For each={Object.entries(TYPOGRAPHY_PRESETS)}>
                 {([key, p]) => (
                   <button 
                     onClick={() => loadPreset(key)}
                     class="text-left p-4 rounded-xl border border-border-color hover:border-blueprint-500 dark:hover:border-brand-500 bg-slate-50 dark:bg-zinc-900/50 hover:bg-blueprint-50 dark:hover:bg-brand-500/10 transition-all group"
                   >
                     <div class="font-bold text-text-main group-hover:text-blueprint-700 dark:group-hover:text-brand-400">{p.title}</div>
                     <div class="text-[10px] text-text-muted mt-1 uppercase font-semibold">{p.width}x{p.height} • {p.duration}s</div>
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
                    <button onClick={() => setAspectRatio('16:9')} class={`p-2 rounded border text-xs font-bold ${aspectRatio()==='16:9' ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 border-transparent' : 'border-border-color'}`}>16:9</button>
                    <button onClick={() => setAspectRatio('9:16')} class={`p-2 rounded border text-xs font-bold ${aspectRatio()==='9:16' ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 border-transparent' : 'border-border-color'}`}>9:16</button>
                    <button onClick={() => setAspectRatio('1:1')} class={`p-2 rounded border text-xs font-bold ${aspectRatio()==='1:1' ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 border-transparent' : 'border-border-color'}`}>1:1</button>
                    <button onClick={() => setAspectRatio('4:5')} class={`p-2 rounded border text-xs font-bold ${aspectRatio()==='4:5' ? 'bg-blueprint-900 text-white dark:bg-brand-500 dark:text-zinc-950 border-transparent' : 'border-border-color'}`}>4:5</button>
                  </div>
                </div>

                <div class="space-y-3">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Background Color</label>
                  <div class="flex items-center gap-3">
                    <input type="color" value={typographyStore.bgColor} onInput={(e) => updateTypographyGlobal({ bgColor: e.currentTarget.value })} class="w-8 h-8 rounded cursor-pointer border border-border-color bg-transparent" />
                    <span class="text-sm font-mono text-text-main">{typographyStore.bgColor}</span>
                  </div>
                </div>

                <div class="space-y-3">
                  <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Duration (Seconds)</label>
                  <input type="number" step="0.5" value={typographyStore.duration} onInput={(e) => updateTypographyGlobal({ duration: parseFloat(e.currentTarget.value) || 5 })} class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm text-text-main" />
                </div>
             </div>
          </Show>

          <Show when={editorTab() === 'layers'}>
             <div class="flex flex-col gap-4 animate-fade-in h-full">
               <div class="flex gap-2">
                 <button onClick={() => addTypographyElement({ id: 'text-'+Date.now(), type: 'text', text: 'NEW TEXT', fontFamily: 'Inter', fontWeight: '800', fontSize: 100, fill: '#ffffff', strokeWidth: 0, x: typographyStore.width/2, y: typographyStore.height/2, animPreset: 'none', animDuration: 1, visible: true, locked: false })} class="flex-1 py-2 bg-blueprint-50 dark:bg-brand-500/10 text-blueprint-700 dark:text-brand-400 font-bold text-xs rounded-lg border border-blueprint-200 dark:border-brand-500/30 hover:bg-blueprint-100 dark:hover:bg-brand-500/20 transition-colors flex items-center justify-center gap-1"><Icon name="type" class="w-3.5 h-3.5"/> Add Text</button>
                 <button onClick={() => addTypographyElement({ id: 'shape-'+Date.now(), type: 'shape', shapeType: 'circle', w: 200, h: 200, fill: '#ef4444', strokeWidth: 0, x: typographyStore.width/2, y: typographyStore.height/2, animPreset: 'none', animDuration: 1, visible: true, locked: false })} class="flex-1 py-2 bg-blueprint-50 dark:bg-brand-500/10 text-blueprint-700 dark:text-brand-400 font-bold text-xs rounded-lg border border-blueprint-200 dark:border-brand-500/30 hover:bg-blueprint-100 dark:hover:bg-brand-500/20 transition-colors flex items-center justify-center gap-1"><Icon name="circle" class="w-3.5 h-3.5"/> Add Shape</button>
               </div>
               
               <div class="flex-1 overflow-y-auto space-y-2">
                 <For each={[...typographyStore.elements].reverse()}>
                   {(el, index) => {
                     const isSelected = () => typographyStore.selectedId === el.id;
                     return (
                       <div 
                         onClick={() => { setTypographyStore('selectedId', el.id); setEditorTab('properties'); }}
                         class={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected() ? 'border-blueprint-500 dark:border-brand-500 bg-blueprint-50/50 dark:bg-brand-500/10 shadow-sm' : 'border-border-color hover:border-blueprint-300 dark:hover:border-zinc-700 bg-surface'}`}
                       >
                         <div class="flex items-center gap-2 overflow-hidden flex-1">
                           <button onClick={(e) => { e.stopPropagation(); updateTypographyElement(el.id, { visible: !el.visible }); }} class={`p-1 rounded hover:bg-black/5 ${el.visible===false ? 'text-text-muted' : 'text-text-main'}`}><Icon name={el.visible===false ? 'eye-off' : 'eye'} class="w-3.5 h-3.5" /></button>
                           <button onClick={(e) => { e.stopPropagation(); updateTypographyElement(el.id, { locked: !el.locked }); }} class={`p-1 rounded hover:bg-black/5 ${el.locked ? 'text-brand-red' : 'text-text-muted'}`}><Icon name={el.locked ? 'lock' : 'unlock'} class="w-3.5 h-3.5" /></button>
                           <Icon name={el.type === 'text' ? 'type' : el.type === 'shape' && (el as any).shapeType==='circle' ? 'circle' : 'square'} class="w-4 h-4 text-blueprint-500 dark:text-brand-500 shrink-0" />
                           <span class="text-xs font-bold truncate">{el.type === 'text' ? (el as TypographyTextElement).text : 'Shape'}</span>
                         </div>
                         <div class="flex items-center gap-0.5 shrink-0 ml-2">
                           <button onClick={(e) => { e.stopPropagation(); moveTypographyElement(el.id, 1); }} class="p-1 hover:bg-black/5 text-text-muted rounded"><Icon name="chevron-up" class="w-3.5 h-3.5" /></button>
                           <button onClick={(e) => { e.stopPropagation(); moveTypographyElement(el.id, -1); }} class="p-1 hover:bg-black/5 text-text-muted rounded"><Icon name="chevron-down" class="w-3.5 h-3.5" /></button>
                           <button onClick={(e) => { e.stopPropagation(); removeTypographyElement(el.id); }} class="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-brand-red rounded"><Icon name="trash-2" class="w-3.5 h-3.5" /></button>
                         </div>
                       </div>
                     );
                   }}
                 </For>
               </div>
             </div>
          </Show>

          <Show when={editorTab() === 'properties'}>
             <Show when={selectedEl()} fallback={<div class="text-center text-text-muted text-xs font-semibold py-10">Select a layer to edit properties.</div>}>
                {(el) => (
                   <div class="space-y-6 animate-fade-in">
                     
                     <Show when={el().type === 'text'}>
                       <div class="space-y-3">
                         <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Text Content</label>
                         <textarea 
                           rows="2"
                           value={(el() as TypographyTextElement).text}
                           onInput={(e) => updateTypographyElement(el().id, { text: e.currentTarget.value })}
                           class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm font-semibold text-text-main resize-none"
                         ></textarea>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Font Family</label>
                           <input type="text" value={(el() as TypographyTextElement).fontFamily} onInput={(e) => updateTypographyElement(el().id, { fontFamily: e.currentTarget.value })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Weight</label>
                           <input type="text" value={(el() as TypographyTextElement).fontWeight} onInput={(e) => updateTypographyElement(el().id, { fontWeight: e.currentTarget.value })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Size</label>
                           <input type="number" value={(el() as TypographyTextElement).fontSize} onInput={(e) => updateTypographyElement(el().id, { fontSize: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Letter Spacing</label>
                           <input type="number" value={(el() as TypographyTextElement).letterSpacing || 0} onInput={(e) => updateTypographyElement(el().id, { letterSpacing: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                       </div>
                     </Show>

                     <Show when={el().type === 'shape'}>
                       <div class="space-y-3">
                         <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Shape Type</label>
                         <select 
                           value={(el() as TypographyShapeElement).shapeType} 
                           onChange={(e) => updateTypographyElement(el().id, { shapeType: e.currentTarget.value as 'rect'|'circle' })}
                           class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded-lg text-sm"
                         >
                           <option value="rect">Rectangle</option>
                           <option value="circle">Circle</option>
                         </select>
                       </div>
                       <div class="grid grid-cols-2 gap-3">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Width</label>
                           <input type="number" value={(el() as TypographyShapeElement).w} onInput={(e) => updateTypographyElement(el().id, { w: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Height</label>
                           <input type="number" value={(el() as TypographyShapeElement).h} onInput={(e) => updateTypographyElement(el().id, { h: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-slate-50 dark:bg-zinc-900 border border-border-color rounded text-xs" />
                         </div>
                       </div>
                     </Show>

                     <div class="w-full border-t border-border-color"></div>
                     
                     <div class="space-y-3">
                       <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Position & Rotation</label>
                       <div class="grid grid-cols-3 gap-2">
                         <div class="space-y-1"><span class="text-[8px] text-text-muted">X</span><input type="number" value={Math.round(el().x)} onInput={(e) => updateTypographyElement(el().id, { x: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1 border border-border-color rounded text-xs" /></div>
                         <div class="space-y-1"><span class="text-[8px] text-text-muted">Y</span><input type="number" value={Math.round(el().y)} onInput={(e) => updateTypographyElement(el().id, { y: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1 border border-border-color rounded text-xs" /></div>
                         <div class="space-y-1"><span class="text-[8px] text-text-muted">ROT</span><input type="number" value={el().rotation || 0} onInput={(e) => updateTypographyElement(el().id, { rotation: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1 border border-border-color rounded text-xs" /></div>
                       </div>
                     </div>

                     <div class="space-y-3">
                       <label class="text-[10px] font-bold uppercase tracking-wider text-text-muted">Fill & Stroke</label>
                       <div class="flex items-center gap-3">
                         <input type="color" value={(el() as any).fill || '#ffffff'} onInput={(e) => updateTypographyElement(el().id, { fill: e.currentTarget.value })} class="w-8 h-8 rounded border border-border-color bg-transparent cursor-pointer" title="Fill Color" />
                         <input type="color" value={(el() as any).stroke || '#000000'} onInput={(e) => updateTypographyElement(el().id, { stroke: e.currentTarget.value })} class="w-8 h-8 rounded border border-border-color bg-transparent cursor-pointer" title="Stroke Color" />
                         <div class="flex-1 flex flex-col gap-1">
                           <span class="text-[8px] text-text-muted">Stroke Width</span>
                           <input type="range" min="0" max="100" value={(el() as any).strokeWidth || 0} onInput={(e) => updateTypographyElement(el().id, { strokeWidth: parseInt(e.currentTarget.value) })} class="w-full" />
                         </div>
                       </div>
                     </div>

                     <div class="w-full border-t border-border-color"></div>

                     <div class="space-y-3 bg-blueprint-50/50 dark:bg-brand-500/5 border border-blueprint-100 dark:border-brand-500/10 p-3 rounded-xl">
                       <label class="text-[10px] font-bold uppercase tracking-wider text-blueprint-700 dark:text-brand-400 flex items-center gap-1.5"><Icon name="zap" class="w-3.5 h-3.5" /> Animation</label>
                       <select 
                         value={el().animPreset || 'none'} 
                         onChange={(e) => updateTypographyElement(el().id, { animPreset: e.currentTarget.value as TypographyAnimPreset })}
                         class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-blueprint-200 dark:border-brand-500/20 rounded-lg text-sm font-semibold"
                       >
                         <option value="none">None (Static)</option>
                         <option value="stop-motion">Organic Stop Motion</option>
                         <option value="pop-up">Pop Up</option>
                         <option value="drop-down">Drop Down</option>
                         <option value="kinetic-drop">Kinetic Drop</option>
                         <option value="throw">Throw / Bounce</option>
                         <option value="sam-hogan">Slam & Shake</option>
                       </select>
                       <div class="grid grid-cols-2 gap-3 mt-2">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Duration (s)</label>
                           <input type="number" step="0.1" value={el().animDuration || 1} onInput={(e) => updateTypographyElement(el().id, { animDuration: parseFloat(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 rounded text-xs" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Stagger (s)</label>
                           <input type="number" step="0.05" value={el().animStagger || 0} onInput={(e) => updateTypographyElement(el().id, { animStagger: parseFloat(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 rounded text-xs" />
                         </div>
                       </div>
                       <div class="grid grid-cols-2 gap-3 mt-1">
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Impact Shake</label>
                           <input type="number" value={el().animShake !== undefined ? el().animShake : 20} onInput={(e) => updateTypographyElement(el().id, { animShake: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 rounded text-xs" />
                         </div>
                         <div class="space-y-1.5">
                           <label class="text-[9px] font-bold uppercase tracking-wider text-text-muted">Motion Blur</label>
                           <input type="number" value={el().animMotionBlur || 0} onInput={(e) => updateTypographyElement(el().id, { animMotionBlur: parseInt(e.currentTarget.value) })} class="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 rounded text-xs" />
                         </div>
                       </div>
                     </div>

                   </div>
                )}
             </Show>
          </Show>

        </div>
      </div>
      
      {/* Export Modal integration */}
      <Show when={isExporting()}>
        <ExportModal onClose={() => setIsExporting(false)} />
      </Show>

    </div>
  );
}
