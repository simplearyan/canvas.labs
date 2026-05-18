# 🎨 Canvas Labs Portal

A premium, high-performance, and indexable Web Portal for animated canvas background templates and timeline-based editor suites. Built on top of **Astro**, **SolidJS** (for reactive state hydration), and **Tailwind CSS v4** (via high-performance Vite compile pipelines).

---

## ✨ Features & Visual Masterpiece Design

- 🖼️ **Premium Flat Gallery**: Seamlessly filterable visual cards covering backgrounds, charts, UI elements, text loops, ads, and interactive websites.
- 📐 **3-State Responsive Sidebar**:
  1. *Push Sidebar* (Desktop width >= 1280px) - clean layout push.
  2. *Floating Expander* (Tablet width >= 768px) - smart floating action.
  3. *Slide-out Overlay Drawer* (Mobile width < 768px) - fluid navigation drawer.
- ⏱️ **Full Timeline Editor Workspace**: Multi-track clips layering, real-time interactive canvas render buffers, playback speed curves, zoom ruler guides, and direct WebM export workflows.
- 🌓 **Zero-Flicker Theme System**: Fast, block-level `<script is:inline>` in Astro `<head>` queries local storage and matches system parameters, setting the dark/light modes *before first paint* to eliminate layout shifts or flashes.
- 🌟 **Adaptive Dynamic Favicon**: Chrome/Firefox preferences-color-scheme sensor that animates a rotating star `⭐` for dark tabs and a sliding pointer hand `👉` for light tabs.
- 📜 **Continuous Marquee Title**: Animated continuous scroll title in the browser tab keeping engagement high.

---

## 🗂️ Project Scalable Directory Tree

To support modular growth, shared UI blocks, separate editor engines, and preset customizers, the project follows a strict architectural design system:

```
src/
├── store/                     # Fine-grained state management stores
│   └── global.ts              # Theme, navigation, category, search, and quick adjustment signals
│
├── components/                # Shared layout & atomic UI blocks
│   ├── ui/                    # Reusable atom-level primitives
│   │   └── Icon.tsx           # Framework-independent SVG vector icon lookup
│   ├── layout/                # Global layout boundaries
│   │   ├── Header.tsx         # Responsive top navigation & theme settings
│   │   └── Sidebar.tsx        # Dynamic 3-state navigation (push, float, drawer)
│   └── common/                # Shared composite components
│       └── PresetCard.tsx     # Standardized flat gallery card listings
│
├── editors/                   # Core Editor Applications & Canvas loops
│   ├── core/                  # Shared base pipelines
│   │   └── Engine.ts          # Abstract Base Class for high-performance canvas loops
│   ├── chart/                 # Chart Animator Application
│   │   └── ChartCanvas.ts     # Canvas chart bars rendering inheriting Engine
│   └── sumi-e/                # Japanese Sumi-e Brush Application
│       └── SumiCanvas.ts      # bezier brush strokes rendering inheriting Engine
│
├── presets/                   # Preset Quick Customizer Panels
│   ├── core/                  # Reusable preview panels
│   │   └── QuickPreview.tsx   # Canvas wrapper with mockup controls
│   ├── chart/                 # Quick adjust controls for Charts
│   │   └── ChartQuickControls.tsx
│   └── sumi-e/                # Quick adjust controls for Sumi-e brush loops
│       └── SumiQuickControls.tsx
│
├── styles/                    # Stylesheets & CSS Tokens
│   └── global.css             # Tailwind v4 theme specifications and custom animations
│
└── pages/                     # SSG Astro page routes
    └── index.astro            # Primary index landing page
```

---

## 🛠️ Code Architectural Principles

### 1. Canvas Animation Engine Inheritance
To implement a new canvas animator application, extend the high-performance abstract `Engine` base class located in [Engine.ts](src/editors/core/Engine.ts):

```typescript
import { Engine } from "../core/Engine";

export class MyCustomCanvas extends Engine {
  protected render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // 1. Draw your high-performance animations here
    // 2. Use this.frame to track time cycles
  }
}
```

### 2. Fine-grained Reactive Stores
All shared application actions and UI states belong inside the global store [global.ts](src/store/global.ts). Avoid mixing local business states inside render-blocking UI templates.

---

## 🚀 How to Run Locally

### Prerequisites
Make sure you have Node.js (v18.0.0 or higher) installed.

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Local Development Server
Starts the high-speed dev server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open `http://localhost:4321/` in your browser.

### 3. Build Production Bundle
Generates pre-rendered, fully static, and SEO-optimized HTML/JS bundles inside `dist/`:
```bash
npm run build
```

---

## ⚡ Technical Stack

- **Framework**: [Astro](https://astro.build/) (Static Site Generation / pre-rendering hub)
- **State & Rendering**: [SolidJS](https://www.solidjs.com/) (Fine-grained reactive signals and client-side hydration)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Next-generation lightning-fast Vite compilation pipeline)
