import { Engine } from "../core/Engine";

/**
 * ChartAnimator canvas rendering pipeline.
 * Manages rendering stacked bars, line markers, and timeline markers.
 */
export class ChartCanvas extends Engine {
  private accentColor: string = "#06b6d4";
  private chartTitle: string = "CHART";

  public updateProperties(accent: string, text: string): void {
    this.accentColor = accent;
    this.chartTitle = text;
  }

  protected render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 100; x < width - 100; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.lineTo(x, height - 100);
      ctx.stroke();
    }

    // pulsating columns
    ctx.fillStyle = this.accentColor;
    const columns = 8;
    const spacing = (width - 240) / columns;
    for (let i = 0; i < columns; i++) {
      const hFactor = Math.sin(this.frame * 0.05 + i * 0.3) * 0.4 + 0.6;
      const colHeight = hFactor * 320;
      const x = 120 + i * spacing;
      const y = height - 120 - colHeight;
      
      ctx.beginPath();
      ctx.roundRect(x + 10, y, spacing - 20, colHeight, 8);
      ctx.fill();
    }

    // Chart Label Overlay
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.chartTitle, width / 2, 80);
  }
}
