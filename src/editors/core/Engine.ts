/**
 * Canvas Labs - Core Animation Engine
 * Standardized base rendering class for 2D/WebGL animation editors.
 */
export abstract class Engine {
  protected ctx: CanvasRenderingContext2D;
  protected canvas: HTMLCanvasElement;
  protected animationFrameId: number = 0;
  protected frame: number = 0;
  protected isPlaying: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to obtain 2D Context from canvas");
    }
    this.ctx = context;
  }

  public start(): void {
    this.isPlaying = true;
    this.loop();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  public setPlayState(playing: boolean): void {
    if (playing) {
      this.start();
    } else {
      this.pause();
    }
  }

  private loop = (): void => {
    if (!this.isPlaying) return;
    
    this.frame++;
    this.render();
    
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Abstract render method to be implemented by sub-classes (e.g. ChartCanvas, SumiCanvas).
   */
  protected abstract render(): void;

  public destroy(): void {
    this.pause();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
