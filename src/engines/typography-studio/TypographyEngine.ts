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
        // Map 0-1 progress to 0-duration seconds
        const timeInSeconds = progress * (this.state.duration || 5);
        this.renderFrame(timeInSeconds);
    }

    public render() {
        this.seek(1.0); // Static preview at end of animation
    }

    private loop = (timestamp: number) => {
        if (!this.state) return;

        let elapsed = (timestamp - this.startTime) / 1000;
        const duration = this.state.duration || 5;
        
        if (elapsed > duration) elapsed = duration;

        this.renderFrame(elapsed);

        if (elapsed < duration) {
            this.animationFrameId = requestAnimationFrame(this.loop);
        } else {
            this.animationFrameId = null;
        }
    };

    private ensureSVGFilter(el: TypographyElement): string | null {
        // Skip filters when running offscreen or without DOM access
        if (typeof document === 'undefined') return null;

        const needsFilter = (el.roughness && el.roughness > 0) || 
                            (el.innerShadowBlur && el.innerShadowBlur > 0) || 
                            (el.innerShadowX && Math.abs(el.innerShadowX) > 0) || 
                            (el.innerShadowY && Math.abs(el.innerShadowY) > 0);
                            
        if (!needsFilter) return null;

        let filterSvg = document.getElementById('dynamic-filters');
        if (!filterSvg) {
            filterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            filterSvg.id = 'dynamic-filters';
            filterSvg.style.position = 'absolute';
            filterSvg.style.width = '0';
            filterSvg.style.height = '0';
            filterSvg.style.pointerEvents = 'none';
            document.body.appendChild(filterSvg);
        }

        const fId = `filter-${el.id}`;
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
            const isStopMotion = el.animPreset === 'stop-motion';
            const time = this.state?.time || 0;
            const frameSeed = isStopMotion ? (el.id + Math.floor(time * 6)) : el.id;

            steps += `
                <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="${frameSeed}" result="noise" />
                <feDisplacementMap in="${currentIn}" in2="noise" scale="${el.roughness}" xChannelSelector="R" yChannelSelector="G" result="final" />
            `;
        } else {
            steps += `<feComponentTransfer in="${currentIn}" result="final"><feFuncA type="identity"/></feComponentTransfer>`;
        }

        // Only update if changed to avoid unnecessary DOM mutations
        if ((el as any)._lastFilterSteps !== steps) {
            filter.innerHTML = steps;
            (el as any)._lastFilterSteps = steps;
        }

        return `url(#${fId})`;
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
        
        // Ensure state time is up to date for filters if needed
        this.state.time = timeInSeconds;

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
            ctx.save();
            
            const baseSVGFilterUrl = this.ensureSVGFilter(el);
            
            ctx.translate(el.x, el.y);
            if (el.rotation) ctx.rotate(el.rotation * Math.PI / 180);

            if((el.shadowBlur || 0) > 0 || Math.abs(el.shadowOffsetX || 0) > 0 || Math.abs(el.shadowOffsetY || 0) > 0) {
                ctx.shadowColor = el.shadowColor || '#000000';
                ctx.shadowBlur = el.shadowBlur || 0;
                ctx.shadowOffsetX = el.shadowOffsetX || 0;
                ctx.shadowOffsetY = el.shadowOffsetY || 0;
            }

            if (el.type === 'text') {
                ctx.font = `${el.fontWeight} ${el.fontSize}px "${el.fontFamily}"`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                if ((el.strokeWidth || 0) > 0) {
                    ctx.strokeStyle = el.stroke || '#000000';
                    ctx.lineWidth = el.strokeWidth || 0;
                    ctx.lineJoin = 'round';
                }

                const lines = el.text.split('\n');
                const lineHeight = el.fontSize * 1.1;
                const startY = -(lines.length - 1) * lineHeight / 2;
                let globalCharIdx = 0;
                const totalChars = el.text.replace(/\n/g, '').length;

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
                            ctx.save();
                            
                            let charFilters = [];
                            if (baseSVGFilterUrl) charFilters.push(baseSVGFilterUrl);
                            if (tr.mBlur > 0) charFilters.push(`blur(${tr.mBlur}px)`);
                            ctx.filter = charFilters.length > 0 ? charFilters.join(' ') : 'none';

                            ctx.translate(cursorX + charW/2 + tr.tX, yOffset + tr.tY);
                            if(tr.r || charRot) ctx.rotate((tr.r + charRot) * Math.PI / 180);
                            if(tr.s * charScale !== 1) ctx.scale(tr.s * charScale, tr.s * charScale);
                            ctx.globalAlpha = tr.alpha;

                            if ((el.strokeWidth || 0) > 0) ctx.strokeText(char, 0, 0);
                            if (charColor && charColor !== 'transparent') {
                                ctx.fillStyle = charColor;
                                ctx.fillText(char, 0, 0);
                            }
                            ctx.restore();
                        }

                        cursorX += charW + (el.letterSpacing||0);
                        globalCharIdx++;
                    }
                });
            } 
            else if (el.type === 'shape') {
                const tr = this.getAnimatedCharTransform(el.animPreset, timeInSeconds, 0, 1, el);
                if(tr.alpha > 0) {
                    let shapeFilters = [];
                    if (baseSVGFilterUrl) shapeFilters.push(baseSVGFilterUrl);
                    if (tr.mBlur > 0) shapeFilters.push(`blur(${tr.mBlur}px)`);
                    ctx.filter = shapeFilters.length > 0 ? shapeFilters.join(' ') : 'none';

                    ctx.translate(tr.tX, tr.tY);
                    if(tr.r) ctx.rotate(tr.r * Math.PI / 180);
                    if(tr.s !== 1) ctx.scale(tr.s, tr.s);
                    ctx.globalAlpha = tr.alpha;

                    ctx.beginPath();
                    if (el.shapeType === 'rect') {
                        ctx.roundRect(-el.w/2, -el.h/2, el.w, el.h, el.borderRadius || 0);
                    } else if (el.shapeType === 'circle') {
                        ctx.arc(0, 0, el.w/2, 0, Math.PI*2);
                    }
                    
                    if(el.fill && el.fill !== 'transparent') {
                        ctx.fillStyle = el.fill;
                        ctx.fill();
                    }
                    if((el.strokeWidth || 0) > 0) {
                        ctx.strokeStyle = el.stroke || '#000000';
                        ctx.lineWidth = el.strokeWidth || 0;
                        ctx.lineJoin = 'round';
                        ctx.stroke();
                    }
                }
            }

            ctx.restore();
        });

        // Optional: Selection Box (Removed for production renderer, only needed in editor logic externally if wanted)

        ctx.restore(); 
    }
}
