export const SITE_CONFIG = {
  branding: {
    name: "CanvasLabs",
    acronym: "CL",
    creator: "Canvas Labs Team",
    defaultAccent: "#8b5cf6", // brand violet/purple
    defaultBg: "#050505",     // pitch black base
    themePalette: "capcut-v2",  // Choose site color scheme: "default", "capcut-v2", "kinetic", "blueprint"
  },
  seo: {
    title: "CanvasLabs — Premium Animated Background Templates",
    description: "Elevate your web and video projects with free, high-performance, responsive canvas animations and timeline editors.",
    url: "https://simplearyan.github.io/canvas.labs",
    keywords: ["canvas", "animation", "motion graphics", "presets", "timeline editor", "Astro", "SolidJS"],
    ogImage: "https://simplearyan.github.io/canvas.labs/og-image.png",
    twitterHandle: "@canvaslabs",
  },
  tabPreferences: {
    marqueeTitle: "Canvas Labs — Premium Animated Background Templates    ",
    marqueeSpeedMs: 250,
    favicon: {
      default: "/favicon/favicon-gradient-trans.svg",
      // Set 'useSvgIcon' to true to display SVG files inside browser tab mockups, or false to use the Emojis below
      useSvgIcon: false,
      useLightDark: true, // Toggle between dynamic light/dark mode assets or the default static asset
      darkTabEmoji: "⭐",
      lightTabEmoji: "👉",
      darkTabSvg: "/favicon/favicon-white-trans.svg",
      lightTabSvg: "/favicon/favicon-dark-trans.svg",
    }
  }
};
