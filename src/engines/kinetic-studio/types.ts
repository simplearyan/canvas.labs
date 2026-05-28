export type KineticElementType = 'text' | 'rect' | 'circle';

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounce';

export type AnimInEffect = 
  | 'none' | 'fadeScale' | 'fade' | 'slideLeft' | 'slideUp' | 'riseUp' 
  | 'typewriter' | 'typewriterPlus' | 'fadeInWord' | 'bounceInWord' | 'blur' 
  | 'dropIn' | 'rotateIn' | 'scale';

export type AnimOutEffect = 
  | 'none' | 'fadeScale' | 'fade' | 'slideDown' | 'slideRight' | 'blur' | 'scale';

export type AnimLoopEffect = 'none' | 'float' | 'pulse' | 'wiggle' | 'jitter';

export interface KineticElement {
  id: string;
  type: KineticElementType;
  x: number;
  y: number;
  size: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  
  // Animation configs
  animIn: AnimInEffect;
  animInEase: EasingType;
  inDur: number;
  animLoop: AnimLoopEffect;
  loopSpeed: number;
  animOut: AnimOutEffect;
  animOutEase: EasingType;
  outDur: number;
  
  // Visibility window in slide's local time (seconds)
  start: number;
  end: number;
  
  // Text specific
  text?: string;
  font?: string;
  fontWeight?: string;
  letterSpacing?: number;
}

export type SlideTransition = 'none' | 'fade' | 'slideLeft' | 'slideUp';

export interface KineticSlide {
  id: string;
  bg: string; // e.g., '#000000', 'transparent'
  transition: SlideTransition;
  transDuration: number;
  elements: KineticElement[];
}

export interface KineticState {
  slides: KineticSlide[];
}
