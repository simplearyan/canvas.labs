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
  return path.includes('/terms') || path.includes('/privacy') || path.includes('/contact');
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

export const handleCategorySelect = (id: string) => {
  setCurrentCategory(id);
  setSearchQuery("");
  setIsViewingDetail(false);
  setIsViewingEditor(false);
  closeFloatingSidebar();
};

export const openQuickEditor = (preset: Preset) => {
  setActiveTemplate(preset);
  setCanvasText(preset.title.split(":")[0].toUpperCase());
  setCanvasBgColor(preset.bgHex);
  setCanvasAccentColor(preset.accentHex);
  
  setIsViewingDetail(true);
  setIsViewingEditor(false);
  closeFloatingSidebar();
};

export const openFullEditor = () => {
  setIsViewingDetail(false);
  setIsViewingEditor(true);
};

export const exitFullEditor = () => {
  setIsViewingDetail(true);
  setIsViewingEditor(false);
};

export const filteredCards = () => {
  const query = searchQuery().trim().toLowerCase();
  if (query) {
    return templatesData.filter(t => t.title.toLowerCase().includes(query));
  }
  return templatesData.filter(t => t.category === currentCategory());
};
