import type { EasingType, KineticSlide, KineticElement, AnimInEffect, AnimOutEffect, SlideTransition } from './types';

// Constants
export const SLIDE_DURATION = 5.0; // Seconds per slide

/**
 * EASING MATHEMATICS
 */
export const Easing = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) { return n1 * t * t; }
    else if (t < 2 / d1) { return n1 * (t -= 1.5 / d1) * t + 0.75; }
    else if (t < 2.5 / d1) { return n1 * (t -= 2.25 / d1) * t + 0.9375; }
    else { return n1 * (t -= 2.625 / d1) * t + 0.984375; }
  }
};

export function applyEase(t: number, type: EasingType): number {
  if (Easing[type]) return Easing[type](t);
  return Easing.easeOut(t); // Default safe fallback
}

/**
 * CANVAS ENGINE RENDERING LOGIC
 */

export function drawBoundingBox(ctxToDraw: CanvasRenderingContext2D, el: KineticElement) {
  ctxToDraw.save();
  
  // Clear shadows for the bounding box itself
  ctxToDraw.shadowColor = 'transparent';
  ctxToDraw.shadowBlur = 0;
  ctxToDraw.shadowOffsetX = 0;
  ctxToDraw.shadowOffsetY = 0;
  
  let hw = 0, hh = 0;
  if (el.type === 'text' && el.text) {
    ctxToDraw.font = `${el.fontWeight || '700'} ${el.size}px ${el.font}`;
    if ('letterSpacing' in ctxToDraw) {
      (ctxToDraw as any).letterSpacing = `${el.letterSpacing || 0}px`;
    }
    hw = (ctxToDraw.measureText(el.text).width / 2) + 10;
    hh = (el.size / 2) + 10;
  } else if (el.type === 'rect') {
    hw = (el.size * 1.5 / 2) + 10; hh = (el.size / 2) + 10;
  } else if (el.type === 'circle') {
    hw = (el.size / 2) + 10; hh = (el.size / 2) + 10;
  }

  ctxToDraw.strokeStyle = '#3b82f6'; // Blue
  ctxToDraw.lineWidth = 1.5;
  ctxToDraw.setLineDash([6, 6]);
  ctxToDraw.strokeRect(-hw, -hh, hw * 2, hh * 2);
  
  // Center dot
  ctxToDraw.fillStyle = '#ffffff';
  ctxToDraw.setLineDash([]);
  ctxToDraw.beginPath();
  ctxToDraw.arc(0, 0, 3, 0, Math.PI*2);
  ctxToDraw.fill();
  ctxToDraw.stroke();
  
  ctxToDraw.restore();
}

