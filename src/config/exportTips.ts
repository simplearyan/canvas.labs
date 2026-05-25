export interface ExportTip {
  id: number;
  title: string;
  category: 'performance' | 'format' | 'design' | 'general';
  icon: string;
  content: string;
}

export const EXPORT_TIPS: ExportTip[] = [
  {
    id: 1,
    title: "WebM Supports Transparency",
    category: "format",
    icon: "sparkles",
    content: "Export in WebM format if you need alpha-channel transparency for overlays in OBS, Premiere Pro, or CapCut."
  },
  {
    id: 2,
    title: "Resolution vs. Speed",
    category: "performance",
    icon: "settings-2",
    content: "HD (1080p) is perfect for social grids. 4K renders are visually stunning but require significantly longer encoding times."
  },
  {
    id: 3,
    title: "60 FPS vs. 30 FPS",
    category: "performance",
    icon: "film",
    content: "Use 60 FPS for ultra-smooth fluid chart animations. Opt for 30 FPS for standard, fast drafts or static layouts."
  },
  {
    id: 4,
    title: "Mobile aspect ratios",
    category: "design",
    icon: "smartphone",
    content: "Select the 9:16 Portrait aspect ratio for TikTok, Reels, or YouTube Shorts, and 1:1 Square for Instagram grids."
  },
  {
    id: 5,
    title: "Maintain High Contrast",
    category: "design",
    icon: "info",
    content: "Ensure your canvas background color contrast is high enough against text labels to keep them readable on smaller displays."
  },
  {
    id: 6,
    title: "Optimize Space",
    category: "design",
    icon: "layout",
    content: "If your chart labels are too dense, use Visibility Toggles in the left sidebar to hide secondary gridlines or sources."
  },
  {
    id: 7,
    title: "Avoid Tab Inactivity",
    category: "performance",
    icon: "info",
    content: "Keep this browser tab open and focused while exporting. Background tabs may run slow because browsers restrict GPU cycles."
  }
];
