import { Show, createEffect, createSignal, onMount } from "solid-js";
import { SITE_CONFIG } from "../../config/site";
import Icon from "../ui/Icon";
import Logo from "./Logo";
import {
  isViewingEditor,
  isMobileSearchActive,
  setIsMobileSearchActive,
  isDarkTheme,
  toggleTheme,
  searchQuery,
  handleHamburgerClick,
  handleSearchInput
} from "../../store/global";

export default function Header(props: { isTemplate?: boolean }) {
  const [isTemplatePage, setIsTemplatePage] = createSignal(props.isTemplate || false);
  const [templateTitle, setTemplateTitle] = createSignal("Template");

  onMount(() => {
    if (typeof window !== "undefined") {
      const isPage = window.location.pathname.includes("/templates/");
      setIsTemplatePage(isPage);
      if (isPage) {
        const match = window.location.pathname.match(/\/templates\/(?:charts|typography)\/([^/]+)/);
        if (match && match[1]) {
          const slug = match[1];
          setTemplateTitle(slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) + " Template");
        }
      }
    }
  });

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

        <div class={`flex items-center gap-2 md:gap-3 ${isTemplatePage() ? 'min-w-0 flex-1 mr-4' : ''}`}>
          {/* Hamburger Toggle */}
          <button onClick={handleHamburgerClick} class="p-2 -ml-2 rounded-lg text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none flex-shrink-0">
            <Icon name="menu" class="w-5 h-5" />
          </button>

          {/* Brand Monogram / Template Title */}
          <Show when={isTemplatePage()} fallback={<Logo />}>
            <div class="flex items-center gap-1.5 border-l border-border-color/20 pl-2.5 sm:pl-4 ml-1 min-w-0 flex-1">
              <span class="text-xs sm:text-sm md:text-base font-extrabold tracking-tight text-text-main truncate capitalize select-none">
                {templateTitle()}
              </span>
            </div>
          </Show>
        </div>

        {/* Search Bar */}
        <Show when={!isTemplatePage()}>
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
                  handleSearchInput(e.currentTarget.value);
                }}
                class="block w-full pl-11 pr-4 py-2 border border-border-color rounded-xl leading-5 bg-black/5 dark:bg-white/5 text-text-main placeholder-text-muted outline-none focus:bg-card-bg focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 sm:text-sm transition-all duration-300"
                placeholder="Search premium presets..."
              />
            </div>
          </div>
        </Show>

        {/* Right Controls */}
        <div class="flex items-center gap-2 sm:gap-4">
          {/* Mobile Search Button */}
          <Show when={!isTemplatePage()}>
            <button onClick={() => setIsMobileSearchActive(true)} class="sm:hidden p-2 text-text-muted hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer">
              <Icon name="search" class="w-5 h-5" />
            </button>
          </Show>

          {/* Theme Switcher Button */}
          <button onClick={toggleTheme} class="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
            <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-5 h-5" />}>
              <Icon name="sun" class="w-5 h-5" />
            </Show>
          </button>
          
          <Show when={!isTemplatePage()}>
            <button class="hidden md:flex items-center gap-2 text-sm font-semibold text-text-main hover:text-brand-500 px-3.5 py-2 border border-border-color rounded-xl hover:border-brand-500 transition-all cursor-pointer">
              <Icon name="plus-circle" class="w-4 h-4" /> Create
            </button>
          </Show>

          {/* Dynamic Template Header Controls Mount */}
          <Show when={isTemplatePage()}>
            <div id="template-header-controls" class="flex items-center gap-1.5 sm:gap-2"></div>
          </Show>
        </div>
      </header>
    </Show>
  );
}