export function drawSlide(
  ctxToDraw: CanvasRenderingContext2D, 
  slide: KineticSlide, 
  localTime: number, 
  width: number, 
  height: number, 
  offsetX = 0, 
  opacity = 1, 
  isTransitioningOut = false, 
  transparentBg = false, 
  drawUI = true,
  isPlaying = false,
  activeElementId: string | null = null
) {
  ctxToDraw.save();
  ctxToDraw.translate(offsetX, 0);
  ctxToDraw.globalAlpha = opacity;

  // Draw Background
  if (!transparentBg && slide.bg !== 'transparent') {
    ctxToDraw.fillStyle = slide.bg;
    // Overdraw slightly to prevent anti-aliasing gaps between adjacent slides during transition
    ctxToDraw.fillRect(-2, -2, width + 4, height + 4);
  }

  // Draw Elements (Painter's algorithm - lower index is back)
  slide.elements.forEach(el => {
    // Extend visibility window slightly to prevent popping during transitions
    if (localTime < el.start || localTime > el.end + 0.5) return;

    ctxToDraw.save();
    
    // Track raw progress (0 to 1) for both in and out
    let progressIn = Math.min(1, Math.max(0, (localTime - el.start) / el.inDur));
    let progressOut = Math.min(1, Math.max(0, (localTime - (el.end - el.outDur)) / el.outDur));

    let elAlpha = 1, scale = 1, dx = 0, dy = 0, rot = (el.rotation || 0) * Math.PI / 180;
    let filter = 'none';

    // IN Animation
    if (localTime < el.start + el.inDur) {
      let t = applyEase(progressIn, el.animInEase || 'easeOut');
      
      if (el.animIn === 'fadeScale') { elAlpha = t; scale *= t; }
      else if (el.animIn === 'fade') { elAlpha = t; }
      else if (el.animIn === 'slideUp' || el.animIn === 'riseUp') { elAlpha = t; dy = (1-t) * 100; }
      else if (el.animIn === 'slideLeft') { elAlpha = t; dx = (1-t) * -200; }
      else if (el.animIn === 'dropIn') { elAlpha = t; dy = (1-t) * -200; }
      else if (el.animIn === 'rotateIn') { elAlpha = t; rot -= (1-t) * Math.PI; scale *= t; }
      else if (el.animIn === 'blur') { elAlpha = t; filter = `blur(${(1-t)*20}px)`; }
    }
    
    // OUT Animation
    const isEndingWithSlide = (el.end >= SLIDE_DURATION - 0.2);
    if (localTime > el.end - el.outDur) {
      if (isTransitioningOut && isEndingWithSlide) {
        // Skip element out-animation, let the slide transition handle it
      } else {
        let t = 1 - applyEase(progressOut, el.animOutEase || 'easeIn');
        if (el.animOut === 'fadeScale') { elAlpha = t; scale *= t; }
        else if (el.animOut === 'fade') { elAlpha = t; }
        else if (el.animOut === 'slideDown') { elAlpha = t; dy = (1-t) * -100; }
        else if (el.animOut === 'slideRight') { elAlpha = t; dx = (1-t) * 200; }
        else if (el.animOut === 'blur') { elAlpha = t; filter = `blur(${(1-t)*20}px)`; }
        else if (el.animOut === 'scale') { elAlpha = t; scale *= t; }
      }
    }

    // LOOP Animation
    const activeTime = localTime - el.start;
    if (el.animLoop === 'float') dy += Math.sin(activeTime * 3 * el.loopSpeed) * 15;
    if (el.animLoop === 'pulse') scale *= 1 + (Math.sin(activeTime * 5 * el.loopSpeed) * 0.05);
    if (el.animLoop === 'wiggle') rot += Math.sin(activeTime * 10 * el.loopSpeed) * 0.1;
    if (el.animLoop === 'jitter') {
      dx += (Math.random() - 0.5) * 6 * el.loopSpeed;
      dy += (Math.random() - 0.5) * 6 * el.loopSpeed;
    }

    // Transform
    ctxToDraw.globalAlpha = Math.max(0, Math.min(1, elAlpha)) * opacity;
    ctxToDraw.translate(el.x + dx, el.y + dy);
    ctxToDraw.rotate(rot);
    ctxToDraw.scale(scale, scale);
    ctxToDraw.filter = filter;

    // Shadows
    if (el.shadowOffsetX !== 0 || el.shadowOffsetY !== 0 || el.shadowBlur !== 0) {
      ctxToDraw.shadowColor = (el.shadowColor && el.shadowColor !== 'transparent') ? el.shadowColor : '#000000';
      ctxToDraw.shadowBlur = el.shadowBlur;
      ctxToDraw.shadowOffsetX = el.shadowOffsetX;
      ctxToDraw.shadowOffsetY = el.shadowOffsetY;
    }

    ctxToDraw.fillStyle = el.fill;
    ctxToDraw.strokeStyle = el.stroke;
    ctxToDraw.lineWidth = el.strokeWidth || 0;

    // Draw Shape/Text
    if (el.type === 'text' && el.text) {
      ctxToDraw.font = `${el.fontWeight || '700'} ${el.size}px ${el.font}`;
      if ('letterSpacing' in ctxToDraw) {
        (ctxToDraw as any).letterSpacing = `${el.letterSpacing || 0}px`;
      }
      ctxToDraw.textAlign = 'center';
      ctxToDraw.textBaseline = 'middle';
      
      const isWordAnimIn = (localTime < el.start + el.inDur) && (el.animIn === 'fadeInWord' || el.animIn === 'bounceInWord');
      
      if (isWordAnimIn) {
        // Word-by-word staggering animation
        const words = el.text.split(' ');
        let totalWidth = 0;
        const wordWidths = words.map(w => {
          const wd = ctxToDraw.measureText(w + ' ').width;
          totalWidth += wd;
          return wd;
        });
        
        let currentX = -totalWidth / 2;
        words.forEach((w, i) => {
          const wStart = i / words.length;
          const wEnd = (i + 1) / words.length;
          let wProg = (progressIn - wStart) / (wEnd - wStart);
          wProg = Math.max(0, Math.min(1, wProg));
          
          let wAlpha = 1;
          let wScale = 1;
          
          if (el.animIn === 'fadeInWord') {
            wAlpha = applyEase(wProg, el.animInEase || 'easeOut');
          } else if (el.animIn === 'bounceInWord') {
            wAlpha = Math.min(1, wProg * 2); 
            wScale = applyEase(wProg, el.animInEase || 'bounce');
          }
          
          ctxToDraw.save();
          ctxToDraw.translate(currentX + wordWidths[i]/2, 0); 
          ctxToDraw.scale(wScale, wScale);
          ctxToDraw.globalAlpha = ctxToDraw.globalAlpha * wAlpha;
          ctxToDraw.fillText(w, 0, 0);
          if (el.strokeWidth > 0) ctxToDraw.strokeText(w, 0, 0);
          ctxToDraw.restore();
          
          currentX += wordWidths[i];
        });
      } else {
        // Standard Rendering & Typewriter Effects
        let displayText = el.text;
        if (localTime < el.start + el.inDur && (el.animIn === 'typewriter' || el.animIn === 'typewriterPlus')) {
          let chars = Math.floor(progressIn * el.text.length);
          displayText = el.text.substring(0, chars);
          if (el.animIn === 'typewriterPlus' && progressIn < 1) {
            displayText += '|';
          }
        }
        ctxToDraw.fillText(displayText, 0, 0);
        if (el.strokeWidth > 0) ctxToDraw.strokeText(displayText, 0, 0);
      }
    } 
    else if (el.type === 'rect') {
      const w = el.size * 1.5; const h = el.size;
      ctxToDraw.fillRect(-w/2, -h/2, w, h);
      if (el.strokeWidth > 0) ctxToDraw.strokeRect(-w/2, -h/2, w, h);
    } 
    else if (el.type === 'circle') {
      ctxToDraw.beginPath();
      ctxToDraw.arc(0, 0, el.size/2, 0, Math.PI * 2);
      ctxToDraw.fill();
      if (el.strokeWidth > 0) ctxToDraw.stroke();
    }

    // Reset filter for bounding box
    ctxToDraw.filter = 'none';

    // Selection Bounding Box
    if (drawUI && !isPlaying && opacity === 1 && offsetX === 0 && activeElementId === el.id) {
      drawBoundingBox(ctxToDraw, el);
    }
    
    ctxToDraw.restore(); 
  });

  ctxToDraw.restore(); 
}

