import type { InteractionHandle, TransformUpdate } from './types';

export interface InteractionConfig {
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: TransformUpdate) => void;
  onDoubleTap?: (id: string) => void;
  hitTest: (x: number, y: number) => string | null;
  getHandles: (id: string) => InteractionHandle[] | null;
  getElementInfo: (id: string) => { x: number, y: number, rotation: number, width?: number, height?: number, size?: number, type?: string } | null;
}

export class InteractionController {
  private isDragging = false;
  private isRotating = false;
  private activeHandle: string | null = null;
  
  private dragOffset = { x: 0, y: 0 };
  private initialSize = 100;
  private initialW = 100;
  private initialH = 100;
  private initialDistance = 0;
  
  private lastTapTime = 0;
  private lastTapId: string | null = null;
  
  private config: InteractionConfig;
  private activeElementId: string | null = null;

  constructor(config: InteractionConfig) {
    this.config = config;
  }

  public setActiveElement(id: string | null) {
    this.activeElementId = id;
  }

  public handlePointerDown(x: number, y: number, isTouch: boolean = false): boolean {
    // 1. If there is a selected element, first hit test its handles
    if (this.activeElementId) {
      const handles = this.config.getHandles(this.activeElementId);
      if (handles) {
        const tolerance = isTouch ? 24 : 12;
        const hitHandle = handles.find(h => Math.hypot(x - h.x, y - h.y) <= tolerance);
        
        if (hitHandle) {
          const elInfo = this.config.getElementInfo(this.activeElementId);
          if (elInfo) {
            this.activeHandle = hitHandle.name;
            if (this.activeHandle === 'rot') {
              this.isRotating = true;
            } else {
              this.initialDistance = Math.hypot(x - elInfo.x, y - elInfo.y);
              this.initialSize = elInfo.size || 100;
              this.initialW = elInfo.width || 100;
              this.initialH = elInfo.height || 100;
            }
            return true; // Handled as handle interaction
          }
        }
      }
    }

    // 2. Standard element selection / dragging hit test
    const hitId = this.config.hitTest(x, y);
    
    if (hitId) {
      this.config.onSelect(hitId);
      this.activeElementId = hitId;
      
      const elInfo = this.config.getElementInfo(hitId);
      if (elInfo) {
        // Double tap detection
        const currentTime = performance.now();
        const tapDelay = currentTime - this.lastTapTime;
        if (hitId === this.lastTapId && tapDelay < 300) {
          if (this.config.onDoubleTap) {
            this.config.onDoubleTap(hitId);
          }
        }
        this.lastTapTime = currentTime;
        this.lastTapId = hitId;

        // Start dragging
        this.isDragging = true;
        this.dragOffset = { x: elInfo.x - x, y: elInfo.y - y };
        return true;
      }
    } else {
      this.config.onSelect(null);
      this.activeElementId = null;
      this.lastTapId = null;
    }
    
    return false;
  }

  public handlePointerMove(x: number, y: number) {
    if (!this.activeElementId) return;
    
    const elInfo = this.config.getElementInfo(this.activeElementId);
    if (!elInfo) return;

    if (this.isRotating) {
      const angleRad = Math.atan2(y - elInfo.y, x - elInfo.x);
      let angleDeg = angleRad * 180 / Math.PI;
      angleDeg = Math.round(angleDeg + 90);
      this.config.onUpdate(this.activeElementId, { rotation: angleDeg });
    } 
    else if (this.activeHandle) {
      const currentDistance = Math.hypot(x - elInfo.y, y - elInfo.y); // wait, Math.hypot(x - elInfo.x, y - elInfo.y)
      // Fix calculation
      const dist = Math.hypot(x - elInfo.x, y - elInfo.y);
      const scaleRatio = dist / (this.initialDistance || 1);

      if (elInfo.type === 'text' || elInfo.type === 'circle') {
        const newSize = Math.max(10, Math.round(this.initialSize * scaleRatio));
        this.config.onUpdate(this.activeElementId, { size: newSize });
      } else {
        // Rectangles or other shapes that can scale non-uniformly
        // For simplicity and alignment with typography engine, we can scale uniformly, or use handle logic
        const isCorner = ['tl', 'tr', 'bl', 'br'].includes(this.activeHandle);
        const isWidth = ['ml', 'mr'].includes(this.activeHandle);
        const isHeight = ['tc', 'bc'].includes(this.activeHandle);

        const rad = (elInfo.rotation || 0) * Math.PI / 180;
        const dx = x - elInfo.x;
        const dy = y - elInfo.y;

        if (isCorner) {
          const newW = Math.max(10, Math.round(this.initialW * scaleRatio));
          const newH = Math.max(10, Math.round(this.initialH * scaleRatio));
          this.config.onUpdate(this.activeElementId, { w: newW, h: newH, size: newW }); 
          // Note: for Kinetic, 'rect' size is just 'size'. So we update 'size' for proportional scale.
          this.config.onUpdate(this.activeElementId, { size: newW });
        } else if (isWidth) {
          const localX = dx * Math.cos(rad) + dy * Math.sin(rad);
          const newW = Math.max(10, Math.round(Math.abs(localX) * 2 - 20));
          this.config.onUpdate(this.activeElementId, { size: newW }); // Using size for now 
        } else if (isHeight) {
          const localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
          const newH = Math.max(10, Math.round(Math.abs(localY) * 2 - 20));
          this.config.onUpdate(this.activeElementId, { size: newH }); // Using size for now
        }
      }
    } 
    else if (this.isDragging) {
      this.config.onUpdate(this.activeElementId, {
        x: x + this.dragOffset.x,
        y: y + this.dragOffset.y
      });
    }
  }

  public handlePointerUp() {
    this.isDragging = false;
    this.isRotating = false;
    this.activeHandle = null;
  }
}
