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
    const bounds = this.drawTitleAndMetadata(ctx, this.state, width, height);
    
    if (this.state.rawData) {
      this.drawChart(ctx, bounds.chartStartY, bounds.chartBottomY, progress);
    }

    ctx.restore();
  }

  private palettes = {
    vibrant: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#eab308'],
    pastel: ['#fca5a5', '#93c5fd', '#6ee7b7', '#fcd34d', '#d8b4fe', '#f9a8d4', '#67e8f9', '#fde047'],
    neon: ['#ff00ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000', '#0000ff'],
    sunset: ['#f43f5e', '#f97316', '#eab308', '#8b5cf6', '#d946ef'],
    ocean: ['#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#0284c7']
  };

  private parseCSV(csvString: string) {
    const lines = csvString.split('\n').map(l => l.trim()).filter(Boolean);
    const data: Array<{ label: string, values: number[], color: string | null }> = [];
    let seriesNames: string[] = [];
    let maxVal = 0;
    let minVal = 0;
    let maxStackedVal = 0;
    
    let startIdx = 0;
    if (lines.length > 0) {
      const headerRow = lines[0].split(',').map(c => c.trim());
      if (headerRow.length >= 2 && isNaN(parseFloat(headerRow[1]))) {
        startIdx = 1;
        seriesNames = headerRow.slice(1);
        if (seriesNames.length > 0 && seriesNames[seriesNames.length - 1].toLowerCase() === 'color') {
          seriesNames.pop();
        }
      } else {
        seriesNames = ['Value']; 
      }
    }

    for (let i = startIdx; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim());
      if (row.length < 2) continue;
      
      const label = row[0];
      let color: string | null = null;
      const values: number[] = [];
      
      for(let j = 1; j < row.length; j++) {
        if (row[j].startsWith('#')) {
          color = row[j];
        } else {
          values.push(parseFloat(row[j]) || 0);
        }
      }
      
      data.push({ label, values, color }); 
      
      let sum = 0;
      values.forEach(v => {
        if (v > maxVal) maxVal = v;
        if (v < minVal) minVal = v;
        sum += v;
      });
      if (sum > maxStackedVal) maxStackedVal = sum;
    }

    // Rounding max bounds dynamically for editorial spacing
    if (maxVal > 0) {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(0.1, maxVal))));
      let norm = maxVal / magnitude;
      if (norm <= 1.5) norm = 1.5;
      else if (norm <= 2) norm = 2;
      else if (norm <= 5) norm = 5;
      else norm = 10;
      maxVal = norm * magnitude;
    }

    if (maxStackedVal > 0) {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(0.1, maxStackedVal))));
      let norm = maxStackedVal / magnitude;
      if (norm <= 1.5) norm = 1.5;
      else if (norm <= 2) norm = 2;
      else if (norm <= 5) norm = 5;
      else norm = 10;
      maxStackedVal = norm * magnitude;
    }

    if (minVal < 0) {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(minVal))));
      minVal = Math.floor(minVal / magnitude) * magnitude;
    }

    return { data, seriesNames, maxVal, minVal, maxStackedVal };
  }

  private formatValue(val: number, format: 'number' | 'currency' | 'percent', maxVal: number, minVal: number) {
    const rounded = Math.abs(maxVal - minVal) < 5 ? val.toFixed(2) : Math.round(val).toString();
    if (format === 'currency') return '$' + Number(rounded).toLocaleString();
    if (format === 'percent') return Number(rounded).toLocaleString() + '%';
    return Number(rounded).toLocaleString();
  }

  private drawTitleAndMetadata(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, state: ChartState, w: number, h: number) {
    const opts = state.options;
    let yPos = 70; // Top padding

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let hasTopText = false;
    if (opts.showTitle && state.title) {
      ctx.font = `800 ${opts.titleSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.titleColor;
      ctx.fillText(state.title, 80, yPos);
      yPos += opts.titleSize + 16;
      hasTopText = true;
    }

    if (opts.showSubtitle && state.subtitle) {
      ctx.font = `400 ${opts.subtitleSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.textColor;
      ctx.fillText(state.subtitle, 80, yPos);
      yPos += opts.subtitleSize + 16;
      hasTopText = true;
    }

    let bottomY = h - 40; // Bottom padding
    if (opts.showSource && state.source) {
      ctx.font = `600 ${opts.sourceSize}px "${opts.fontFamily}"`;
      ctx.fillStyle = opts.textColor;
      ctx.textBaseline = 'bottom';
      ctx.fillText(state.source, 80, bottomY);
      bottomY -= (opts.sourceSize + 20);
    }

    if (opts.showLegend && state.rawData) {
      const { data, seriesNames } = this.parseCSV(state.rawData);
      if (data.length > 0) {
        this.drawLegend(ctx, w, bottomY - 20, opts.textColor, opts.colorPalette, opts.fontFamily, data, seriesNames);
        bottomY -= 80;
      }
    }

    return { chartStartY: hasTopText ? yPos + 40 : 70, chartBottomY: bottomY };
  }

  private drawLegend(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    W: number,
    legendCenterY: number,
    textColor: string,
    colorPalette: string,
    fontBase: string,
    data: any[],
    seriesNames: string[]
  ) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 24px "${fontBase}"`;
    
    let totalWidth = 0;
    const itemPadding = 40;
    const boxSize = 20;
    const palette = (this.palettes as any)[colorPalette] || this.palettes.vibrant;

    const isMultiSeries = (this.state?.type === 'multiline' || this.state?.type === 'stacked') && seriesNames.length > 0;
    
    if (isMultiSeries) {
      seriesNames.forEach((name) => {
        totalWidth += boxSize + 10 + ctx.measureText(name).width + itemPadding;
      });
    } else {
      data.forEach(item => {
        totalWidth += boxSize + 10 + ctx.measureText(item.label).width + itemPadding;
      });
    }
    totalWidth -= itemPadding; 

    let currentX = (W - totalWidth) / 2;

    if (isMultiSeries) {
      seriesNames.forEach((name, idx) => {
        const color = palette[idx % palette.length];
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(currentX, legendCenterY - boxSize/2, boxSize, boxSize, 4);
        } else {
          ctx.fillRect(currentX, legendCenterY - boxSize/2, boxSize, boxSize);
        }
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.fillText(name, currentX + boxSize + 10, legendCenterY + 2);
        currentX += boxSize + 10 + ctx.measureText(name).width + itemPadding;
      });
    } else {
      data.forEach((item, idx) => {
        const color = item.color || palette[idx % palette.length];
        ctx.fillStyle = color;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(currentX, legendCenterY - boxSize/2, boxSize, boxSize, 4);
        } else {
          ctx.fillRect(currentX, legendCenterY - boxSize/2, boxSize, boxSize);
        }
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.fillText(item.label, currentX + boxSize + 10, legendCenterY + 2);
        currentX += boxSize + 10 + ctx.measureText(item.label).width + itemPadding;
      });
    }
  }

  private drawChart(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, startY: number, bottomY: number, progress: number) {
    if (!this.state) return;
    const { rawData, options, type } = this.state;
    const parsed = this.parseCSV(rawData);
    if (parsed.data.length === 0) return;

    const chartArea = {
      x: 120,
      y: startY,
      w: this.width - 240,
      h: Math.max(100, bottomY - startY)
    };

    const isDarkBg = options.bgColor.replace('#', '').length === 6 && parseInt(options.bgColor.replace('#', ''), 16) < 0x888888;
    const gridColor = isDarkBg ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const palette = (this.palettes as any)[options.colorPalette] || this.palettes.vibrant;

    if (type === 'vertical') {
      this.drawVerticalChart(ctx, chartArea, progress, options.textColor, gridColor, palette, options.fontFamily, parsed);
    } else if (type === 'horizontal') {
      this.drawHorizontalChart(ctx, chartArea, progress, options.textColor, gridColor, palette, options.fontFamily, parsed);
    } else if (type === 'pie') {
      this.drawPieChart(ctx, chartArea, progress, options.textColor, palette, options.fontFamily, parsed);
    } else if (type === 'multiline') {
      this.drawMultiLineChart(ctx, chartArea, progress, options.textColor, gridColor, palette, options.fontFamily, parsed);
    } else if (type === 'stacked') {
      this.drawStackedChart(ctx, chartArea, progress, options.textColor, gridColor, palette, options.fontFamily, parsed);
    }
  }

  private drawVerticalChart(ctx: any, area: any, progress: number, textColor: string, gridColor: string, palette: string[], fontBase: string, parsed: any) {
    const steps = 4;
    const valueRange = parsed.maxVal - parsed.minVal;
    const leftPad = this.state!.options.showYAxis ? 100 : 20;
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 20px "${fontBase}"`;
    ctx.fillStyle = textColor;

    for (let i = 0; i <= steps; i++) {
      const val = parsed.minVal + (valueRange / steps) * i;
      const y = area.y + area.h - ((val - parsed.minVal) / valueRange) * area.h;

      if (this.state!.options.showGrid) {
        ctx.beginPath();
        ctx.setLineDash([8, 8]);
        ctx.moveTo(area.x + leftPad - 20, y);
        ctx.lineTo(area.x + area.w, y);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      if (this.state!.options.showYAxis) {
        ctx.fillText(this.formatValue(val, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), area.x + leftPad - 40, y);
      }
    }

    const zeroY = parsed.minVal < 0 ? area.y + area.h - ((0 - parsed.minVal) / valueRange) * area.h : area.y + area.h;
    
    if (this.state!.options.showXAxis || this.state!.options.showYAxis) {
      ctx.beginPath();
      ctx.moveTo(area.x + leftPad - 20, zeroY);
      ctx.lineTo(area.x + area.w, zeroY);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const numBars = parsed.data.length;
    const slotWidth = (area.w - leftPad) / numBars;
    const barWidth = slotWidth * 0.8;
    
    ctx.textAlign = 'center';

    parsed.data.forEach((item: any, index: number) => {
      const x = area.x + leftPad + (index * slotWidth) + (slotWidth - barWidth)/2;
      const actualValue = item.values[0] || 0;
      const targetPixelHeight = (actualValue / valueRange) * area.h;
      const currentPixelHeight = targetPixelHeight * progress;
      const y = zeroY - currentPixelHeight;
      const color = item.color || palette[index % palette.length];

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, currentPixelHeight);

      ctx.textBaseline = 'top';
      ctx.font = `700 24px "${fontBase}"`;
      ctx.fillStyle = textColor;
      ctx.globalAlpha = Math.min(1, progress * 2); 
      const lblY = parsed.minVal < 0 ? area.y + area.h + 15 : zeroY + 15;
      
      if (this.state!.options.showXAxis) {
        ctx.fillText(item.label, x + barWidth/2, lblY);
      }

      if (this.state!.options.showValues && progress > 0.1) {
        ctx.textBaseline = actualValue >= 0 ? 'bottom' : 'top';
        ctx.font = `800 28px "JetBrains Mono"`;
        const valYOffset = actualValue >= 0 ? -10 : 10;
        ctx.fillText(this.formatValue(actualValue * progress, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), x + barWidth/2, y + valYOffset);
      }
      ctx.globalAlpha = 1.0;
    });
  }

  private drawHorizontalChart(ctx: any, area: any, progress: number, textColor: string, gridColor: string, palette: string[], fontBase: string, parsed: any) {
    const labelSpace = this.state!.options.showYAxis ? 250 : 20;
    const rightPad = 40;
    const actualAreaW = area.w - labelSpace - rightPad;
    const valueRange = parsed.maxVal - parsed.minVal;

    const steps = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 20px "${fontBase}"`;
    ctx.fillStyle = textColor;

    for (let i = 0; i <= steps; i++) {
      const val = parsed.minVal + (valueRange / steps) * i;
      const x = area.x + labelSpace + ((val - parsed.minVal) / valueRange) * actualAreaW;

      if (this.state!.options.showGrid) {
        ctx.beginPath();
        ctx.setLineDash([8, 8]);
        ctx.moveTo(x, area.y);
        ctx.lineTo(x, area.y + area.h - (this.state!.options.showXAxis ? 40 : 0));
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (this.state!.options.showXAxis) {
        ctx.fillText(this.formatValue(val, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), x, area.y + area.h - 25);
      }
    }

    const zeroX = parsed.minVal < 0 ? area.x + labelSpace + ((0 - parsed.minVal) / valueRange) * actualAreaW : area.x + labelSpace;
    
    if (this.state!.options.showXAxis || this.state!.options.showYAxis) {
      ctx.beginPath();
      ctx.moveTo(zeroX, area.y);
      ctx.lineTo(zeroX, area.y + area.h - (this.state!.options.showXAxis ? 40 : 0));
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const numBars = parsed.data.length;
    const totalH = area.h - (this.state!.options.showXAxis ? 40 : 0);
    const slotHeight = totalH / numBars;
    const barHeight = slotHeight * 0.75;
    
    ctx.textBaseline = 'middle';

    parsed.data.forEach((item: any, index: number) => {
      const actualValue = item.values[0] || 0;
      const targetPixelWidth = (actualValue / valueRange) * actualAreaW;
      const currentPixelWidth = targetPixelWidth * progress;
      const y = area.y + (index * slotHeight) + (slotHeight - barHeight)/2;
      const color = item.color || palette[index % palette.length];

      ctx.globalAlpha = Math.min(1, progress * 2);
      if (this.state!.options.showYAxis) {
        ctx.textAlign = 'right';
        ctx.font = `800 24px "${fontBase}"`;
        ctx.fillStyle = textColor;
        ctx.fillText(item.label, area.x + labelSpace - 20, y + barHeight/2);
      }

      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;
      ctx.fillRect(zeroX, y, currentPixelWidth, barHeight);

      if (this.state!.options.showValues && progress > 0.1) {
        ctx.textAlign = actualValue >= 0 ? 'left' : 'right';
        ctx.font = `800 28px "JetBrains Mono"`;
        ctx.fillStyle = textColor;
        
        const valXOffset = actualValue >= 0 ? 15 : -15;
        ctx.fillText(this.formatValue(actualValue * progress, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), zeroX + currentPixelWidth + valXOffset, y + barHeight/2);
      }
    });
  }

  private drawPieChart(ctx: any, area: any, progress: number, textColor: string, palette: string[], fontBase: string, parsed: any) {
    const total = parsed.data.reduce((sum: number, item: any) => sum + (item.values[0] || 0), 0);
    if (total === 0) return;
    
    const centerX = area.x + area.w / 2; 
    const centerY = area.y + area.h / 2;
    const radius = Math.min(area.w, area.h) * 0.45;

    const targetTotalRadian = Math.PI * 2 * progress;
    let currentRadian = -Math.PI / 2; 

    parsed.data.forEach((item: any, index: number) => {
      const actualValue = item.values[0] || 0;
      const sliceAngle = (actualValue / total) * targetTotalRadian;
      const color = item.color || palette[index % palette.length];
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentRadian, currentRadian + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = color;
      ctx.fill();
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.state!.options.bgColor;
      ctx.stroke();

      currentRadian += sliceAngle;
    });
  }

  private drawMultiLineChart(ctx: any, area: any, progress: number, textColor: string, gridColor: string, palette: string[], fontBase: string, parsed: any) {
    const numPoints = parsed.data.length;
    if (numPoints < 2) return;
    const numSeries = parsed.seriesNames.length;
    
    const valueRange = parsed.maxVal - parsed.minVal;
    const leftPad = this.state!.options.showYAxis ? 100 : 40;
    const rightPad = 40;
    const xStep = (area.w - leftPad - rightPad) / (numPoints - 1);
    const currentXProg = area.x + leftPad + progress * (area.w - leftPad - rightPad);
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 20px "${fontBase}"`;
    ctx.fillStyle = textColor;

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = parsed.minVal + (valueRange / steps) * i;
      const y = area.y + area.h - ((val - parsed.minVal) / valueRange) * area.h;

      if (this.state!.options.showGrid) {
        ctx.beginPath();
        ctx.setLineDash([8, 8]);
        ctx.moveTo(area.x + leftPad - 20, y);
        ctx.lineTo(area.x + area.w, y);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      if (this.state!.options.showYAxis) {
        ctx.fillText(this.formatValue(val, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), area.x + leftPad - 40, y);
      }
    }
    
    const zeroY = parsed.minVal < 0 ? area.y + area.h - ((0 - parsed.minVal) / valueRange) * area.h : area.y + area.h;
    if (this.state!.options.showXAxis || this.state!.options.showYAxis) {
      ctx.beginPath();
      ctx.moveTo(area.x + leftPad - 20, zeroY);
      ctx.lineTo(area.x + area.w, zeroY);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    parsed.data.forEach((item: any, idx: number) => {
      const x = area.x + leftPad + idx * xStep;
      if (this.state!.options.showGrid) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, area.y);
        ctx.lineTo(x, area.y + area.h);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.state!.options.showXAxis) {
        ctx.globalAlpha = Math.min(1, progress * 2);
        ctx.fillText(item.label, x, area.y + area.h + 15);
        ctx.globalAlpha = 1.0;
      }
    });

    for (let s = 0; s < numSeries; s++) {
      const color = palette[s % palette.length];
      
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      if (this.state!.options.lineGlow > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = this.state!.options.lineGlow;
      }
      
      let lastX = 0, lastY = 0;
      
      for (let i = 0; i < numPoints; i++) {
        const item = parsed.data[i];
        const val = item.values[s] !== undefined ? item.values[s] : 0;
        const x = area.x + leftPad + i * xStep;
        const y = area.y + area.h - ((val - parsed.minVal) / valueRange) * area.h;
        
        if (i === 0) {
          ctx.moveTo(x, y);
          lastX = x; lastY = y;
        } else {
          if (x <= currentXProg) {
            ctx.lineTo(x, y);
            lastX = x; lastY = y;
          } else if (lastX < currentXProg) {
            const fraction = (currentXProg - lastX) / (x - lastX);
            const interpY = lastY + (y - lastY) * fraction;
            ctx.lineTo(currentXProg, interpY);
            lastX = currentXProg;
            lastY = interpY;
            break;
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; 
      
      if (progress > 0) {
        ctx.beginPath();
        ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = this.state!.options.bgColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        if (this.state!.options.showValues) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `800 24px "JetBrains Mono"`;
          ctx.fillStyle = textColor;
          
          const interpVal = parsed.minVal + ((area.y + area.h - lastY) / area.h) * valueRange;
          ctx.fillText(this.formatValue(interpVal, this.state!.options.valueFormat, parsed.maxVal, parsed.minVal), lastX + 15, lastY);
        }
      }
    }
  }

  private drawStackedChart(ctx: any, area: any, progress: number, textColor: string, gridColor: string, palette: string[], fontBase: string, parsed: any) {
    const steps = 4;
    const maxVal = parsed.maxStackedVal > 0 ? parsed.maxStackedVal : 1;
    const valueRange = maxVal;
    const leftPad = this.state!.options.showYAxis ? 100 : 20;
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 20px "${fontBase}"`;
    ctx.fillStyle = textColor;

    for (let i = 0; i <= steps; i++) {
      const val = (valueRange / steps) * i;
      const y = area.y + area.h - (val / valueRange) * area.h;

      if (this.state!.options.showGrid) {
        ctx.beginPath();
        ctx.setLineDash([8, 8]);
        ctx.moveTo(area.x + leftPad - 20, y);
        ctx.lineTo(area.x + area.w, y);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (this.state!.options.showYAxis) {
        ctx.fillText(this.formatValue(val, this.state!.options.valueFormat, maxVal, 0), area.x + leftPad - 40, y);
      }
    }

    const zeroY = area.y + area.h;
    
    if (this.state!.options.showXAxis || this.state!.options.showYAxis) {
      ctx.beginPath();
      ctx.moveTo(area.x + leftPad - 20, zeroY);
      ctx.lineTo(area.x + area.w, zeroY);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const numBars = parsed.data.length;
    const slotWidth = (area.w - leftPad) / numBars;
    const barWidth = slotWidth * 0.7;
    const numSeries = parsed.seriesNames.length;
    
    ctx.textAlign = 'center';

    parsed.data.forEach((item: any, index: number) => {
      const x = area.x + leftPad + (index * slotWidth) + (slotWidth - barWidth)/2;
      let currentY = zeroY;
      
      if (this.state!.options.showXAxis) {
        ctx.textBaseline = 'top';
        ctx.font = `700 24px "${fontBase}"`;
        ctx.fillStyle = textColor;
        ctx.globalAlpha = Math.min(1, progress * 2);
        ctx.fillText(item.label, x + barWidth/2, zeroY + 15);
        ctx.globalAlpha = 1.0;
      }
      
      let stackTotal = 0;

      for (let s = 0; s < numSeries; s++) {
        const val = item.values[s] || 0;
        stackTotal += val;
        const targetPixelHeight = (val / valueRange) * area.h;
        const currentPixelHeight = targetPixelHeight * progress;
        const y = currentY - currentPixelHeight;
        const color = palette[s % palette.length];

        ctx.fillStyle = color;
        ctx.fillRect(x, y, barWidth, currentPixelHeight);
        
        if (this.state!.options.showValues && currentPixelHeight > 30 && progress > 0.5) {
          ctx.fillStyle = '#ffffff';
          const isColorDark = color.replace('#', '').length === 6 && parseInt(color.replace('#', ''), 16) < 0x888888;
          if (!isColorDark) ctx.fillStyle = '#1e293b';
          
          ctx.textBaseline = 'middle';
          ctx.font = `800 18px "JetBrains Mono"`;
          ctx.fillText(this.formatValue(val * progress, this.state!.options.valueFormat, maxVal, 0), x + barWidth/2, y + currentPixelHeight/2);
        }

        currentY = y;
      }
      
      if (this.state!.options.showValues && progress > 0.1) {
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'bottom';
        ctx.font = `800 26px "JetBrains Mono"`;
        ctx.fillText(this.formatValue(stackTotal * progress, this.state!.options.valueFormat, maxVal, 0), x + barWidth/2, currentY - 10);
      }
    });
  }
}
