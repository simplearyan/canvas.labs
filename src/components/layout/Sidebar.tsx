import { Show, For, createSignal, onCleanup } from "solid-js";
import { SITE_CONFIG } from "../../config/site";
import Icon from "../ui/Icon";

const base = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL;
import {
  currentCategory,
  handleCategorySelect,
  isSidebarFloating,
  setIsSidebarFloating,
  isDesktopPushMini,
  isDrawerOpen,
  setIsDrawerOpen,
  isViewingDetail,
  isViewingEditor
} from "../../store/global";

const navItems = [
  { id: "backgrounds", label: "Backgrounds", icon: "image" },
  { id: "charts", label: "Charts", icon: "bar-chart-2" },
  { id: "ui", label: "UI elements", icon: "layout" },
  { id: "text", label: "Text", icon: "type" },
  { id: "social", label: "Social media", icon: "message-circle" },
  { id: "video", label: "Video titles", icon: "play-square" },
  { id: "ads", label: "Ads", icon: "megaphone" },
  { id: "websites", label: "Websites", icon: "globe" },
  // Extra premium mock categories to test scrolling behaviour
  { id: "youtube", label: "YouTube Graphics", icon: "film" },
  { id: "twitch", label: "Twitch Overlays", icon: "sparkles" },
  { id: "audio", label: "Audio Spectrums", icon: "megaphone" },
  { id: "lower-thirds", label: "Lower Thirds", icon: "type" },
  { id: "intros", label: "Intro templates", icon: "film" },
  { id: "typography", label: "Typography Layouts", icon: "type" },
  { id: "infographics", label: "Infographics", icon: "bar-chart-2" },
  { id: "presentations", label: "Presentations", icon: "layout" },
  { id: "mockups", label: "Device Mockups", icon: "smartphone" },
  { id: "shapes", label: "Vector Shapes", icon: "box" },
  { id: "paintings", label: "Brush Paintings", icon: "sparkles" },
  { id: "portfolios", label: "Portfolios", icon: "globe" }
];

