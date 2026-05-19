import type { ChartState } from './types';

export class ChartEngine {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private state: ChartState | null = null;
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  
  // High-performance properties
  private width: number;
  private height: number;
  private dpr: number;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    this.canvas = canvas;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error("Failed to get 2D context");
    this.ctx = context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    
    // Default resolution to 1080p
    this.width = 1920;
    this.height = 1080;
    this.dpr = 1;
    
    this.setupCanvas();
  }

  private setupCanvas() {
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    
    // Scale context to ensure crisp rendering if dpr > 1
    if (this.dpr > 1) {
       this.ctx.scale(this.dpr, this.dpr);
    }
  }

  public setDimensions(width: number, height: number, dpr: number = 1) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.setupCanvas();
    this.render();
  }

  public updateState(newState: ChartState) {
    this.state = newState;
    this.render(); // Immediate re-render for static preview
  }

  public play() {
    this.startTime = performance.now();
    this.loop(this.startTime);
  }

  public pause() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public seek(progress: number) {
    if (!this.state) return;
    this.renderFrame(progress);
  }

  private loop = (timestamp: number) => {
    if (!this.state) return;

    // Calculate progress (0.0 to 1.0)
    let elapsed = (timestamp - this.startTime) / 1000; // in seconds
    let progress = Math.min(elapsed / this.state.options.duration, 1.0);

    // Easing function (Cubic Out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    this.renderFrame(easedProgress);

    if (progress < 1.0) {
      this.animationFrameId = requestAnimationFrame(this.loop);
    } else {
      this.animationFrameId = null; // Animation complete
    }
  };

  public render() {
    this.seek(1.0); // Render fully complete state by default
  }

  public renderFrame(progress: number) {
    if (!this.state) return;
    
    const { ctx, width, height } = this;
    const { options } = this.state;

    // 1. Clear background
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Apply Zoom and Pan (Transformations)
    ctx.save();
    
    // Center origin for zooming, then translate back + apply user pan
    ctx.translate(width / 2 + options.panX, height / 2 + options.panY);
    ctx.scale(options.zoom, options.zoom);
    ctx.translate(-width / 2, -height / 2);

    // --- Core Render Logic Delegated Here based on ChartType ---
    // (We will extract these to separate renderers later to keep engine clean)
    this.drawTitleAndMetadata(ctx, this.state, width, height);
    
    // Example: placeholder for actual chart drawing
    this.drawChartPlaceholder(ctx, this.state, progress, width, height);

    ctx.restore();
  }

  private drawTitleAndMetadata(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, state: ChartState, w: number, h: number) {
    const opts = state.options;
    const margin = 100;
    let yPos = margin;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (opts.showTitle && state.title) {
      ctx.font = `900 ${opts.titleSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.titleColor;
      ctx.fillText(state.title, margin, yPos);
      yPos += opts.titleSize + 15;
    }

    if (opts.showSubtitle && state.subtitle) {
      ctx.font = `500 ${opts.subtitleSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.textColor;
      ctx.fillText(state.subtitle, margin, yPos);
    }

    if (opts.showSource && state.source) {
      ctx.font = `600 ${opts.sourceSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.textColor;
      // Bottom right
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.source, w - margin, h - margin);
    }
  }

  private drawChartPlaceholder(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, state: ChartState, progress: number, w: number, h: number) {
     const margin = 100;
     const chartW = w - (margin * 2);
     const chartH = h - 300; // Leave room for title at top

     // Background plate for chart area
     ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
     ctx.fillRect(margin, 250, chartW, chartH);

     // Animated fill bar
     ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
     const currentWidth = chartW * progress;
     ctx.fillRect(margin, 250, currentWidth, chartH);
     
     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillStyle = '#ffffff';
     ctx.font = `bold 64px "${state.options.fontFamily}"`;
     ctx.fillText(`${state.type.toUpperCase()} CHART (${(progress*100).toFixed(0)}%)`, margin + (currentWidth/2), 250 + (chartH/2));
  }
}
