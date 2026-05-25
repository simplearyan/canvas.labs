import { createEffect, createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { isDarkTheme } from "@/store/global";
import { exportProject, type ExportConfig } from "@/engines/chart-animator/ExportEngine";
import { EXPORT_TIPS } from "@/config/exportTips";
import Icon from "../ui/Icon";
import { SITE_CONFIG } from "@/config/site";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartStore: any;
  aspectRatio: string;
}

export default function ExportModal(props: ExportModalProps) {
  // Option Selectors
  const [exportRes, setExportRes] = createSignal<'720' | '1080' | '1440' | '2160'>('1080');
  const [exportFormat, setExportFormat] = createSignal<'webm' | 'mp4' | 'mov' | 'zip'>('webm');
  const [exportFps, setExportFps] = createSignal<number>(60);

  // Export State Machine
  const [exportActive, setExportActive] = createSignal(false);
  const [exportPaused, setExportPaused] = createSignal(false);
  const [exportCancelled, setExportCancelled] = createSignal(false);
  const [exportProgress, setExportProgress] = createSignal(0);
  const [exportStatus, setExportStatus] = createSignal("");

  // Slide loops
  const [supportMessageIdx, setSupportMessageIdx] = createSignal(0);
  const [tipsIdx, setTipsIdx] = createSignal(0);

  let supportIntervalId: any = null;
  let tipsIntervalId: any = null;

  // Track if Google AdSense script has been injected
  onMount(() => {
    // 1. Setup rotating timers for pre-export support slides
    supportIntervalId = setInterval(() => {
      setSupportMessageIdx((prev) => (prev + 1) % 3);
    }, 4500);

    // 2. Setup rotating timer for tips carousel during export
    tipsIntervalId = setInterval(() => {
      setTipsIdx((prev) => (prev + 1) % EXPORT_TIPS.length);
    }, 4000);

    // 3. Register Google AdSense script dynamically
    const ADSENSE_ID = "google-adsense-script";
    if (!document.getElementById(ADSENSE_ID)) {
      const script = document.createElement("script");
      script.id = ADSENSE_ID;
      script.async = true;
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7993314093599705";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });

  // Load new ad once export starts (Kenichi loop)
  createEffect(() => {
    if (exportActive()) {
      setTimeout(() => {
        try {
          (window as any).adsbygoogle = (window as any).adsbygoogle || [];
          (window as any).adsbygoogle.push({});
        } catch (_) { }
      }, 400);
    }
  });

  onCleanup(() => {
    if (supportIntervalId) clearInterval(supportIntervalId);
    if (tipsIntervalId) clearInterval(tipsIntervalId);
  });

  const startExport = async () => {
    setExportActive(true);
    setExportPaused(false);
    setExportCancelled(false);
    setExportProgress(0);
    setExportStatus("Initializing Export...");

    try {
      const config: ExportConfig = {
        format: exportFormat(),
        resolution: exportRes(),
        fps: exportFps(),
        aspectRatio: props.aspectRatio as any,
      };

      const controller = {
        isPaused: () => exportPaused(),
        isCancelled: () => exportCancelled(),
      };

      // Deep copy to lock down the exact state snapshot for worker thread
      const snapshot = JSON.parse(JSON.stringify(props.chartStore));

      const result = await exportProject(
        config,
        snapshot,
        (progress, status) => {
          setExportProgress(progress);
          setExportStatus(status);
        },
        controller
      );

      // Trigger standard browser download
      const ext = exportFormat() === "zip" ? "zip" : exportFormat();
      const mime = exportFormat() === "zip" ? "application/zip" : `video/${ext}`;

      const blob = new Blob([result], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${props.chartStore.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      // Reset Modal & close on successful complete
      setExportActive(false);
      props.onClose();
    } catch (e: any) {
      if (e.message !== "Export Cancelled") {
        alert("Export Error: " + e.message);
      }
    } finally {
      setExportActive(false);
    }
  };

  const handleClose = () => {
    if (exportActive()) {
      // Prompt cancellation confirmation if export is active
      const confirmCancel = confirm("Are you sure you want to cancel the active render? All progress will be lost.");
      if (confirmCancel) {
        setExportCancelled(true);
        props.onClose();
      }
    } else {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/70 flex items-center justify-center p-4 transition-all duration-300 backdrop-blur-sm">

        {/* Unified Premium Slide Transition Styles */}
        <style>{`
          @keyframes slideFadeIn {
            0% { opacity: 0; transform: translateY(8px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .animate-slide-fade {
            animation: slideFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .slide-transition-container {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
        `}</style>

        <div class="bg-card-bg border border-border-color shadow-2xl p-6 md:p-8 w-full relative flex flex-col md:flex-row gap-6 text-text-main rounded-2xl max-w-md md:max-w-3xl h-[680px] md:h-[475px] overflow-y-auto md:overflow-hidden custom-scrollbar">

          {/* Close Button */}
          <button
            onClick={handleClose}
            class="absolute top-4 right-4 z-10 text-text-muted hover:text-red-500 transition cursor-pointer p-1.5 rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center"
            aria-label="Close Export Modal"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Left Column: Export Controls & Progress */}
          <div class="flex-1 flex flex-col gap-5 justify-between">
            <div class="flex flex-col gap-1">
              <h3 class="text-lg font-black text-brand-500 uppercase tracking-tight">
                {exportActive() ? 'Rendering Animation' : 'Export Animation'}
              </h3>
              <p class="text-xs text-text-muted font-semibold tracking-wide">
                {exportActive() ? exportStatus() : 'Select your rendering configurations.'}
              </p>
            </div>

            {!exportActive() ? (
              <div class="flex flex-col gap-4">
                {/* Resolution Selector */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-extrabold text-brand-500 uppercase tracking-wider">Resolution</label>
                  <select
                    value={exportRes()}
                    onInput={(e) => setExportRes(e.currentTarget.value as any)}
                    class="w-full px-3 py-2.5 bg-black/5 dark:bg-white/5 border border-border-color text-text-main text-sm font-semibold outline-none focus:border-brand-500 cursor-pointer rounded-xl transition-all"
                  >
                    <option class="bg-card-bg" value="720">720p (HD Layout)</option>
                    <option class="bg-card-bg" value="1080">1080p (FHD Standard)</option>
                    <option class="bg-card-bg" value="1440">1440p (2K Premium)</option>
                    <option class="bg-card-bg" value="2160">2160p (4K Ultra-HD)</option>
                  </select>
                </div>

                {/* Framerate Options */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-extrabold text-brand-500 uppercase tracking-wider">Framerate</label>
                  <div class="flex gap-2">
                    {[24, 30, 60].map(fps => (
                      <button
                        onClick={() => setExportFps(fps)}
                        class={`flex-1 py-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all rounded-xl ${exportFps() === fps
                            ? 'bg-brand-500/10 border border-brand-500 text-brand-500 font-extrabold shadow-sm'
                            : 'border border-border-color bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main hover:border-brand-500/50'
                          }`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                </div>

                {/* Formats Grid */}
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-extrabold text-brand-500 uppercase tracking-wider">Format</label>
                  <div class="grid grid-cols-2 gap-2">
                    {['webm', 'mp4', 'mov', 'zip'].map(fmt => (
                      <button
                        onClick={() => setExportFormat(fmt as any)}
                        class={`py-2.5 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all rounded-xl ${exportFormat() === fmt
                            ? 'bg-brand-500/10 border border-brand-500 text-brand-500 font-extrabold shadow-sm'
                            : 'border border-border-color bg-black/5 dark:bg-white/5 text-text-muted hover:text-text-main hover:border-brand-500/50'
                          }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Start Render Trigger */}
                <button
                  onClick={startExport}
                  class="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-extrabold uppercase tracking-wider transition-all rounded-xl mt-2 cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                  style={{ color: isDarkTheme() ? '#09090b' : '#ffffff' }}
                >
                  Start Render
                </button>
              </div>
            ) : (
              // Export Rendering Phase - Progress, Cycling Tips & Controls
              <div class="flex flex-col gap-5 justify-center py-2 flex-1">
                <div class="w-full bg-black/5 dark:bg-white/5 h-3.5 overflow-hidden border border-border-color relative rounded-full shadow-inner">
                  <div class="h-full bg-brand-500 transition-all duration-300 ease-out" style={{ width: `${exportProgress()}%` }}></div>
                </div>

                <div class="flex justify-between items-center text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                  <span>Rendering Progress</span>
                  <span class="text-brand-500 font-black">{exportProgress()}%</span>
                </div>

                {/* Animated Tips Banner (Loops through EXPORT_TIPS config dynamically) */}
                <div class="rounded-xl border border-border-color bg-brand-500/[0.02] dark:bg-brand-500/[0.01] px-4.5 py-3 flex gap-3.5 items-center select-none overflow-hidden relative h-[88px] shrink-0 shadow-sm mt-1.5">
                  <For each={EXPORT_TIPS}>
                    {(tip, idx) => (
                      <Show when={tipsIdx() === idx()}>
                        <div class="animate-slide-fade flex gap-3.5 items-center w-full">
                          {/* Custom Category Colored Icon Badge */}
                          <div class={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border shadow-sm ${tip.category === 'performance' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                              tip.category === 'format' ? 'bg-purple-500/10 border-purple-500/20 text-purple-500' :
                                tip.category === 'design' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                  'bg-blue-500/10 border-blue-500/20 text-blue-500'
                            }`}>
                            <Icon name={tip.icon} class="w-4.5 h-4.5" />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="text-[9px] font-black uppercase tracking-wider text-brand-500">{tip.category} TIP</span>
                            </div>
                            <h4 class="text-xs font-bold text-text-main truncate mt-0.5">{tip.title}</h4>
                            <p class="text-[10px] text-text-muted leading-tight mt-0.5 line-clamp-2">{tip.content}</p>
                          </div>
                        </div>
                      </Show>
                    )}
                  </For>
                </div>

                <div class="flex gap-3 mt-1">
                  <button
                    onClick={() => setExportPaused(!exportPaused())}
                    class="flex-1 py-3 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-text-main font-bold uppercase tracking-wider transition-all border border-border-color cursor-pointer rounded-xl text-xs"
                  >
                    {exportPaused() ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={() => setExportCancelled(true)}
                    class="flex-1 py-3 border border-red-650/30 text-red-500 hover:bg-red-550/10 hover:border-red-500/50 font-bold uppercase tracking-wider transition-all cursor-pointer rounded-xl text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Support Slides OR Live Ad + Tips Slider */}

          {/* A. BEFORE EXPORT: looping support slides */}
          <Show when={!exportActive()}>
            <div class="w-full md:w-[320px] md:self-center rounded-xl border border-border-color bg-black/[0.01] dark:bg-white/[0.01] p-5 flex flex-col items-center justify-center text-center overflow-hidden relative h-[260px] md:h-[270px] shrink-0" style={{}}>

              {/* Slide 0 — Star */}
              <Show when={supportMessageIdx() === 0}>
                <div class="animate-slide-fade w-full h-full flex flex-col items-center justify-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xl shadow-sm">⭐</div>
                  <div class="space-y-1">
                    <h4 class="text-sm font-extrabold uppercase tracking-wider text-yellow-600 dark:text-yellow-500">Give a Star</h4>
                    <p class="text-xs text-text-muted leading-relaxed font-semibold max-w-[200px]">Support our open-source codebase on GitHub!</p>
                  </div>
                  <a
                    href="https://github.com/simplearyan/canvas.labs"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 text-[10px] font-bold text-brand-500 hover:text-brand-600 hover:underline flex items-center gap-1 bg-brand-500/5 px-2.5 py-1 rounded-lg border border-brand-500/10"
                  >
                    🔗 GitHub Repository
                  </a>
                </div>
              </Show>

              {/* Slide 1 — Coffee */}
              <Show when={supportMessageIdx() === 1}>
                <div class="animate-slide-fade w-full h-full flex flex-col items-center justify-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-xl shadow-sm">☕</div>
                  <div class="space-y-1">
                    <h4 class="text-sm font-extrabold uppercase tracking-wider text-orange-500">Buy Me a Coffee</h4>
                    <p class="text-xs text-text-muted leading-relaxed font-semibold max-w-[200px]">We create free, beautiful design tools.</p>
                  </div>
                  <a
                    href="https://ko-fi.com/simplearyan"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-2 text-[10px] font-bold text-orange-500 hover:text-orange-400 hover:underline flex items-center gap-1 bg-orange-500/5 px-2.5 py-1 rounded-lg border border-orange-500/10"
                  >
                    ☕ Ko-fi Page
                  </a>
                </div>
              </Show>

              {/* Slide 2 — Promo */}
              <Show when={supportMessageIdx() === 2}>
                <div class="animate-slide-fade w-full h-full flex flex-col items-center justify-center gap-3">
                  <div class="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xl shadow-sm">📢</div>
                  <div class="space-y-1">
                    <h4 class="text-sm font-extrabold uppercase tracking-wider text-brand-500">Free Forever</h4>
                    <p class="text-xs text-text-muted leading-relaxed font-semibold max-w-[200px]">A short ad during export keeps Canvas Labs free for everyone.</p>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* B. DURING EXPORT: Perfectly Vertically & Horizontally Centered Google AdSense Card */}
          <Show when={exportActive()}>
            <div class="w-full md:w-[320px] flex flex-col justify-center items-center animate-slide-fade md:self-stretch shrink-0">

              {/* Ad Box - Square layout centered in space */}
              <div class="w-full flex flex-col bg-black/[0.02] dark:bg-white/[0.01] rounded-2xl border border-border-color overflow-hidden items-center justify-center shadow-sm max-w-[300px] h-[260px] md:h-[270px] shrink-0">
                <div class="w-full h-full flex items-center justify-center bg-black/[0.03] dark:bg-black/40 p-3" >
                  <ins
                    class="adsbygoogle"
                    style={{ display: 'block', width: '250px', height: '125px' }}
                    data-ad-client="ca-pub-7993314093599705"
                    data-ad-slot="9342323532"
                    data-ad-format="rectangle"
                    data-full-width-responsive="false"
                  ></ins>
                </div>
              </div>

            </div>
          </Show>

        </div>
      </div>
    </Show>
  );
}
