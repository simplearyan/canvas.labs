import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';
import { chartStore, loadStateFromUrl, updateChartOptions } from '../../../store/chartStore';
import { ChartEngine } from '../../../engines/chart-animator/ChartEngine';

export default function ChartEditor() {
  let canvasRef!: HTMLCanvasElement;
  let engine: ChartEngine;

  const [isLoaded, setIsLoaded] = createSignal(false);

  onMount(() => {
    // 1. Check for URL State (from Template transitions)
    const urlParams = new URLSearchParams(window.location.search);
    const encodedConfig = urlParams.get('config');
    
    if (encodedConfig) {
      const success = loadStateFromUrl(encodedConfig);
      if (success) console.log("Loaded custom state from URL seamlessly!");
    }

    // 2. Initialize Canvas Engine
    engine = new ChartEngine(canvasRef);
    setIsLoaded(true);

    // Initial resize
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
      // Keep 16:9 aspect ratio but fit inside container
      const width = parent.clientWidth - 32;
      const height = (width * 9) / 16;
      
      // Update engine internal resolution (High DPI for crisp text)
      engine.setDimensions(1920, 1080, window.devicePixelRatio || 1);
      
      // Update CSS display size
      canvasRef.style.width = `${width}px`;
      canvasRef.style.height = `${height}px`;
    }
  };

  // 3. Reactive loop: When chartStore changes, push to Engine
  createEffect(() => {
    if (isLoaded() && engine) {
      // In a real app we'd deep clone or pass carefully. Here we just pass the store proxy.
      // SolidJS tracks this because we access chartStore inside createEffect.
      // By passing JSON.parse(JSON.stringify(chartStore)) we force evaluation of all nested props
      const snapshot = JSON.parse(JSON.stringify(chartStore));
      engine.updateState(snapshot);
    }
  });

  const handlePlay = () => engine.play();
  const handlePause = () => engine.pause();

  return (
    <div class="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">
      
      {/* Sidebar Controls (Left) */}
      <aside class="w-full md:w-[420px] bg-card-bg border-r border-border-color p-5 flex flex-col gap-6 overflow-y-auto z-10 shrink-0 shadow-xl">
        <div class="text-[10px] font-black text-brand-500 uppercase tracking-widest bg-brand-500/10 px-2 py-1 inline-block w-max">
          Advanced Tool Properties
        </div>

        <div class="flex flex-col gap-3">
          <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Background Color</label>
          <div class="flex items-center gap-3">
            <input 
              type="color" 
              value={chartStore.options.bgColor} 
              onInput={(e) => updateChartOptions({ bgColor: e.currentTarget.value })}
              class="w-10 h-10 cursor-pointer border border-border-color rounded bg-transparent p-0" 
            />
            <span class="text-xs font-mono">{chartStore.options.bgColor}</span>
          </div>
        </div>
        
        <div class="flex flex-col gap-3 mt-4">
           <label class="text-xs font-bold uppercase tracking-wider text-text-muted">Engine Controls</label>
           <div class="flex gap-2">
             <button onClick={handlePlay} class="px-4 py-2 bg-brand-500 text-white text-xs font-bold rounded shadow-lg hover:bg-brand-600 transition uppercase tracking-wider flex-1">
               Play Animation
             </button>
             <button onClick={handlePause} class="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded hover:bg-gray-700 transition uppercase tracking-wider">
               Pause
             </button>
           </div>
        </div>

        <div class="mt-8 p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl text-xs leading-relaxed text-text-main">
          <p class="font-bold mb-2 uppercase tracking-wide text-brand-500">Notice</p>
          <p>This is the fully ported SolidJS Chart Animator Advanced Editor.</p>
          <p class="mt-2 text-text-muted">The canvas engine is running in pure TypeScript, isolated from the UI.</p>
        </div>
      </aside>

      {/* Canvas Area (Right) */}
      <section class="flex-1 relative flex items-center justify-center p-4 sm:p-12 bg-sidebar-bg">
        {/* Editor alignment grid backdrop */}
        <div class="absolute inset-0 bg-[radial-gradient(var(--border-color)_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none"></div>
        
        <div class="relative bg-card-bg shadow-2xl border border-border-color flex items-center justify-center overflow-hidden ring-1 ring-white/10" style="border-radius: 4px;">
           <canvas ref={canvasRef} class="block bg-black shadow-inner"></canvas>
        </div>
      </section>
      
    </div>
  );
}
