import type { KineticSlide, KineticState } from './types';
import LZString from 'lz-string';

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export const defaultKineticState: KineticState = {
  slides: [
    {
      id: generateId(),
      bg: '#18181b', // Default zinc-900 (used if no theme base is preferred, or transparent)
      transition: 'slideLeft',
      transDuration: 0.6,
      elements: [
        {
          id: generateId(), type: 'circle',
          x: 400, y: 250, size: 220, rotation: 0,
          fill: '#10b981', stroke: '#000000', strokeWidth: 0,
          shadowColor: '#000000', shadowBlur: 30, shadowOffsetX: 0, shadowOffsetY: 10,
          animIn: 'fadeScale', animInEase: 'easeOut', inDur: 0.6,
          animLoop: 'float', loopSpeed: 1.0, 
          animOut: 'fadeScale', animOutEase: 'easeIn', outDur: 0.4,
          start: 0.2, end: 5
        },
        {
          id: generateId(), type: 'text',
          text: 'STUDIO', font: "'Space Grotesk'", fontWeight: '700', letterSpacing: 0, size: 120,
          x: 450, y: 250, rotation: 0,
          fill: '#ffffff', stroke: '#000000', strokeWidth: 0,
          shadowColor: '#000000', shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 10,
          animIn: 'typewriterPlus', animInEase: 'linear', inDur: 1.0,
          animLoop: 'none', loopSpeed: 1.0, 
          animOut: 'slideDown', animOutEase: 'easeIn', outDur: 0.4,
          start: 0.5, end: 5 
        }
      ]
    },
    {
      id: generateId(),
      bg: '#0f172a',
      transition: 'fade',
      transDuration: 0.5,
      elements: [
        {
          id: generateId(), type: 'text',
          text: 'PRO', font: "'Plus Jakarta Sans'", fontWeight: '800', letterSpacing: 10, size: 160,
          x: 450, y: 250, rotation: 0,
          fill: '#60a5fa', stroke: '#000000', strokeWidth: 0,
          shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, 
          animIn: 'bounceInWord', animInEase: 'bounce', inDur: 1.0,
          animLoop: 'pulse', loopSpeed: 0.5, 
          animOut: 'blur', animOutEase: 'easeOut', outDur: 0.5,
          start: 0, end: 4.8
        }
      ]
    }
  ]
};

/**
 * Serializes state to compressed base64 URL safe string
 */
export function serializeKineticState(state: KineticState): string {
  const jsonStr = JSON.stringify(state);
  return LZString.compressToEncodedURIComponent(jsonStr);
}

/**
 * Deserializes state from compressed base64 URL safe string
 */
export function deserializeKineticState(encodedData: string | null): KineticState {
  if (!encodedData) return defaultKineticState;
  try {
    const jsonStr = LZString.decompressFromEncodedURIComponent(encodedData);
    if (!jsonStr) return defaultKineticState;
    return JSON.parse(jsonStr) as KineticState;
  } catch (err) {
    console.error('Failed to parse KineticState from URL:', err);
    return defaultKineticState;
  }
}
