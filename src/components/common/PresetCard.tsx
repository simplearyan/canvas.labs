import { createSignal, Show } from "solid-js";
import Icon from "../ui/Icon";
import { openQuickEditor } from "../../store/global";
import type { Preset } from "../../store/global";

interface PresetCardProps {
  preset: Preset;
}

export default function PresetCard(props: PresetCardProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  let videoRef: HTMLVideoElement | undefined;

  const handleClick = () => {
    if (props.preset.url) {
      // It's a dedicated Astro Page template (like our new Chart Animators)
      window.location.href = props.preset.url;
    } else {
      // It's an internal SPA canvas component
      openQuickEditor(props.preset);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef) {
      videoRef.currentTime = 0;
      videoRef.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef) {
      videoRef.pause();
    }
  };

  // Resolve preview asset path (fallback to static thumbnail if not ready)
  const slug = props.preset.url ? props.preset.url.split("/").pop() : null;
  const previewVideoUrl = slug ? `/canvas.labs/previews/charts/${slug}.webm` : null;

  return (
    <div 
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      class="group flex flex-col gap-3.5 cursor-pointer bg-card-bg border border-border-color rounded-2xl p-4 transition-all duration-300 hover:border-blueprint-900 dark:hover:border-brand-500 hover:shadow-lg"
    >
      {/* Thumbnail Placeholder with color gradient */}
      <div class={`w-full aspect-[4/3] rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300 ${props.preset.color}`}>
        {/* Dynamic category badge */}
        <span class="absolute top-3 left-3 z-10 text-[10px] font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-white border border-white/10">
          {props.preset.category}
        </span>

        {/* Static End Frame Image (Lighthouse & SEO friendly, lazy loaded) */}
        <Show when={slug}>
          <img
            src={`/canvas.labs/previews/charts/${slug}.png`}
            alt={props.preset.title}
            loading="lazy"
            class={`absolute inset-0 w-full h-full object-cover transition-all duration-300 pointer-events-none ${isHovered() ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            onError={(e) => {
              // Hide image if it fails to load, gracefully falling back to styling gradients
              e.currentTarget.style.display = 'none';
            }}
          />
        </Show>
        
        {/* Dynamic WebM Video Loop (Lazy Play on Hover) */}
        <Show when={previewVideoUrl}>
          <video
            ref={videoRef}
            src={previewVideoUrl}
            loop
            muted
            playsinline
            preload="none"
            class={`absolute inset-0 w-full h-full object-cover transition-all duration-300 pointer-events-none ${isHovered() ? 'opacity-100 scale-105' : 'opacity-0 scale-100'}`}
          />
        </Show>

        {/* Abstract Mock Canvas Graphic (visible only if no static image loads) */}
        <div class="text-white font-black text-2xl tracking-tighter opacity-80 select-none pointer-events-none">
          {props.preset.title.split(":")[0]}
        </div>
      </div>
      
      {/* Info */}
      <div class="flex items-center justify-between px-1">
        <h3 class="font-bold text-[15px] text-text-main group-hover:text-blueprint-900 dark:group-hover:text-brand-500 transition-colors">
          {props.preset.title}
        </h3>
        <Icon name="chevron-right" class="w-4 h-4 text-text-muted group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}
