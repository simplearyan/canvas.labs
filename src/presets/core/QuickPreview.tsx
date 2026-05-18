import { Show } from "solid-js";
import Icon from "../../components/ui/Icon";
import {
  canvasBgColor,
  isPlaybackPlaying,
  setIsPlaybackPlaying
} from "../../store/global";

interface QuickPreviewProps {
  canvasRef: HTMLCanvasElement | undefined;
  onCanvasRefChange: (el: HTMLCanvasElement) => void;
}

export default function QuickPreview(props: QuickPreviewProps) {
  return (
    <div class="lg:col-span-2 flex flex-col gap-4">
      <div 
        class="w-full aspect-video rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative"
        style={{ "background-color": canvasBgColor() }}
      >
        <canvas 
          ref={props.onCanvasRefChange} 
          width="1280" 
          height="720"
          class="w-full h-full object-contain"
        ></canvas>
      </div>

      {/* Playback Controls */}
      <div class="flex items-center justify-between text-sm text-text-muted px-2">
        <div class="flex items-center gap-4">
          <button 
            onClick={() => setIsPlaybackPlaying(!isPlaybackPlaying())}
            class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-text-main transition-colors cursor-pointer"
          >
            <Show when={isPlaybackPlaying()} fallback={<Icon name="play" class="w-4 h-4 fill-current ml-0.5" />}>
              <Icon name="pause" class="w-4 h-4" />
            </Show>
          </button>
          <div class="h-1.5 w-32 md:w-64 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-brand-500 w-1/3"></div>
          </div>
          <span class="font-mono text-xs">0:01 / 0:03</span>
        </div>
        <div class="hidden sm:flex items-center gap-3 text-xs">
          <span>1080p WebM</span>
          <span>•</span>
          <span>60 FPS</span>
        </div>
      </div>
    </div>
  );
}