export default function Sidebar(props: { hideDesktop?: boolean }) {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isLargeDesktop, setIsLargeDesktop] = createSignal(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1280px)").matches : true
  );

  if (typeof window !== "undefined") {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsLargeDesktop(e.matches);
    };
    mediaQuery.addEventListener("change", handleMediaChange);
    onCleanup(() => mediaQuery.removeEventListener("change", handleMediaChange));
  }

  const isFocusMode = () => isViewingDetail() || isViewingEditor();
  
  const isExpanded = () => {
    if (isLargeDesktop()) {
      return !isDesktopPushMini() || isHovered();
    } else {
      // Disabled hover expansion on iPad/tablet: only expand via the hamburger menu
      return isSidebarFloating();
    }
  };

  return (
    <>
      {/* 2A. PUSH SIDEBAR (Desktop/Tablet) */}
      <Show when={!props.hideDesktop && !isFocusMode()}>
        <aside 
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          class={`fixed top-16 left-0 bottom-0 hidden md:flex flex-col bg-sidebar-bg overflow-hidden transition-all duration-300 ${
            isLargeDesktop()
              ? isExpanded()
                ? 'w-64 z-35' // Desktop expanded: flat layout (no dropshadow), standard z-index
                : 'w-[72px] z-35' // Desktop collapsed: flat layout (no dropshadow)
              : isExpanded()
                ? 'w-64 shadow-2xl z-45 translate-x-0' // iPad/Tablet overlay: elevated floating state with drop shadow
                : 'w-[72px] z-35' // iPad/Tablet mini: standard narrow state
          }`}
        >
          <div class={`flex-1 custom-scrollbar p-3 space-y-1 ${
            isLargeDesktop() 
              ? 'overflow-y-hidden hover:overflow-y-auto' 
              : 'overflow-y-auto'
          }`}>
            <For each={navItems}>
              {(item) => {
                const isActive = () => currentCategory() === item.id;
                return (
                  <button 
                    onClick={() => handleCategorySelect(item.id)}
                    class={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive() 
                        ? 'bg-brand-500/10 text-brand-500 font-semibold ring-1 ring-brand-500/20' 
                        : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main'
                    } ${!isExpanded() ? 'justify-center px-1 py-3' : ''}`}
                  >
                    <Icon 
                      name={item.icon} 
                      class={`w-5 h-5 flex-shrink-0 transition-colors ${
                        isActive() ? 'text-brand-500' : 'text-text-muted'
                      }`} 
                    />
                    <span class={`font-medium transition-all ${
                      !isExpanded() ? 'hidden' : 'text-sm'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                );
              }}
            </For>

            {/* Sidebar Footer (Non-sticky: scroll to find) */}
            <Show when={isExpanded()}>
              <div class="pt-6 pb-2 px-2 border-t border-border-color/30 space-y-2 text-xs text-text-muted mt-6">
                <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 font-semibold">
                  <a href={`${base}/terms`} class="hover:text-text-main transition-colors">Terms</a>
                  <a href={`${base}/contact`} class="hover:text-text-main transition-colors">Contact</a>
                  <a href={`${base}/privacy`} class="hover:text-text-main transition-colors">Privacy</a>
                  <a href={`${base}/press`} class="hover:text-text-main transition-colors">Press</a>
                </div>
                <p class="text-[10px]">© 2026 {SITE_CONFIG.branding.name}. All rights reserved.</p>
              </div>
            </Show>
          </div>
        </aside>
      </Show>

      {/* 2B. MOBILE DRAWER SIDEBAR */}
      <Show when={isDrawerOpen()}>
        <aside 
          class={`fixed inset-y-0 left-0 w-72 bg-sidebar-bg z-60 flex flex-col shadow-2xl ${props.hideDesktop ? '' : 'md:hidden'}`}
        >
          <div class="h-16 flex items-center px-6 gap-3 border-b border-border-color">
            <div class="w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center">
              <span class="font-sans font-black text-white dark:text-gray-900 tracking-tighter leading-none flex items-center justify-center" style="font-size: 14px; margin-top: 1px;">{SITE_CONFIG.branding.acronym}</span>
            </div>
            <span class="text-base sm:text-xl font-bold tracking-tight text-text-main leading-none flex items-center h-8">{SITE_CONFIG.branding.name}</span>
          </div>

          <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
            <For each={navItems}>
              {(item) => {
                const isActive = () => currentCategory() === item.id;
                return (
                  <button 
                    onClick={() => handleCategorySelect(item.id)}
                    class={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                      isActive() 
                        ? 'bg-brand-500/10 text-brand-500 font-semibold ring-1 ring-brand-500/20' 
                        : 'text-text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-main'
                    }`}
                  >
                    <Icon name={item.icon} class="w-5 h-5 flex-shrink-0" />
                    <span class="text-sm font-medium">{item.label}</span>
                  </button>
                );
              }}
            </For>

            {/* Mobile Sidebar Footer (Non-sticky: scroll to find) */}
            <div class="pt-6 pb-2 px-2 border-t border-border-color/30 space-y-2 text-xs text-text-muted mt-6">
              <div class="flex flex-wrap gap-x-3.5 gap-y-1.5 font-semibold">
                <a href={`${base}/terms`} class="hover:text-text-main transition-colors">Terms</a>
                <a href={`${base}/contact`} class="hover:text-text-main transition-colors">Contact</a>
                <a href={`${base}/privacy`} class="hover:text-text-main transition-colors">Privacy</a>
                <a href={`${base}/press`} class="hover:text-text-main transition-colors">Press</a>
              </div>
              <p class="text-[10px]">© 2026 {SITE_CONFIG.branding.name}. All rights reserved.</p>
            </div>
          </div>
        </aside>
      </Show>

      {/* 2C. MOBILE BACKDROP OVERLAY */}
      <Show when={isDrawerOpen()}>
        <div 
          onClick={() => setIsDrawerOpen(false)}
          class={`fixed inset-0 bg-black/40 z-55 transition-opacity duration-300 animate-pure-fade-in cursor-pointer ${props.hideDesktop ? '' : 'md:hidden'}`}
        />
      </Show>

      {/* 2D. IPAD/TABLET BACKDROP OVERLAY */}
      <Show when={isSidebarFloating()}>
        <div 
          onClick={() => setIsSidebarFloating(false)}
          class="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 animate-pure-fade-in cursor-pointer hidden md:block"
        />
      </Show>
    </>
  );
}
