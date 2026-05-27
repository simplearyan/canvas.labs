import { createSignal, Show, onMount } from "solid-js";
import Icon from "../ui/Icon";
import { openQuickEditor } from "../../store/global";
import type { Preset } from "../../store/global";

interface PresetCardProps {
  preset: Preset;
}

export default function PresetCard(props: PresetCardProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [isVideoReady, setIsVideoReady] = createSignal(false);
  let videoRef: HTMLVideoElement | undefined;
  let imgRef: HTMLImageElement | undefined;

  onMount(() => {
    if (imgRef && imgRef.complete) {
      setImageLoaded(true);
    }
  });

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
    setIsVideoReady(false);
    if (videoRef) {
      videoRef.pause();
    }
  };

  // Resolve preview asset path (fallback to static thumbnail if not ready)
  const slug = props.preset.url ? props.preset.url.split("/").pop() : null;
  const isTypography = props.preset.category === "text" || props.preset.url?.includes('typography');
  const mediaFolder = isTypography ? 'typography' : 'charts';
  const previewVideoUrl = slug ? `/canvas.labs/previews/${mediaFolder}/${slug}.webm` : null;

  return (
    <div 
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      class="group flex flex-col gap-4.5 cursor-pointer bg-transparent border border-transparent hover:bg-black/[0.015] dark:hover:bg-white/[0.015] hover:border-black/5 dark:hover:border-white/5 p-4 rounded-[32px] transition-all duration-500 ease-out shadow-none hover:shadow-2xl hover:shadow-black/[0.02] dark:hover:shadow-white/[0.01]"
    >
      {/* Thumbnail Placeholder with color gradient */}
      <div 
        class={`w-full aspect-[4/3] rounded-[24px] flex items-center justify-center relative overflow-hidden transition-all duration-500 ease-out isolate transform translate-z-0 ${props.preset.color}`}
        style="-webkit-mask-image: -webkit-radial-gradient(white, black);"
      >

        {/* Static End Frame Image (Lighthouse & SEO friendly, lazy loaded) */}
        <Show when={slug}>
          <img
            ref={imgRef}
            src={`/canvas.labs/previews/${mediaFolder}/${slug}.png`}
            alt={props.preset.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out pointer-events-none z-0"
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
            onPlaying={() => setIsVideoReady(true)}
            class={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out pointer-events-none z-10 ${isHovered() && isVideoReady() ? 'opacity-100' : 'opacity-0'}`}
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

