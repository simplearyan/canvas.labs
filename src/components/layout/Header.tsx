import { Show, createEffect, onCleanup } from "solid-js";
import { SITE_CONFIG } from "../../config/site";
import Icon from "../ui/Icon";
import {
  isViewingEditor,
  isMobileSearchActive,
  setIsMobileSearchActive,
  isDarkTheme,
  toggleTheme,
  searchQuery,
  setSearchQuery,
  setIsViewingDetail,
  setIsViewingEditor,
  handleHamburgerClick
} from "../../store/global";

export default function Header() {
  createEffect(() => {
    const isDark = isDarkTheme();
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  });

  return (
    <Show when={!isViewingEditor()}>
      <header class="fixed top-0 right-0 left-0 h-16 bg-card-bg z-50 flex items-center justify-between px-4 border-border-color/10 border-b-0 xl:border-b xl:bg-header-glass-bg xl:backdrop-blur-md">

        <div class="flex items-center gap-3 md:gap-6">
          {/* Hamburger Toggle */}
          <button onClick={handleHamburgerClick} class="p-2 -ml-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none">
            <Icon name="menu" class="w-5 h-5" />
          </button>

          {/* Brand Monogram */}
          <a href="#" class="flex items-center gap-3 group">
            <div class="relative w-8 h-8 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-0.5">
              <span class="font-sans font-black text-white dark:text-gray-900 tracking-tighter" style="font-size: 15px;">{SITE_CONFIG.branding.acronym}</span>
              <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-500 rounded-full border-2 border-app-bg"></div>
            </div>
            <span class="text-base sm:text-xl font-bold tracking-tight text-text-main leading-none block">{SITE_CONFIG.branding.name}</span>
          </a>
        </div>

        {/* Search Bar */}
        <div class={`flex-1 max-w-2xl px-4 lg:px-12 transition-all duration-300 items-center gap-2 ${isMobileSearchActive() ? 'flex absolute inset-0 bg-app-bg px-4 z-50' : 'hidden sm:flex'}`}>
          <Show when={isMobileSearchActive()}>
            <button onClick={() => setIsMobileSearchActive(false)} class="sm:hidden p-2 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer">
              <Icon name="arrow-left" class="w-5 h-5" />
            </button>
          </Show>
          <div class="relative group flex-1">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted transition-colors group-focus-within:text-brand-500">
              <Icon name="search" class="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => {
                setSearchQuery(e.currentTarget.value);
                setIsViewingDetail(false);
                setIsViewingEditor(false);
              }}
              class="block w-full pl-11 pr-4 py-2 border border-border-color rounded-xl leading-5 bg-black/5 dark:bg-white/5 text-text-main placeholder-text-muted outline-none focus:bg-card-bg focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 sm:text-sm transition-all duration-300"
              placeholder="Search premium presets..."
            />
          </div>
        </div>

        {/* Right Controls */}
        <div class="flex items-center gap-2 sm:gap-4">
          {/* Mobile Search Button */}
          <button onClick={() => setIsMobileSearchActive(true)} class="sm:hidden p-2 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer">
            <Icon name="search" class="w-5 h-5" />
          </button>

          {/* Theme Switcher Button */}
          <button onClick={toggleTheme} class="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-5 h-5" />}>
              <Icon name="sun" class="w-5 h-5" />
            </Show>
          </button>
          <button class="hidden md:flex items-center gap-2 text-sm font-semibold text-text-main hover:text-brand-500 px-3.5 py-2 border border-border-color rounded-xl hover:border-brand-500 transition-all cursor-pointer">
            <Icon name="plus-circle" class="w-4 h-4" /> Create
          </button>
        </div>

      </header>
    </Show>
  );
}
