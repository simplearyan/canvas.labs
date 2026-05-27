import { createSignal, createEffect, onCleanup, For, Show, onMount } from "solid-js";
import { SITE_CONFIG } from "../config/site";
import Icon from "./ui/Icon";
import PresetCard from "./common/PresetCard";
import Header from "./layout/Header";
import Sidebar from "./layout/Sidebar";
import {
  currentCategory,
  searchQuery,
  activeTemplate,
  isDesktopPushMini,
  isViewingDetail,
  setIsViewingDetail,
  isViewingEditor,
  isDarkTheme,
  toggleTheme,
  canvasText,
  setCanvasText,
  canvasBgColor,
  setCanvasBgColor,
  canvasAccentColor,
  setCanvasAccentColor,
  isPlaybackPlaying,
  setIsPlaybackPlaying,
  openFullEditor,
  exitFullEditor,
  filteredCards,
  closeQuickEditor,
  initUrlRouter,
  templatesData,
  handleCategorySelect,
  isSidebarFloating,
  setIsDesktopPushMini,
  setIsSidebarFloating,
  isHydrated,
  setIsHydrated
} from "../store/global";

export default function Portal() {
  // Canvas Reference
  let canvasRef: HTMLCanvasElement | undefined;
  let canvasAnimId: number;

  // --- INITIALIZE DYNAMIC ROUTER popstate LISTENER ---
  createEffect(() => {
    initUrlRouter();
  });

  // --- SYNCHRONIZE SIDEBAR STATES TO LOCALSTORAGE ---
  createEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("isDesktopPushMini", isDesktopPushMini() ? "true" : "false");
    }
  });

  createEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("isSidebarFloating", isSidebarFloating() ? "true" : "false");
    }
  });

  // --- CLIENT-SIDE STATE RESTORATION POST-HYDRATION ---
  onMount(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const savedDesktop = localStorage.getItem("isDesktopPushMini");
      if (savedDesktop) {
        setIsDesktopPushMini(savedDesktop === "true");
      }
      const savedFloating = localStorage.getItem("isSidebarFloating");
      if (savedFloating) {
        setIsSidebarFloating(savedFloating === "true");
      }
    }
    
    // Set hydrated to true after a tiny frame delay to bypass initial render animations
    setTimeout(() => {
      setIsHydrated(true);
    }, 50);
  });

  // --- ADAPTIVE TAB-THEME FAVICON ENGINE ---
  createEffect(() => {
    let faviconAngle = 0;
    let faviconOffset = 0;
    let faviconDir = 1;
    
    // Find or create favicon element
    let faviconEl = document.getElementById("favicon") as HTMLLinkElement;
    if (!faviconEl) {
      faviconEl = document.createElement("link");
      faviconEl.id = "favicon";
      faviconEl.rel = "icon";
      faviconEl.type = "image/svg+xml";
      document.head.appendChild(faviconEl);
    }

    const interval = setInterval(() => {
      // Dynamic sensor for Chrome/Firefox prefers-color-scheme
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const configFavicon = SITE_CONFIG.tabPreferences.favicon;
      
      if (configFavicon && configFavicon.useSvgIcon) {
        // Render static brand SVG files depending on dark/light theme prefers
        const svgUrl = isSystemDark ? configFavicon.darkTabSvg : configFavicon.lightTabSvg;
        faviconEl.href = svgUrl;
      } else if (configFavicon && (configFavicon.darkTabEmoji || configFavicon.lightTabEmoji)) {
        // Render interactive animated Emojis
        let svg = "";
        if (isSystemDark) {
          faviconAngle = (faviconAngle + 6) % 360;
          svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='80' transform='rotate(${faviconAngle} 50 55)'>${configFavicon.darkTabEmoji}</text></svg>`;
        } else {
          faviconOffset += 1.5 * faviconDir;
          if (faviconOffset > 18 || faviconOffset < 0) faviconDir *= -1;
          svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' x='${faviconOffset}' font-size='80'>${configFavicon.lightTabEmoji}</text></svg>`;
        }
        faviconEl.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      } else {
        // Fallback default
        faviconEl.href = configFavicon.default;
      }
    }, 100);

    onCleanup(() => clearInterval(interval));
  });

  // --- DOCUMENT TITLE SCROLL MARQUEE ---
  createEffect(() => {
    const baseTitle = SITE_CONFIG.tabPreferences.marqueeTitle;
    let index = 0;
    
    const interval = setInterval(() => {
      document.title = baseTitle.substring(index) + baseTitle.substring(0, index);
      index = (index + 1) % baseTitle.length;
    }, SITE_CONFIG.tabPreferences.marqueeSpeedMs);

    onCleanup(() => clearInterval(interval));
  });


  // --- REAL-TIME CANVAS RENDERING LOOP ---
  createEffect(() => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    let particles: Array<{x: number, y: number, r: number, vx: number, vy: number}> = [];
    for(let i=0; i<30; i++) {
      particles.push({
        x: Math.random() * canvasRef.width,
        y: Math.random() * canvasRef.height,
        r: Math.random() * 4 + 2,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5
      });
    }

    let frame = 0;
    const render = () => {
      if (!ctx || !canvasRef) return;
      
      const width = canvasRef.width;
      const height = canvasRef.height;
      const accentColor = canvasAccentColor();
      const bgColor = canvasBgColor();
      const textVal = canvasText();
      const activeType = activeTemplate().type;

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      if (isPlaybackPlaying()) {
        frame++;
      }

      // Draw Canvas Preset Templates
      if (activeType === "waveform") {
        // Particle background inside canvas
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        particles.forEach(p => {
          if (isPlaybackPlaying()) {
            p.x += p.vx;
            p.y += p.vy;
            if(p.x < 0 || p.x > width) p.vx *= -1;
            if(p.y < 0 || p.y > height) p.vy *= -1;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Pulsating audio bars
        ctx.fillStyle = accentColor;
        const count = 32;
        const barWidth = (width - 120) / count;
        for (let i = 0; i < count; i++) {
          const factor = Math.sin(frame * 0.06 + i * 0.15) * 0.5 + 0.5;
          const noise = Math.cos(frame * 0.15 - i * 0.3) * 0.2 + 0.2;
          const barHeight = (factor * 120 + noise * 60) * 1.2 + 10;
          const x = 60 + i * barWidth;
          const y = height / 2 - barHeight / 2;
          ctx.beginPath();
          ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 6);
          ctx.fill();
        }
      } 
      else if (activeType === "sumi") {
        // Flowing elegant strokes
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        for(let i = 0; i < 3; i++) {
          const offset = i * 40;
          ctx.moveTo(100, height/2 - 80 + offset);
          
          const cp1x = width / 3;
          const cp1y = height/2 - 180 + Math.sin(frame * 0.03 + i) * 60 + offset;
          const cp2x = (width * 2) / 3;
          const cp2y = height/2 + 180 - Math.cos(frame * 0.04 + i) * 60 + offset;
          const destx = width - 100;
          const desty = height/2 - 50 + offset;
          
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, destx, desty);
        }
        ctx.stroke();
      } 
      else if (activeType === "orbit") {
        // Orbit ring
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 100 + Math.sin(frame * 0.04) * 15;
        
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 8;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 15;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Reset shadow
        ctx.shadowBlur = 0;

        // Orbiting planet dot
        const angle = frame * 0.05;
        const px = centerX + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * radius;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();
      } 
      else if (activeType === "grid") {
        // Retro grid
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        
        // Draw vertical lines
        const lines = 12;
        const gridOffset = (frame * 2) % 40;
        for (let i = 0; i <= lines; i++) {
          const ratio = i / lines;
          const xTop = width/2 + (ratio - 0.5) * (width * 0.2);
          const xBottom = width/2 + (ratio - 0.5) * (width * 1.5);
          ctx.beginPath();
          ctx.moveTo(xTop, height * 0.3);
          ctx.lineTo(xBottom, height);
          ctx.stroke();
        }

        // Draw horizontal lines with perspective depth
        for (let y = height * 0.3; y < height; y += 30) {
          const mappedY = y + (gridOffset * (y - height*0.3) / height);
          ctx.beginPath();
          ctx.moveTo(0, mappedY);
          ctx.lineTo(width, mappedY);
          ctx.stroke();
        }
      }

      // Draw primary text overlay (dynamic styling)
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 96px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(textVal, width / 2, height / 2);
      ctx.shadowBlur = 0; // Reset

      canvasAnimId = requestAnimationFrame(render);
    };

    render();
    
    onCleanup(() => cancelAnimationFrame(canvasAnimId));
  });

  const isFocusMode = () => isViewingDetail() || isViewingEditor();

  return (
    <div class="min-h-screen relative transition-colors duration-300 antialiased font-sans">
      
      {/* 1. HEADER (Modular) */}
      <Header />

      {/* 2. SIDEBARS & MAIN LAYOUT WRAPPER */}
      <div class={`flex min-h-screen relative bg-app-bg ${isViewingEditor() ? 'pt-0' : 'pt-16'}`}>
        
        {/* Sidebar layouts (Modular) */}
        <Sidebar />

        {/* 3. MAIN CONTENT CONTAINER */}
        <main 
          class={`flex-1 min-h-screen relative flex flex-col ${isHydrated() ? 'layout-transition' : ''} ${
            isFocusMode() 
              ? 'ml-0' 
              : isDesktopPushMini() 
                ? 'ml-0 md:ml-[72px] xl:ml-[72px]' 
                : 'ml-0 md:ml-[72px] xl:ml-64'
          }`}
        >
          
          {/* VIEW A: GALLERY VIEW */}
          <Show when={!isFocusMode()}>
            <div class="flex-1 max-w-[1500px] w-full mx-auto px-8 md:px-16 xl:px-24 py-12 md:py-20 space-y-16 xl:space-y-24 animate-fade-in">
              
              {/* Category Header */}
              <div class="space-y-3 max-w-3xl">
                <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-text-main capitalize">
                  {currentCategory() === "all" ? "Explore premium templates" : `Premium animated ${currentCategory()} templates`}
                </h1>
                <p class="text-base text-text-muted leading-relaxed">
                  Elevate your canvas and projects with our free, high-performance visual effects templates.
                </p>
              </div>

              {/* Grouped view switcher */}
              <Show when={currentCategory() === "all" && searchQuery().trim() === ""} fallback={
                /* Flat Grid of Preset Cards for specific categories or search queries */
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 xl:gap-12">
                  <For each={filteredCards()}>
                    {(preset) => (
                      <PresetCard preset={preset} />
                    )}
                  </For>
                </div>
              }>
                {/* Grouped view by category, showing up to 4 from each */}
                <div class="space-y-20 xl:space-y-24">
                  <For each={["backgrounds", "charts", "ui", "text"]}>
                    {(catId) => {
                      const catName = catId === "ui" ? "UI elements" : catId;
                      // Get up to 4 cards from this category
                      const catCards = () => templatesData.filter(t => t.category === catId).slice(0, 4);
                      
                      return (
                        <Show when={catCards().length > 0}>
                          <div class="space-y-6">
                            <div class="flex items-center justify-between">
                              <h2 class="text-2xl md:text-3xl font-black tracking-tight text-text-main capitalize">
                                {catName}
                              </h2>
                              <button 
                                onClick={() => handleCategorySelect(catId)}
                                class="text-xs font-extrabold text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                              >
                                View all <Icon name="chevron-right" class="w-4 h-4" />
                              </button>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 xl:gap-12">
                              <For each={catCards()}>
                                {(preset) => (
                                  <PresetCard preset={preset} />
                                )}
                              </For>
                            </div>
                          </div>
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Empty state */}
              <Show when={filteredCards().length === 0}>
                <div class="flex flex-col items-center justify-center py-20 text-center">
                  <div class="w-16 h-16 bg-black/5 dark:bg-white/5 rounded-full flex items-center justify-center text-text-muted mb-4">
                    <Icon name="search-x" class="w-8 h-8" />
                  </div>
                  <h3 class="text-lg font-bold text-text-main">No presets matching search</h3>
                  <p class="text-sm text-text-muted mt-1">Try searching for other template categories.</p>
                </div>
              </Show>

            </div>
          </Show>

          {/* VIEW B: QUICK PRESET EDITOR VIEW */}
          <Show when={isViewingDetail()}>
            <div class="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 space-y-6 animate-fade-in flex flex-col">
              
              {/* Breadcrumb Back Button */}
              <button 
                onClick={closeQuickEditor}
                class="flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-main transition-colors w-fit group cursor-pointer"
              >
                <Icon name="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to {currentCategory()}
              </button>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* Left panel: Preview Canvas Frame */}
                <div class="lg:col-span-2 flex flex-col gap-4">
                  <div 
                    class="w-full aspect-video rounded-2xl border border-border-color shadow-sm flex items-center justify-center overflow-hidden relative"
                    style={{ "background-color": canvasBgColor() }}
                  >
                    <canvas 
                      ref={canvasRef} 
                      width="1280" 
                      height="720"
                      class="w-full h-full object-contain"
                    ></canvas>
                  </div>

                  {/* Mock Playback Controls */}
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

                {/* Right panel: Adjustments Controls */}
                <div class="flex flex-col gap-6 bg-card-bg border border-border-color p-6 rounded-2xl shadow-sm">
                  
                  <div>
                    <span class="text-[10px] font-extrabold uppercase tracking-widest text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                      {activeTemplate().category}
                    </span>
                    <h2 class="text-2xl font-extrabold text-text-main mt-3 tracking-tight">
                      {activeTemplate().title}
                    </h2>
                    <p class="text-xs text-text-muted leading-relaxed mt-1.5">
                      Adjust basic canvas settings. Live updates will compile on the fly.
                    </p>
                  </div>

                  <button 
                    onClick={openFullEditor}
                    class="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100 font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                  >
                    <Icon name="layout-template" class="w-5 h-5" /> Open in Full Editor
                  </button>

                  <div class="border-t border-border-color/50 pt-5 space-y-4">
                    <h3 class="font-bold text-xs text-text-main uppercase tracking-widest flex items-center gap-2">
                      <Icon name="sliders" class="w-4 h-4 text-brand-500" /> Quick Adjustments
                    </h3>

                    {/* Editor Form Controls */}
                    <div class="space-y-3.5">
                      <div>
                        <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Primary Text</label>
                        <input 
                          type="text" 
                          value={canvasText()}
                          onInput={(e) => setCanvasText(e.currentTarget.value.toUpperCase())}
                          class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-xl px-3.5 py-2 text-sm font-semibold text-text-main focus:bg-card-bg focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>
                      
                      <div class="grid grid-cols-2 gap-3.5">
                        <div>
                          <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Accent Color</label>
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
                          <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Background</label>
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

                </div>

              </div>

            </div>
          </Show>

          {/* VIEW C: FULL TIMELINE EDITOR WORKSPACE */}
          <Show when={isViewingEditor()}>
            <div class="flex-1 flex flex-col bg-app-bg h-screen overflow-hidden animate-fade-in relative">
              
              {/* Editor Header */}
              <div class="h-16 bg-header-bg border-b border-border-color flex items-center justify-between px-4 shrink-0 z-40 transition-colors">
                <div class="flex items-center gap-3">
                  <button 
                    onClick={exitFullEditor}
                    class="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-text-muted hover:text-text-main transition-colors cursor-pointer group"
                  >
                    <Icon name="arrow-left" class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                  </button>
                  <div class="h-6 w-px bg-border-color"></div>
                  <span class="font-bold text-[15px] text-text-main">{activeTemplate().title}</span>
                  <span class="px-2 py-0.5 bg-brand-500/10 text-brand-500 border border-brand-500/20 text-[9px] font-extrabold uppercase tracking-widest rounded-md">Draft Studio</span>
                </div>
                
                <div class="flex items-center gap-2.5">
                  <button class="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-text-muted transition-colors cursor-pointer hidden sm:block"><Icon name="undo" class="w-4 h-4" /></button>
                  <button class="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-text-muted transition-colors cursor-pointer hidden sm:block"><Icon name="redo" class="w-4 h-4" /></button>
                  <div class="h-6 w-px bg-border-color hidden sm:block"></div>
                  
                  <button class="bg-brand-500 hover:bg-brand-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-colors flex items-center gap-2.5 cursor-pointer">
                    <Icon name="download" class="w-4 h-4" /> Export
                  </button>
                  
                  <button onClick={toggleTheme} class="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                    <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-5 h-5" />}>
                      <Icon name="sun" class="w-5 h-5" />
                    </Show>
                  </button>
                </div>
              </div>

              {/* Editor Workspace Panels */}
              <div class="flex flex-1 overflow-hidden relative">
                
                {/* 1. Left Vertical Action Panel */}
                <div class="w-16 border-r border-border-color bg-card-bg flex flex-col items-center py-4 gap-2 shrink-0 z-10 transition-colors">
                  <button class="p-2.5 bg-brand-500/10 text-brand-500 rounded-xl transition-colors cursor-pointer"><Icon name="mouse-pointer-click" class="w-5 h-5" /></button>
                  <button class="p-2.5 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main rounded-xl transition-colors cursor-pointer"><Icon name="type" class="w-5 h-5" /></button>
                  <button class="p-2.5 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main rounded-xl transition-colors cursor-pointer"><Icon name="image" class="w-5 h-5" /></button>
                  <button class="p-2.5 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main rounded-xl transition-colors cursor-pointer"><Icon name="settings-2" class="w-5 h-5" /></button>
                </div>

                {/* 2. Middle Canvas Viewport */}
                <div class="flex-1 bg-checker overflow-auto relative flex custom-scrollbar z-0" id="editorWrapper">
                  <div class="m-auto p-8 flex items-center justify-center min-w-full min-h-full">
                    
                    {/* Centered Editor Canvas */}
                    <div 
                      class="shadow-2xl border border-border-color relative overflow-hidden flex items-center justify-center rounded-lg" 
                      style={{ 
                        width: "800px", 
                        height: "450px", 
                        "background-color": canvasBgColor(),
                        transform: "scale(0.9)"
                      }}
                    >
                      <canvas 
                        ref={(el) => { if(el) canvasRef = el; }} 
                        width="1280" 
                        height="720"
                        class="w-full h-full object-contain"
                      ></canvas>
                    </div>

                  </div>
                </div>

                {/* 3. Right Advanced Panel */}
                <div class="w-72 border-l border-border-color bg-card-bg flex flex-col shrink-0 overflow-y-auto custom-scrollbar z-10 hidden md:flex transition-colors">
                  
                  {/* Canvas properties */}
                  <div class="p-5 border-b border-border-color/70 space-y-4">
                    <h3 class="text-[10px] font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Icon name="settings-2" class="w-4 h-4 text-brand-500" /> Canvas Settings
                    </h3>
                    <div class="space-y-4">
                      <div>
                        <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Dimensions (px)</label>
                        <div class="flex items-center gap-2.5">
                          <input type="text" value="1920" class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-lg px-2.5 py-1.5 text-xs font-semibold text-center text-text-main" readonly />
                          <span class="text-text-muted text-xs">×</span>
                          <input type="text" value="1080" class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-lg px-2.5 py-1.5 text-xs font-semibold text-center text-text-main" readonly />
                        </div>
                      </div>
                      
                      <div>
                        <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Background</label>
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

                  {/* Layer customizer */}
                  <div class="p-5 space-y-4">
                    <h3 class="text-[10px] font-extrabold text-text-muted uppercase tracking-widest flex items-center gap-2">
                      <Icon name="type" class="w-4 h-4 text-brand-500" /> Active Layer Properties
                    </h3>
                    <div class="space-y-4">
                      <div>
                        <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Text Value</label>
                        <input 
                          type="text" 
                          value={canvasText()}
                          onInput={(e) => setCanvasText(e.currentTarget.value.toUpperCase())}
                          class="w-full bg-black/5 dark:bg-white/5 border border-border-color rounded-xl px-3.5 py-2 text-sm font-semibold text-text-main focus:bg-card-bg focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label class="block text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1.5">Accent Color</label>
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
                    </div>
                  </div>

                </div>

              </div>

              {/* 4. Bottom Horizontal Timeline Panel */}
              <div class="h-48 border-t border-border-color bg-card-bg shrink-0 flex flex-col z-20 hidden sm:flex transition-colors">
                
                {/* Timeline Controls */}
                <div class="h-10 border-b border-border-color bg-black/5 dark:bg-white/5 flex items-center justify-between px-4 shrink-0">
                  <div class="flex items-center gap-2">
                    <button class="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted cursor-pointer"><Icon name="skip-back" class="w-3.5 h-3.5" /></button>
                    <button 
                      onClick={() => setIsPlaybackPlaying(!isPlaybackPlaying())}
                      class="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-main cursor-pointer"
                    >
                      <Show when={isPlaybackPlaying()} fallback={<Icon name="play" class="w-3.5 h-3.5 fill-current" />}>
                        <Icon name="pause" class="w-3.5 h-3.5" />
                      </Show>
                    </button>
                    <div class="h-4 w-px bg-border-color mx-1"></div>
                    <span class="text-[10px] font-mono font-bold text-text-main bg-card-bg px-2 py-0.5 rounded border border-border-color">00:00:01 / 00:00:03</span>
                  </div>
                  
                  <div class="flex items-center gap-1.5 text-[10px] font-extrabold text-text-muted uppercase tracking-widest">
                    <Icon name="zoom-in" class="w-3.5 h-3.5" /> Timeline Zoom
                  </div>
                </div>

                {/* Timeline Tracks container */}
                <div class="flex-1 flex overflow-hidden">
                  
                  {/* Left Label Stack */}
                  <div class="w-48 border-r border-border-color flex flex-col bg-black/5 dark:bg-white/5 shrink-0 overflow-y-auto custom-scrollbar">
                    <div class="h-8 border-b border-border-color shrink-0"></div> {/* ruler offset spacer */}
                    <div class="h-10 border-b border-border-color/30 flex items-center px-4 gap-2 bg-card-bg">
                      <Icon name="type" class="w-3.5 h-3.5 text-brand-500" />
                      <span class="text-xs font-bold text-text-main truncate">Text Label Layer</span>
                    </div>
                    <div class="h-10 border-b border-border-color/30 flex items-center px-4 gap-2 bg-card-bg">
                      <Icon name="image" class="w-3.5 h-3.5 text-cyan-500" />
                      <span class="text-xs font-bold text-text-main truncate">Background Fill</span>
                    </div>
                  </div>

                  {/* Right Track Grid Clips */}
                  <div class="flex-1 overflow-auto custom-scrollbar relative bg-card-bg">
                    
                    {/* Playhead Red bar */}
                    <div class="absolute top-0 bottom-0 left-[35%] w-px bg-red-500 z-30 pointer-events-none"></div>
                    <div class="absolute top-0 left-[35%] w-3 h-3 bg-red-500 rounded-b-sm -translate-x-[5px] z-30 cursor-ew-resize"></div>

                    {/* Timeline Ruler */}
                    <div class="h-8 border-b border-border-color relative shrink-0 flex items-end pb-1" style={{ width: "1200px" }}>
                      <div class="absolute left-4 text-[9px] font-mono text-text-muted font-bold">0s</div>
                      <div class="absolute left-[300px] text-[9px] font-mono text-text-muted font-bold">1s</div>
                      <div class="absolute left-[600px] text-[9px] font-mono text-text-muted font-bold">2s</div>
                      <div class="absolute left-[900px] text-[9px] font-mono text-text-muted font-bold">3s</div>
                    </div>

                    {/* Tracks Clips stack */}
                    <div class="relative" style={{ width: "1200px" }}>
                      {/* Track 1 clip */}
                      <div class="h-10 border-b border-border-color/30 flex items-center relative px-4">
                        <div 
                          class="absolute h-6 left-12 right-24 bg-brand-500/10 rounded-lg border border-brand-500/30 flex items-center px-3 cursor-pointer hover:bg-brand-500/15 transition-all"
                        >
                          <span class="text-[10px] font-extrabold text-brand-500 truncate">Text Anim Loop</span>
                        </div>
                      </div>
                      
                      {/* Track 2 clip */}
                      <div class="h-10 border-b border-border-color/30 flex items-center relative px-4">
                        <div 
                          class="absolute h-6 left-0 right-24 bg-cyan-500/10 rounded-lg border border-cyan-500/30 flex items-center px-3 cursor-pointer hover:bg-cyan-500/15 transition-all"
                        >
                          <span class="text-[10px] font-extrabold text-cyan-500 truncate">Background Particle Generator</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </div>
          </Show>

        </main>
      </div>

    </div>
  );
}
