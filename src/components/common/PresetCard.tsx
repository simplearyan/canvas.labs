import { createSignal, Show } from "solid-js";
import Icon from "../ui/Icon";
import { openQuickEditor } from "../../store/global";
import type { Preset } from "../../store/global";

interface PresetCardProps {
  preset: Preset;
}

export default function PresetCard(props: PresetCardProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [imageLoaded, setImageLoaded] = createSignal(false);
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
      class="group flex flex-col gap-3.5 cursor-pointer bg-card-bg rounded-2xl p-4 transition-all duration-300"
    >
      {/* Thumbnail Placeholder with color gradient */}
      <div 
        class={`w-full aspect-[4/3] rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-500 isolate transform translate-z-0 ${props.preset.color}`}
        style="-webkit-mask-image: -webkit-radial-gradient(white, black);"
      >

        {/* Static End Frame Image (Lighthouse & SEO friendly, lazy loaded) */}
        <Show when={slug}>
          <img
            src={`/canvas.labs/previews/charts/${slug}.png`}
            alt={props.preset.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            class={`absolute inset-0 w-full h-full object-cover transition-all duration-500 pointer-events-none z-0 ${isHovered() ? 'scale-[1.07]' : 'scale-[1.02]'}`}
            onError={(e) => {
              // Hide image if it fails to load, gracefully falling back to styling gradients
              e.currentTarget.style.display = 'none';
              setImageLoaded(false);
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
            class={`absolute inset-0 w-full h-full object-cover transition-all duration-500 pointer-events-none z-10 ${isHovered() ? 'opacity-100 scale-[1.07]' : 'opacity-0 scale-[1.02]'}`}
          />
        </Show>

        {/* Abstract Mock Canvas Graphic (visible only if no static image loads) */}
        <Show when={!imageLoaded()}>
          <div class="text-white font-black text-2xl tracking-tighter opacity-80 select-none pointer-events-none z-20">
            {props.preset.title.split(":")[0]}
          </div>
        </Show>
      </div>
      
      {/* Info */}
      <div class="flex items-center justify-between px-1">
        <h3 class="font-bold text-[15px] text-text-main">
          {props.preset.title}
        </h3>
      </div>
    </div>
  );
}
