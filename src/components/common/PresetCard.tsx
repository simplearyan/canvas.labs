import Icon from "../ui/Icon";
import { openQuickEditor } from "../../store/global";
import type { Preset } from "../../store/global";

interface PresetCardProps {
  preset: Preset;
}

export default function PresetCard(props: PresetCardProps) {
  const handleClick = () => {
    if (props.preset.url) {
      // It's a dedicated Astro Page template (like our new Chart Animators)
      window.location.href = props.preset.url;
    } else {
      // It's an internal SPA canvas component
      openQuickEditor(props.preset);
    }
  };

  return (
    <div 
      onClick={handleClick}
      class="group flex flex-col gap-3.5 cursor-pointer bg-card-bg border border-border-color rounded-2xl p-4 transition-colors duration-200"
    >
      {/* Thumbnail Placeholder with color gradient */}
      <div class={`w-full aspect-[4/3] rounded-xl flex items-center justify-center relative overflow-hidden ${props.preset.color}`}>
        {/* Dynamic category badge */}
        <span class="absolute top-3 left-3 text-[10px] font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-white border border-white/10">
          {props.preset.category}
        </span>
        
        {/* Abstract Mock Canvas Graphic */}
        <div class="text-white font-black text-2xl tracking-tighter opacity-80 select-none">
          {props.preset.title.split(":")[0]}
        </div>
      </div>
      
      {/* Info */}
      <div class="flex items-center justify-between px-1">
        <h3 class="font-bold text-[15px] text-text-main transition-colors">
          {props.preset.title}
        </h3>
        <Icon name="chevron-right" class="w-4 h-4 text-text-muted transition-all" />
      </div>
    </div>
  );
}