export function renderFrame(
  ctxToDraw: CanvasRenderingContext2D, 
  time: number, 
  width: number, 
  height: number, 
  slides: KineticSlide[],
  transparentBg = false, 
  drawUI = true,
  isPlaying = false,
  activeElementId: string | null = null
) {
  if (transparentBg) {
    ctxToDraw.clearRect(0, 0, width, height);
  } else {
    // We shouldn't draw a global background here, as slide backgrounds handle it,
    // but in dark mode/light mode a base might be nice. 
    // We'll clear the rect so it's clean before drawing slide background
    ctxToDraw.clearRect(0, 0, width, height);
  }

  if (!slides || slides.length === 0) return;

  const currentIdx = Math.floor(time / SLIDE_DURATION) % Math.max(1, slides.length);
  const localTime = time % SLIDE_DURATION;
  const slide = slides[currentIdx];

  if (!slide) return;

  const transDur = slide.transDuration || 0.5;
  const isTransitioningOut = (localTime > SLIDE_DURATION - transDur) && (currentIdx < slides.length - 1);

  if (isTransitioningOut && isPlaying) {
    // Transition Math
    let t = (localTime - (SLIDE_DURATION - transDur)) / transDur;
    t = Math.max(0, Math.min(1, t)); // 0 to 1
    
    const nextSlide = slides[currentIdx + 1];
    
    // Freeze the next slide at a tiny fraction > 0 so it's ready, but doesn't cause a backwards time jump
    const nextLocalTime = 0.01; 

    if (slide.transition === 'slideLeft') {
      drawSlide(ctxToDraw, slide, localTime, width, height, -width * t, 1, true, transparentBg, drawUI, isPlaying, activeElementId);
      // overlap slightly by 1px to prevent any white/black lines
      if (nextSlide) drawSlide(ctxToDraw, nextSlide, nextLocalTime, width, height, (width * (1-t)) - 1, 1, false, transparentBg, drawUI, isPlaying, activeElementId);
    } 
    else if (slide.transition === 'slideUp') {
      drawSlide(ctxToDraw, slide, localTime, width, height, 0, 1 - t, true, transparentBg, drawUI, isPlaying, activeElementId); // fade current while up
      ctxToDraw.save(); ctxToDraw.translate(0, height * (1-t) - 1);
      if (nextSlide) drawSlide(ctxToDraw, nextSlide, nextLocalTime, width, height, 0, 1, false, transparentBg, drawUI, isPlaying, activeElementId);
      ctxToDraw.restore();
    }
    else if (slide.transition === 'fade') {
      drawSlide(ctxToDraw, slide, localTime, width, height, 0, 1 - t, true, transparentBg, drawUI, isPlaying, activeElementId);
      if (nextSlide) drawSlide(ctxToDraw, nextSlide, nextLocalTime, width, height, 0, t, false, transparentBg, drawUI, isPlaying, activeElementId);
    }
    else {
      // None (Cut)
      drawSlide(ctxToDraw, slide, localTime, width, height, 0, 1, true, transparentBg, drawUI, isPlaying, activeElementId);
    }
  } else {
    // Normal Drawing
    drawSlide(ctxToDraw, slide, localTime, width, height, 0, 1, false, transparentBg, drawUI, isPlaying, activeElementId);
  }
}
