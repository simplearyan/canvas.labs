import { createSignal } from "solid-js";

// Types
export interface Preset {
  id: number;
  title: string;
  category: string;
  color: string;
  bgHex: string;
  accentHex: string;
  type: "waveform" | "sumi" | "orbit" | "grid";
}

export const templatesData: Preset[] = [
  { id: 101, title: "Waveform Pro: Spectrum", category: "charts", color: "bg-[#0a0a0c]", bgHex: "#0a0a0c", accentHex: "#06b6d4", type: "waveform" },
  { id: 102, title: "Sumi-e: Ink Flow", category: "backgrounds", color: "bg-[#fcfaf2]", bgHex: "#fcfaf2", accentHex: "#111827", type: "sumi" },
  { id: 103, title: "Neon Orbit: Pulse", category: "ui", color: "bg-[#050508]", bgHex: "#050508", accentHex: "#ff00ff", type: "orbit" },
  { id: 104, title: "Retro Grid Synthwave", category: "backgrounds", color: "bg-[#180828]", bgHex: "#180828", accentHex: "#38bdf8", type: "grid" }
];

// Global Navigation & View Signals
export const [currentCategory, setCurrentCategory] = createSignal("backgrounds");
export const [searchQuery, setSearchQuery] = createSignal("");
export const [activeTemplate, setActiveTemplate] = createSignal<Preset>(templatesData[0]);

// 3-State Responsive Layout Signals
export const [isDesktopPushMini, setIsDesktopPushMini] = createSignal(false);
export const [isDrawerOpen, setIsDrawerOpen] = createSignal(false);
export const [isSidebarFloating, setIsSidebarFloating] = createSignal(false);

// View Routing State Signals
export const [isViewingDetail, setIsViewingDetail] = createSignal(false);
export const [isViewingEditor, setIsViewingEditor] = createSignal(false);

// Header search bar expander for Mobile
export const [isMobileSearchActive, setIsMobileSearchActive] = createSignal(false);

// Light/Dark Theme Signal
const getInitialTheme = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    return document.documentElement.classList.contains("dark");
  }
  return true; // Fallback default
};
export const [isDarkTheme, setIsDarkTheme] = createSignal(getInitialTheme());

export const toggleTheme = () => {
  if (typeof window !== "undefined") {
    document.documentElement.classList.add("theme-transition");
    setIsDarkTheme(!isDarkTheme());
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 400);
  } else {
    setIsDarkTheme(!isDarkTheme());
  }
};

// Editor & Preset Quick Adjustments Variables
export const [canvasText, setCanvasText] = createSignal("MORPH");
export const [canvasBgColor, setCanvasBgColor] = createSignal("#0a0a0c");
export const [canvasAccentColor, setCanvasAccentColor] = createSignal("#06b6d4");
export const [isPlaybackPlaying, setIsPlaybackPlaying] = createSignal(true);

// Shared Global Actions
export const closeFloatingSidebar = () => {
  setIsSidebarFloating(false);
  setIsDrawerOpen(false);
};

export const isSecondaryPage = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path.includes('/terms') || path.includes('/privacy') || path.includes('/contact') || path.includes('/press');
};

export const handleHamburgerClick = () => {
  const width = window.innerWidth;
  const isFocusMode = isViewingDetail() || isViewingEditor();
  if (isFocusMode || isSecondaryPage() || width < 768) {
    setIsDrawerOpen(!isDrawerOpen());
  } else if (width < 1280) {
    setIsSidebarFloating(!isSidebarFloating());
  } else {
    setIsDesktopPushMini(!isDesktopPushMini());
  }
};

// Helper to synchronize active state signals to browser URL query parameters
export const syncUrl = (pushHistory = true) => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  params.set("category", currentCategory());

  if (isViewingDetail() || isViewingEditor()) {
    params.set("template", activeTemplate().id.toString());
    if (isViewingEditor()) {
      params.set("editor", "true");
    }
  }

  const newSearch = params.toString() ? `?${params.toString()}` : "";
  const newUrl = window.location.pathname + newSearch;

  // Only update if search query structurally changed
  if (window.location.search !== newSearch) {
    if (pushHistory) {
      window.history.pushState(null, "", newUrl);
    } else {
      window.history.replaceState(null, "", newUrl);
    }
  }
};

// Initializer to register client-side popstate navigation listeners and run initial URL parsing
export const initUrlRouter = () => {
  if (typeof window === "undefined") return;

  // 1. Reconcile initial URL query parameters immediately on client mount
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get("category");
  const tempParam = params.get("template");
  const editorParam = params.get("editor");

  if (catParam) {
    setCurrentCategory(catParam);
  }
  if (tempParam) {
    const id = parseInt(tempParam, 10);
    const match = templatesData.find(t => t.id === id);
    if (match) {
      setActiveTemplate(match);
      setCanvasText(match.title.split(":")[0].toUpperCase());
      setCanvasBgColor(match.bgHex);
      setCanvasAccentColor(match.accentHex);

      if (editorParam === "true") {
        setIsViewingEditor(true);
        setIsViewingDetail(false);
      } else {
        setIsViewingEditor(false);
        setIsViewingDetail(true);
      }
    }
  }

  // 1.5 Remove route-loading class to reveal the fully-reconciled layout with a premium fade
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.documentElement.classList.remove("route-loading");
    }, 50);
  });

  // 2. Set up event listener for active browser back/forward buttons
  window.addEventListener("popstate", () => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("category") || "backgrounds";
    const t = p.get("template");
    const e = p.get("editor");

    setCurrentCategory(c);
    setSearchQuery("");

    if (t) {
      const id = parseInt(t, 10);
      const match = templatesData.find(item => item.id === id);
      if (match) {
        setActiveTemplate(match);
        if (e === "true") {
          setIsViewingEditor(true);
          setIsViewingDetail(false);
        } else {
          setIsViewingEditor(false);
          setIsViewingDetail(true);
        }
        return;
      }
    }

    setIsViewingDetail(false);
    setIsViewingEditor(false);
  });
};

export const handleCategorySelect = (id: string) => {
  setCurrentCategory(id);
  setSearchQuery("");
  setIsViewingDetail(false);
  setIsViewingEditor(false);
  closeFloatingSidebar();
  syncUrl(true);
};

export const openQuickEditor = (preset: Preset) => {
  setActiveTemplate(preset);
  setCanvasText(preset.title.split(":")[0].toUpperCase());
  setCanvasBgColor(preset.bgHex);
  setCanvasAccentColor(preset.accentHex);
  
  setIsViewingDetail(true);
  setIsViewingEditor(false);
  closeFloatingSidebar();
  syncUrl(true);
};

export const closeQuickEditor = () => {
  setIsViewingDetail(false);
  setIsViewingEditor(false);
  syncUrl(true);
};

export const openFullEditor = () => {
  setIsViewingDetail(false);
  setIsViewingEditor(true);
  syncUrl(true);
};

export const exitFullEditor = () => {
  setIsViewingDetail(true);
  setIsViewingEditor(false);
  syncUrl(true);
};

export const handleSearchInput = (query: string) => {
  setSearchQuery(query);
  if (isViewingDetail() || isViewingEditor()) {
    setIsViewingDetail(false);
    setIsViewingEditor(false);
    syncUrl(false); // Use replaceState to keep history clean while typing
  }
};

export const filteredCards = () => {
  const query = searchQuery().trim().toLowerCase();
  if (query) {
    return templatesData.filter(t => t.title.toLowerCase().includes(query));
  }
  return templatesData.filter(t => t.category === currentCategory());
};
