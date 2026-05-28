import type { BoundingBox, InteractionHandle } from './types';

export class BoundingBoxRenderer {
  
  public static getHandlePositions(bounds: BoundingBox, displayScale: number = 1): InteractionHandle[] {
    const { x, y, w, h, rotation } = bounds;
    const rad = rotation * Math.PI / 180;
    const rotOffset = 30 * displayScale;

    const localPositions = [
      { name: 'tl' as const, lx: -w/2, ly: -h/2 },
      { name: 'tc' as const, lx: 0,    ly: -h/2 },
      { name: 'tr' as const, lx: w/2,  ly: -h/2 },
      { name: 'ml' as const, lx: -w/2, ly: 0 },
      { name: 'mr' as const, lx: w/2,  ly: 0 },
      { name: 'bl' as const, lx: -w/2, ly: h/2 },
      { name: 'bc' as const, lx: 0,    ly: h/2 },
      { name: 'br' as const, lx: w/2,  ly: h/2 },
      { name: 'rot' as const,lx: 0,    ly: -h/2 - rotOffset }
    ];

    return localPositions.map(pos => {
      const hx = x + pos.lx * Math.cos(rad) - pos.ly * Math.sin(rad);
      const hy = y + pos.lx * Math.sin(rad) + pos.ly * Math.cos(rad);
      return { name: pos.name, x: hx, y: hy };
    });
  }

  public static drawSelectionBox(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, bounds: BoundingBox, displayScale: number = 1) {
    const { x, y, w, h, rotation } = bounds;

    ctx.save();
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation * Math.PI / 180);

    const strokeW = 1.5 * displayScale;
    const lineDash = [6 * displayScale, 4 * displayScale];
    const rotOffset = 30 * displayScale;
    const handleSize = 8 * displayScale;

    // Draw main bounding box
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = strokeW;
    ctx.setLineDash(lineDash);
    ctx.strokeRect(-w/2, -h/2, w, h);
    
    // Draw line to rotation handle
    const rotY = -h/2 - rotOffset;
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(0, rotY);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1 * displayScale;
    ctx.stroke();

    // Draw rotation handle
    ctx.beginPath();
    ctx.arc(0, rotY, 5 * displayScale, 0, Math.PI*2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * displayScale;
    ctx.stroke();

    // Draw scale handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#3b82f6';
    
    const positions = [
        [-w/2, -h/2], [0, -h/2], [w/2, -h/2],
        [-w/2, 0],               [w/2, 0],
        [-w/2, h/2],  [0, h/2],  [w/2, h/2]
    ];
    
    positions.forEach(([hx, hy]) => {
        ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
    });

    ctx.restore();
  }
}
