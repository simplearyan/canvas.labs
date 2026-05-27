import type { TypographyState, TypographyElement, TypographyAnimPreset } from './types';

// Easing Functions
const easeOutBack = (x: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeSpring = (x: number): number => {
    return 1 - Math.cos(x * Math.PI * 4) * Math.exp(-x * 6);
};

export class TypographyEngine {
    private canvas: HTMLCanvasElement | OffscreenCanvas;
    private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    private state: TypographyState | null = null;
    private animationFrameId: number | null = null;
    private startTime: number = 0;
    
    private width: number = 1920;
    private height: number = 1080;
    private dpr: number = 1;

    public isTransparent: boolean = false;
    public onTimeUpdate?: (time: number) => void;
    private pausedTime: number = 0;
    
    // Performance Caching
    private charCache = new Map<string, any[]>();

    constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
        this.canvas = canvas;
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error("Failed to get 2D context");
        this.ctx = context as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
        
        this.setupCanvas();
    }

    private setupCanvas() {
        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        
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

    public updateState(newState: TypographyState) {
        this.state = newState;
        this.render();
    }

    public play() {
        this.startTime = performance.now() - (this.pausedTime * 1000);
        this.loop(performance.now());
    }

    public pause() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.pausedTime = (performance.now() - this.startTime) / 1000;
    }

    public seek(progress: number) {
        if (!this.state) return;
        const timeInSeconds = progress * (this.state.duration || 5);
        this.pausedTime = timeInSeconds;
        this.renderFrame(timeInSeconds);
    }

    public hitTest(x: number, y: number): string | null {
        if (!this.state) return null;
        for (let i = this.state.elements.length - 1; i >= 0; i--) {
            const el = this.state.elements[i];
            if (el.visible === false || el.locked) continue;
            
            let w = 0, h = 0;
            if (el.type === 'text') {
                this.ctx.font = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
                const lines = (el as any).text.split('\n');
                h = lines.length * (el as any).fontSize * 1.1;
                lines.forEach((line: string) => {
                    let totalLineW = 0;
                    for(let c=0; c<line.length; c++) totalLineW += this.ctx.measureText(line[c]).width + ((el as any).letterSpacing||0);
                    if(line.length>0) totalLineW -= ((el as any).letterSpacing||0);
                    if (totalLineW > w) w = totalLineW;
                });
            } else if (el.type === 'shape') {
                w = (el as any).w;
                h = (el as any).h;
                if ((el as any).shapeType === 'circle') h = w;
            }

            // Ignoring rotation for simple AABB hit test - with 25px hit padding for enhanced usability
            const hitPadding = 25;
            const left = el.x - w / 2 - hitPadding;
            const right = el.x + w / 2 + hitPadding;
            const top = el.y - h / 2 - hitPadding;
            const bottom = el.y + h / 2 + hitPadding;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                return el.id;
            }
        }
        return null;
    }

    public render() {
        if (!this.state) return;
        
        // Render the current time state instead of hardcoding to the end
        const currentTime = this.state.time !== undefined ? this.state.time : this.pausedTime;
        const duration = this.state.duration || 5;
        this.seek(currentTime / duration);
    }

    private loop = (timestamp: number) => {
        if (!this.state) return;

        let elapsed = (timestamp - this.startTime) / 1000;
        const duration = this.state.duration || 5;
        
        if (elapsed > duration) elapsed = duration;

        this.renderFrame(elapsed);
        if (this.onTimeUpdate) this.onTimeUpdate(elapsed);

        if (elapsed < duration) {
            this.animationFrameId = requestAnimationFrame(this.loop);
        } else {
            this.animationFrameId = null;
        }
    };

    private generateStaticSVGFilter(el: TypographyElement, uniqueId: string, seed: number): string | null {
        if (typeof document === 'undefined') return null;

        const needsFilter = (el.roughness && el.roughness > 0) || 
                            (el.innerShadowBlur && el.innerShadowBlur > 0) || 
                            (el.innerShadowX && Math.abs(el.innerShadowX) > 0) || 
                            (el.innerShadowY && Math.abs(el.innerShadowY) > 0);
                            
        if (!needsFilter) return null;

        let filterSvg = document.getElementById('dynamic-filters-cache');
        if (!filterSvg) {
            filterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            filterSvg.id = 'dynamic-filters-cache';
            filterSvg.style.position = 'absolute';
            filterSvg.style.width = '0';
            filterSvg.style.height = '0';
            filterSvg.style.pointerEvents = 'none';
            document.body.appendChild(filterSvg);
        }

        const fId = `filter-cache-${uniqueId}`;
        let filter = document.getElementById(fId);
        
        if (!filter) {
            filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.id = fId;
            filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
            filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
            filter.setAttribute('color-interpolation-filters', 'sRGB');
            filterSvg.appendChild(filter);
        }

        let steps = '';
        let currentIn = "SourceGraphic";

        if ((el.innerShadowBlur || 0) > 0 || (el.innerShadowX || 0) !== 0 || (el.innerShadowY || 0) !== 0) {
            const op = (el.innerShadowOpacity ?? 50) / 100;
            steps += `
                <feOffset dx="${el.innerShadowX || 0}" dy="${el.innerShadowY || 0}" in="SourceAlpha" result="innerOffset"/>
                <feGaussianBlur stdDeviation="${el.innerShadowBlur || 0}" in="innerOffset" result="innerBlur"/>
                <feComposite operator="out" in="SourceAlpha" in2="innerBlur" result="inverse"/>
                <feFlood flood-color="${el.innerShadowColor || '#000000'}" flood-opacity="${op}" result="innerColor"/>
                <feComposite operator="in" in="innerColor" in2="inverse" result="innerShadow"/>
                <feComposite operator="over" in="innerShadow" in2="SourceGraphic" result="graphicWithInner"/>
            `;
            currentIn = "graphicWithInner";
        }

        if ((el.roughness || 0) > 0) {
            steps += `
                <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="${seed}" result="noise" />
                <feDisplacementMap in="${currentIn}" in2="noise" scale="${el.roughness}" xChannelSelector="R" yChannelSelector="G" result="final" />
            `;
        } else {
            steps += `<feComponentTransfer in="${currentIn}" result="final"><feFuncA type="identity"/></feComponentTransfer>`;
        }

        filter.innerHTML = steps;
        return `url(#${fId})`;
    }

    private getCachedChar(el: TypographyElement, char: string, charColor: string, charScale: number): any[] {
        const isStopMotion = el.animPreset === 'stop-motion';
        const frameCount = (isStopMotion && (el.roughness || 0) > 0) ? 3 : 1;

        const key = JSON.stringify({
            type: el.type,
            char,
            shapeType: el.type === 'shape' ? (el as any).shapeType : '',
            w: (el as any).w, h: (el as any).h, borderRadius: (el as any).borderRadius,
            fontFamily: (el as any).fontFamily, fontWeight: (el as any).fontWeight, fontSize: (el as any).fontSize,
            fill: charColor, stroke: el.stroke, strokeWidth: el.strokeWidth,
            shadowColor: el.shadowColor, shadowBlur: el.shadowBlur, shadowOffsetX: el.shadowOffsetX, shadowOffsetY: el.shadowOffsetY,
            innerShadowBlur: el.innerShadowBlur, innerShadowX: el.innerShadowX, innerShadowY: el.innerShadowY, innerShadowOpacity: el.innerShadowOpacity, innerShadowColor: el.innerShadowColor,
            roughness: el.roughness,
            frameCount
        });

        if (this.charCache.has(key)) {
            return this.charCache.get(key)!;
        }

        const frames: any[] = [];
        const baseSize = el.type === 'text' ? (el as any).fontSize : Math.max((el as any).w, (el as any).h);
        const pad = baseSize * 0.5 + (el.shadowBlur || 0) + (el.strokeWidth || 0) + (el.roughness || 0) * 2;
        
        let w = pad * 2;
        let h = pad * 2;

        if (el.type === 'text') {
            const tempCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(1, 1);
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.font = `${(el as any).fontWeight} ${baseSize}px "${(el as any).fontFamily}"`;
            w += tempCtx.measureText(char).width;
            h += baseSize;
        } else {
            w += (el as any).w;
            h += (el as any).h;
        }

        w = Math.ceil(w);
        h = Math.ceil(h);

        for (let i = 0; i < frameCount; i++) {
            const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(w, h);
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

            // Generate unique filter ID per seed to avoid DOM collisions
            const uniqueFilterId = btoa(encodeURIComponent(key)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) + i;
            const filterUrl = this.generateStaticSVGFilter(el, uniqueFilterId, i);
            
            ctx.save();
            ctx.translate(w/2, h/2);

            if((el.shadowBlur || 0) > 0 || Math.abs(el.shadowOffsetX || 0) > 0 || Math.abs(el.shadowOffsetY || 0) > 0) {
                ctx.shadowColor = el.shadowColor || '#000000';
                ctx.shadowBlur = el.shadowBlur || 0;
                ctx.shadowOffsetX = el.shadowOffsetX || 0;
                ctx.shadowOffsetY = el.shadowOffsetY || 0;
            }

            if (filterUrl) {
                ctx.filter = filterUrl;
            }

            if (el.type === 'text') {
                ctx.font = `${(el as any).fontWeight} ${baseSize}px "${(el as any).fontFamily}"`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if ((el.strokeWidth || 0) > 0) {
                    ctx.strokeStyle = el.stroke || '#000000';
                    ctx.lineWidth = el.strokeWidth || 0;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(char, 0, 0);
                }
                if (charColor && charColor !== 'transparent') {
                    ctx.fillStyle = charColor;
                    ctx.fillText(char, 0, 0);
                }
            } else {
                ctx.beginPath();
                if ((el as any).shapeType === 'rect') {
                    ctx.roundRect(-(el as any).w/2, -(el as any).h/2, (el as any).w, (el as any).h, (el as any).borderRadius || 0);
                } else if ((el as any).shapeType === 'circle') {
                    ctx.arc(0, 0, (el as any).w/2, 0, Math.PI*2);
                }
                if(charColor && charColor !== 'transparent') {
                    ctx.fillStyle = charColor;
                    ctx.fill();
                }
                if((el.strokeWidth || 0) > 0) {
                    ctx.strokeStyle = el.stroke || '#000000';
                    ctx.lineWidth = el.strokeWidth || 0;
                    ctx.lineJoin = 'round';
                    ctx.stroke();
                }
            }

            ctx.restore();
            (canvas as any)._drawOffset = { x: -w/2, y: -h/2 };
            frames.push(canvas);
        }

        this.charCache.set(key, frames);
        return frames;
    }

    private getGlobalShake(time: number): number {
        if (!this.state) return 0;
        let totalShake = 0;
        this.state.elements.forEach(el => {
            if(!el.visible || !['sam-hogan', 'kinetic-drop'].includes(el.animPreset || '')) return;
            const shakeIntensity = el.animShake !== undefined ? el.animShake : 20;
            if (shakeIntensity <= 0) return;
            
            const duration = el.animDuration || 1.0;
            const stagger = el.animStagger || 0;
            let charCount = el.type === 'text' ? el.text.replace(/\n/g, '').length : 1;
            
            for(let i=0; i<charCount; i++) {
                 const startTime = i * stagger;
                 let t = (time - startTime) / duration;
                 if (t >= 1.0 && t <= 1.2) {
                     totalShake += ((1.2 - t) / 0.2) * shakeIntensity; 
                 }
            }
        });
        return totalShake;
    }

    private getAnimatedCharTransform(preset: TypographyAnimPreset | undefined, globalTime: number, charIndex: number, totalChars: number, el: TypographyElement) {
        let tX = 0, tY = 0, r = 0, s = 1, alpha = 1, mBlur = 0;
        if(preset === 'none' || !preset) return {tX, tY, r, s, alpha, mBlur};

        const duration = el.animDuration || 1.0;
        const stagger = el.animStagger || 0;
        const startTime = charIndex * stagger; 
        let t = (globalTime - startTime) / duration;
        if(t < 0) t = 0;
        if(t > 1) t = 1;

        if (preset === 'pop-up') {
            if(t === 0) return { tX: 0, tY: 200, r: 0, s: 0.5, alpha: 0, mBlur: 0 };
            const e = easeOutBack(t);
            tY = 200 * (1 - e);
            r = (Math.sin(charIndex) * 20) * (1 - e); 
            alpha = Math.min(1, t * 5); 
        } 
        else if (preset === 'drop-down') {
            if(t === 0) return { tX: 0, tY: -200, r: 0, s: 1, alpha: 0, mBlur: 0 };
            const e = easeOutBack(t);
            tY = -200 * (1 - e);
            alpha = Math.min(1, t * 5);
        }
        else if (preset === 'throw') {
            if(t === 0) return { tX: 0, tY: 0, r: 0, s: 10, alpha: 0, mBlur: 0 };
            const e = easeSpring(t);
            s = 1 + (9 * (1 - e));
            alpha = Math.min(1, t * 5);
        }
        else if (preset === 'sam-hogan') {
            if(t === 0) return { tX: 0, tY: 0, r: 0, s: 10, alpha: 0, mBlur: 0 };
            if(t >= 1) {
                s = 1; alpha = 1; mBlur = 0;
            } else {
                const e = Math.pow(t, 4);
                s = 10 - (9 * e);
                alpha = Math.min(1, t * 5);
                mBlur = e * (el.animMotionBlur || 0);
            }
        }
        else if (preset === 'kinetic-drop') {
            if(t === 0) return { tX: 0, tY: -1200, r: 0, s: 1, alpha: 0, mBlur: 0 };
            if(t >= 1) {
                tY = 0; alpha = 1; mBlur = 0;
            } else {
                const e = Math.pow(t, 5);
                tY = -1200 * (1 - e);
                alpha = Math.min(1, t * 5);
                mBlur = e * (el.animMotionBlur || 0);
            }
        }
        else if (preset === 'stop-motion') {
            const frame = Math.floor(globalTime * 6);
            tX = (Math.sin(frame * 12.3 + charIndex * 4.5) * 4);
            tY = (Math.cos(frame * 8.7 + charIndex * 2.1) * 4);
            r = (Math.sin(frame * 5.5 + charIndex * 7.7) * 4);
        }

        return { tX, tY, r, s, alpha, mBlur };
    }

    public renderFrame(timeInSeconds: number) {
        if (!this.state) return;
        
        const { ctx, width, height } = this;
        ctx.save();

        const totalShake = this.getGlobalShake(timeInSeconds);
        if (totalShake > 0) {
            const shakeX = (Math.random() - 0.5) * totalShake;
            const shakeY = (Math.random() - 0.5) * totalShake;
            
            ctx.translate(width/2, height/2);
            ctx.scale(1.05, 1.05); 
            ctx.translate(-width/2 + shakeX, -height/2 + shakeY);
        }

        if (!this.isTransparent) {
            ctx.fillStyle = this.state.bgColor;
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height);
        }

        this.state.elements.forEach(el => {
            if (el.visible === false) return;
            if (this.state.selectedId === el.id && this.state.isEditingText) return;
            ctx.save();
            
            ctx.translate(el.x, el.y);
            if (el.rotation) ctx.rotate(el.rotation * Math.PI / 180);

            if (el.type === 'text') {
                const lines = el.text.split('\n');
                const lineHeight = el.fontSize * 1.1;
                const startY = -(lines.length - 1) * lineHeight / 2;
                let globalCharIdx = 0;
                const totalChars = el.text.replace(/\n/g, '').length;

                // Set font on main ctx to measure text width
                ctx.font = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;

                lines.forEach((line, i) => {
                    const yOffset = startY + (i * lineHeight);
                    
                    let totalLineW = 0;
                    for(let c=0; c<line.length; c++) totalLineW += ctx.measureText(line[c]).width + (el.letterSpacing||0);
                    if(line.length>0) totalLineW -= (el.letterSpacing||0);

                    let cursorX = -totalLineW / 2;

                    for(let c=0; c<line.length; c++) {
                        const char = line[c];
                        const charW = ctx.measureText(char).width;
                        
                        const tr = this.getAnimatedCharTransform(el.animPreset, timeInSeconds, globalCharIdx, totalChars, el);
                        
                        const styleOverride = (el.charStyles && el.charStyles[globalCharIdx]) ? el.charStyles[globalCharIdx] : {};
                        const charColor = styleOverride.fill || el.fill;
                        const charScale = styleOverride.s !== undefined ? styleOverride.s : 1;
                        const charRot = styleOverride.r || 0;

                        if(tr.alpha > 0) {
                            const frames = this.getCachedChar(el, char, charColor, charScale);
                            const frameIdx = frames.length > 1 ? Math.floor(timeInSeconds * 6) % frames.length : 0;
                            const cachedCanvas = frames[frameIdx];
                            const drawOffset = (cachedCanvas as any)._drawOffset;

                            ctx.save();
                            ctx.translate(cursorX + charW/2 + tr.tX, yOffset + tr.tY);
                            if(tr.r || charRot) ctx.rotate((tr.r + charRot) * Math.PI / 180);
                            if(tr.s * charScale !== 1) ctx.scale(tr.s * charScale, tr.s * charScale);
                            
                            ctx.globalAlpha = tr.alpha;

                            // Fake Motion Blur to replace expensive dynamic filters
                            if (tr.mBlur > 0) {
                                const steps = 3;
                                ctx.globalAlpha = tr.alpha / steps;
                                for(let b=0; b<steps; b++) {
                                    const yBlurOffset = (b - steps/2) * (tr.mBlur * 2);
                                    ctx.drawImage(cachedCanvas, drawOffset.x, drawOffset.y + yBlurOffset);
                                }
                            } else {
                                ctx.drawImage(cachedCanvas, drawOffset.x, drawOffset.y);
                            }

                            ctx.restore();
                        }

                        cursorX += charW + (el.letterSpacing||0);
                        globalCharIdx++;
                    }
                });
            } else if (el.type === 'shape') {
                const tr = this.getAnimatedCharTransform(el.animPreset, timeInSeconds, 0, 1, el);
                if(tr.alpha > 0) {
                    const charColor = (el as any).fill;
                    const charScale = 1;
                    const frames = this.getCachedChar(el, '', charColor, charScale);
                    const frameIdx = frames.length > 1 ? Math.floor(timeInSeconds * 6) % frames.length : 0;
                    const cachedCanvas = frames[frameIdx];
                    const drawOffset = (cachedCanvas as any)._drawOffset;

                    ctx.save();
                    ctx.translate(tr.tX, tr.tY);
                    if(tr.r) ctx.rotate(tr.r * Math.PI / 180);
                    if(tr.s !== 1) ctx.scale(tr.s, tr.s);
                    ctx.globalAlpha = tr.alpha;

                    if (tr.mBlur > 0) {
                        const steps = 3;
                        ctx.globalAlpha = tr.alpha / steps;
                        for(let b=0; b<steps; b++) {
                            const yBlurOffset = (b - steps/2) * (tr.mBlur * 2);
                            ctx.drawImage(cachedCanvas, drawOffset.x, drawOffset.y + yBlurOffset);
                        }
                    } else {
                        ctx.drawImage(cachedCanvas, drawOffset.x, drawOffset.y);
                    }
                    ctx.restore();
                }
            }

            ctx.restore();
        });

        ctx.restore(); 

        if (this.state.selectedId) {
            const selectedEl = this.state.elements.find(e => e.id === this.state.selectedId);
            if (selectedEl && selectedEl.visible !== false) {
                this.drawSelectionBox(selectedEl);
            }
        }
    }

    public getElementBounds(elId: string): { x: number, y: number, w: number, h: number, rotation: number } | null {
        if (!this.state) return null;
        const el = this.state.elements.find(e => e.id === elId);
        if (!el) return null;
        
        let w = 0, h = 0;
        if (el.type === 'text') {
            this.ctx.font = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
            const lines = (el as any).text.split('\n');
            h = lines.length * (el as any).fontSize * 1.1;
            lines.forEach((line: string) => {
                let totalLineW = 0;
                for(let c=0; c<line.length; c++) totalLineW += this.ctx.measureText(line[c]).width + ((el as any).letterSpacing||0);
                if(line.length>0) totalLineW -= ((el as any).letterSpacing||0);
                if (totalLineW > w) w = totalLineW;
            });
        } else if (el.type === 'shape') {
            w = (el as any).w;
            h = (el as any).h;
            if ((el as any).shapeType === 'circle') h = w;
        }

        const pad = 10;
        w += pad * 2;
        h += pad * 2;

        return { x: el.x, y: el.y, w, h, rotation: el.rotation || 0 };
    }
    public getElementHandles(elId: string): { name: string, x: number, y: number }[] | null {
        const bounds = this.getElementBounds(elId);
        if (!bounds) return null;

        const { x, y, w, h, rotation } = bounds;
        const rad = rotation * Math.PI / 180;

        const displayScale = (this.canvas && (this.canvas as HTMLCanvasElement).clientWidth)
            ? this.width / (this.canvas as HTMLCanvasElement).clientWidth
            : 1;

        const rotOffset = 30 * displayScale;

        const localPositions = [
            { name: 'tl', lx: -w/2, ly: -h/2 },
            { name: 'tc', lx: 0,    ly: -h/2 },
            { name: 'tr', lx: w/2,  ly: -h/2 },
            { name: 'ml', lx: -w/2, ly: 0 },
            { name: 'mr', lx: w/2,  ly: 0 },
            { name: 'bl', lx: -w/2, ly: h/2 },
            { name: 'bc', lx: 0,    ly: h/2 },
            { name: 'br', lx: w/2,  ly: h/2 },
            { name: 'rot', lx: 0,   ly: -h/2 - rotOffset }
        ];

        return localPositions.map(pos => {
            const hx = x + pos.lx * Math.cos(rad) - pos.ly * Math.sin(rad);
            const hy = y + pos.lx * Math.sin(rad) + pos.ly * Math.cos(rad);
            return { name: pos.name, x: hx, y: hy };
        });
    }

    private drawSelectionBox(el: TypographyElement) {
        const bounds = this.getElementBounds(el.id);
        if (!bounds) return;

        const { w, h } = bounds;

        const displayScale = (this.canvas && (this.canvas as HTMLCanvasElement).clientWidth)
            ? this.width / (this.canvas as HTMLCanvasElement).clientWidth
            : 1;

        this.ctx.save();
        this.ctx.translate(el.x, el.y);
        if (el.rotation) this.ctx.rotate(el.rotation * Math.PI / 180);

        const strokeW = 1.5 * displayScale;
        const lineDash = [6 * displayScale, 4 * displayScale];
        const rotOffset = 30 * displayScale;
        const handleSize = 8 * displayScale;

        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = strokeW;
        this.ctx.setLineDash(lineDash);
        this.ctx.strokeRect(-w/2, -h/2, w, h);
        
        // Draw line to rotation handle
        const rotY = -h/2 - rotOffset;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -h/2);
        this.ctx.lineTo(0, rotY);
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 1 * displayScale;
        this.ctx.stroke();

        // Draw rotation handle
        this.ctx.beginPath();
        this.ctx.arc(0, rotY, 5 * displayScale, 0, Math.PI*2);
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5 * displayScale;
        this.ctx.stroke();

        this.ctx.setLineDash([]);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#3b82f6';
        
        const positions = [
            [-w/2, -h/2], [0, -h/2], [w/2, -h/2],
            [-w/2, 0],               [w/2, 0],
            [-w/2, h/2],  [0, h/2],  [w/2, h/2]
        ];
        
        positions.forEach(([hx, hy]) => {
            this.ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
            this.ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
        });

        this.ctx.restore();
    }
}
