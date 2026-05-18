import Icon from "../../components/ui/Icon";
import {
  canvasText,
  setCanvasText,
  canvasBgColor,
  setCanvasBgColor,
  canvasAccentColor,
  setCanvasAccentColor
} from "../../store/global";

export default function ChartQuickControls() {
  return (
    <div class="space-y-4">
      <h3 class="font-bold text-xs text-text-main uppercase tracking-widest flex items-center gap-2">
        <Icon name="sliders" class="w-4 h-4 text-brand-500" /> Chart Adjustments
      </h3>

      <div class="space-y-3.5">
        <div>
          <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Chart Title</label>
          <input 
            type="text" 
            value={canvasText()}
            onInput={(e) => setCanvasText(e.currentTarget.value.toUpperCase())}
            class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-xl px-3.5 py-2 text-sm font-semibold text-text-main focus:bg-card-bg focus:border-brand-500 focus:outline-none transition-all"
          />
        </div>
        
        <div class="grid grid-cols-2 gap-3.5">
          <div>
            <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Bar Fill Color</label>
            <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl">
              <input 
                type="color" 
                value={canvasAccentColor()}
                onInput={(e) => setCanvasAccentColor(e.currentTarget.value)}
                class="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border border-border-color"
              />
              <span class="text-xs font-mono font-bold uppercase truncate">{canvasAccentColor()}</span>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Backdrop Color</label>
            <div class="flex items-center gap-2.5 bg-black/5 dark:bg-white/5 border border-border-color px-2.5 py-1.5 rounded-xl">
              <input 
                type="color" 
                value={canvasBgColor()}
                onInput={(e) => setCanvasBgColor(e.currentTarget.value)}
                class="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border border-border-color"
              />
              <span class="text-xs font-mono font-bold uppercase truncate">{canvasBgColor()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
