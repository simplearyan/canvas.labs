import { createSignal, Show } from "solid-js";

interface SnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (resolution: "1080" | "1440" | "2160", transparent: boolean) => Promise<void>;
  projectTitle: string;
}

export default function SnapshotModal(props: SnapshotModalProps) {
  const [resolution, setResolution] = createSignal<"1080" | "1440" | "2160">("1080");
  const [transparent, setTransparent] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  const handleDownload = async () => {
    setLoading(true);
    // Tiny timeout to let UI register loading state
    setTimeout(async () => {
      try {
        await props.onExport(resolution(), transparent());
        props.onClose();
      } catch (err: any) {
        console.error("Failed to download snapshot:", err);
      } finally {
        setLoading(false);
      }
    }, 50);
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-slate-950/75 dark:bg-black/80 flex items-center justify-center p-4 animate-pure-fade-in backdrop-blur-sm">
        <div class="bg-white dark:bg-zinc-950 border border-blueprint-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 sm:p-8 max-w-md w-full relative flex flex-col gap-6 text-slate-800 dark:text-text-main animate-fade-in">
          {/* Close button */}
          <button 
            onClick={props.onClose} 
            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-400 dark:text-text-muted hover:text-red-500 dark:hover:text-red-400 transition cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>

          {/* Title Header */}
          <div class="flex flex-col gap-1.5 pr-8">
            <h3 class="text-xl font-black text-blueprint-900 dark:text-brand-500 uppercase tracking-tighter">
              Export Frame Snapshot
            </h3>
            <p class="text-xs text-slate-500 dark:text-text-muted font-semibold leading-relaxed">
              Save the current playhead frame as a high-resolution PNG image.
            </p>
          </div>

          <div class="flex flex-col gap-5">
            {/* Resolution Selector */}
            <div class="flex flex-col gap-2">
              <label class="text-[10px] font-extrabold text-blueprint-900 dark:text-brand-500 uppercase tracking-widest">Target Resolution</label>
              <select 
                value={resolution()} 
                onInput={(e) => setResolution(e.currentTarget.value as any)} 
                class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-blueprint-200 dark:border-zinc-800 text-slate-800 dark:text-text-main text-xs font-bold outline-none focus:border-blueprint-900 dark:focus:border-brand-500 cursor-pointer rounded-xl"
              >
                <option value="1080">HD (1080p Layout)</option>
                <option value="1440">2K Super HD (1440p Layout)</option>
                <option value="2160">4K Ultra HD (2160p Canvas)</option>
              </select>
            </div>

            {/* Transparent Alpha Checkbox */}
            <button
              onClick={() => setTransparent(!transparent())}
              class="flex items-center justify-between bg-slate-50 dark:bg-zinc-900/50 p-4 border border-blueprint-100 dark:border-zinc-800 hover:bg-blueprint-50/20 dark:hover:bg-zinc-900 transition-colors text-left rounded-xl cursor-pointer"
              type="button"
            >
              <div class="flex flex-col gap-0.5 select-none pr-3">
                <span class="text-xs font-black text-slate-800 dark:text-text-main uppercase tracking-wider">Transparent Background</span>
                <span class="text-[9px] text-slate-400 dark:text-text-muted font-semibold leading-normal">PNG alpha transparency layer with no background solid color fill.</span>
              </div>
              <div class={`relative w-9 h-5.5 transition-colors duration-200 rounded-full border shrink-0 ${transparent() ? 'bg-blueprint-900 border-blueprint-950 dark:bg-brand-500 dark:border-brand-600' : 'bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:border-zinc-750'}`}>
                <div class={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${transparent() ? 'translate-x-4' : 'translate-x-0.5'}`}></div>
              </div>
            </button>

            {/* Action Trigger Button */}
            <button 
              onClick={handleDownload} 
              disabled={loading()}
              class="w-full py-4 bg-blueprint-900 hover:bg-blueprint-850 dark:bg-brand-500 dark:hover:bg-brand-600 text-white dark:text-zinc-950 font-black uppercase tracking-widest transition shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer rounded-xl flex items-center justify-center gap-2"
            >
              <Show when={loading()} fallback={
                <>
                  <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
                  </svg>
                  <span>Download PNG Frame</span>
                </>
              }>
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Rendering Frame...</span>
              </Show>
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
