import { Engine } from "../core/Engine";

/**
 * Sumi-e Japanese Ink Flow canvas rendering pipeline.
 * Manages organic flowing stroke paths and brush textures.
 */
export class SumiCanvas extends Engine {
  private strokeColor: string = "#111827";
  private overlayText: string = "SUMI";

  public updateProperties(color: string, text: string): void {
    this.strokeColor = color;
    this.overlayText = text;
  }

  protected render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const offset = i * 40;
      ctx.moveTo(100, height / 2 - 80 + offset);
      
      const cp1x = width / 3;
      const cp1y = height / 2 - 180 + Math.sin(this.frame * 0.03 + i) * 60 + offset;
      const cp2x = (width * 2) / 3;
      const cp2y = height / 2 + 180 - Math.cos(this.frame * 0.04 + i) * 60 + offset;
      const destx = width - 100;
      const desty = height / 2 - 50 + offset;
      
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, destx, desty);
    }
    ctx.stroke();

    // Sumi Label Overlay
    ctx.fillStyle = "#111827";
    ctx.font = "bold 80px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(this.overlayText, width / 2, height / 2);
  }
}
