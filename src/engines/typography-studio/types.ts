export type TypographyAnimPreset = 'none' | 'stop-motion' | 'pop-up' | 'drop-down' | 'kinetic-drop' | 'throw' | 'sam-hogan';

export interface BaseTypographyElement {
  id: string;
  type: 'text' | 'shape';
  x: number;
  y: number;
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  
  // Cutout FX
  roughness?: number;
  innerShadowColor?: string;
  innerShadowBlur?: number;
  innerShadowX?: number;
  innerShadowY?: number;
  innerShadowOpacity?: number;

  // Drop Shadow
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;

  // Animation
  animPreset?: TypographyAnimPreset;
  animDuration?: number;
  animStagger?: number;
  animShake?: number;
  animMotionBlur?: number;
}

export interface TypographyCharStyle {
  fill?: string;
  s?: number;
  r?: number;
}

export interface TypographyTextElement extends BaseTypographyElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  letterSpacing?: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  charStyles?: TypographyCharStyle[];
}

export interface TypographyShapeElement extends BaseTypographyElement {
  type: 'shape';
  shapeType: 'rect' | 'circle';
  w: number;
  h: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export type TypographyElement = TypographyTextElement | TypographyShapeElement;

export interface TypographyState {
  width: number;
  height: number;
  bgColor: string;
  time: number;
  isPlaying: boolean;
  duration: number;
  elements: TypographyElement[];
  selectedId: string | null;
}

export interface TypographyPreset {
  title: string;
  width: number;
  height: number;
  bgColor: string;
  duration?: number;
  elements: TypographyElement[];
}
