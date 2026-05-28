export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface InteractionHandle {
  name: 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br' | 'rot';
  x: number;
  y: number;
}

export interface TransformUpdate {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  size?: number; // for proportional scaling (like font size)
  rotation?: number;
}
