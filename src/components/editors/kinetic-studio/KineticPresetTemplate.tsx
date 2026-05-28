import { createSignal, createEffect, onCleanup, onMount } from 'solid-js';
import { deserializeKineticState } from '@/engines/kinetic-studio/KineticEngineUtils';
import { renderFrame, SLIDE_DURATION } from '@/engines/kinetic-studio/KineticEngine';
import type { KineticState } from '@/engines/kinetic-studio/types';
import Icon from '../../ui/Icon';

const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;

// Default presets mapping just in case we want to show specific demos based on slug
const getPresetBySlug = (slug: string): KineticState => {
  // We can just rely on the default state defined in Utils for now,
  // or return custom pre-built states depending on the slug.
  return deserializeKineticState(null); 
};

export default function KineticPresetTemplate(props: { slug: string; encodedState?: string }) {
  const [state, setState] = createSignal<KineticState>(
    props.encodedState ? deserializeKineticState(props.encodedState) : getPresetBySlug(props.slug)
  );

  const [isPlaying, setIsPlaying] = createSignal(true);
  const [globalTime, setGlobalTime] = createSignal(0);
  
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let animationFrameId: number;
  let lastTimestamp = 0;

  const maxDuration = () => state().slides.length * SLIDE_DURATION;

  const requestRender = () => {
    if (!canvasRef || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const scale = Math.min(rect.width / 800, rect.height / 500);
    const offsetX = (rect.width - 800 * scale) / 2;
    const offsetY = (rect.height - 500 * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    renderFrame(ctx, globalTime(), 800, 500, state().slides, false, false, isPlaying(), null);
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

  createEffect(() => {
    state(); globalTime();
    requestRender();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => requestRender());
    if (containerRef) observer.observe(containerRef);

    lastTimestamp = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);

    onCleanup(() => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });
  });

  return (
    <div class="flex-1 w-full max-w-7xl mx-auto p-4 md:p-10 flex flex-col items-center">
      
      {/* Editor Header for Preset */}
      <div class="w-full mb-6 flex justify-between items-end">
        <div>
          <h1 class="text-2xl font-black text-text-main capitalize">Kinetic Preset: {props.slug.replace(/-/g, ' ')}</h1>
          <p class="text-text-muted mt-1 text-sm">Preview mode</p>
        </div>
        <a 
          href={`${base}/editor/kinetic-studio`}
          class="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer text-sm"
        >
          <Icon name="maximize" class="w-4 h-4" /> Open in Full Editor
        </a>
      </div>

      <div class="w-full flex flex-col items-center gap-6 bg-card-bg border border-border-color p-6 md:p-10 rounded-2xl shadow-sm relative">
        <div 
          ref={containerRef}
          class="w-full max-w-5xl aspect-video bg-black rounded-2xl shadow-xl overflow-hidden ring-1 ring-border-color"
          style={{
            "background-image": "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            "background-size": "24px 24px"
          }}
        >
          <canvas ref={canvasRef} class="absolute inset-0 w-full h-full"></canvas>
        </div>

        <div class="w-full max-w-5xl h-16 bg-black/5 dark:bg-white/5 border border-border-color rounded-2xl flex items-center gap-4 px-6">
          <button 
            onClick={() => {
              setIsPlaying(!isPlaying());
              if (!isPlaying()) requestRender();
            }} 
            class="text-brand-500 hover:scale-105 transition-transform flex items-center justify-center shrink-0"
          >
            {isPlaying() ? <Icon name="pause" class="w-6 h-6" /> : <Icon name="play" class="w-6 h-6 fill-current" />}
          </button>
          
          <input 
            type="range" 
            min="0" max={maxDuration()} step="0.01" 
            value={globalTime()} 
            onInput={(e) => {
              setGlobalTime(parseFloat(e.currentTarget.value));
              if (!isPlaying()) requestRender();
            }}
            class="flex-1 accent-brand-500 cursor-pointer h-1.5 bg-border-color rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500"
          />
          <div class="font-mono text-sm font-bold text-text-muted w-12 text-right">
            {globalTime().toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  );
}
