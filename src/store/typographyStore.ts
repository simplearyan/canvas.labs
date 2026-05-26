import { createStore } from 'solid-js/store';
import type { TypographyState, TypographyElement } from '../engines/typography-studio/types';
import { TYPOGRAPHY_PRESETS } from '../engines/typography-studio/presets';
import LZString from 'lz-string';

const defaultPreset = TYPOGRAPHY_PRESETS['sam-hogan-drop'];

// Initial default state
const initialState: TypographyState = {
  width: defaultPreset.width,
  height: defaultPreset.height,
  bgColor: defaultPreset.bgColor,
  time: 0,
  isPlaying: false,
  duration: defaultPreset.duration || 5.0,
  elements: JSON.parse(JSON.stringify(defaultPreset.elements)),
  selectedId: null,
};

export const [typographyStore, setTypographyStore] = createStore<TypographyState>(initialState);

// --- URL State Serialization / Deserialization ---

export function serializeTypographyState(): string {
  const jsonString = JSON.stringify(typographyStore);
  return LZString.compressToEncodedURIComponent(jsonString);
}

export function loadTypographyStateFromUrl(encodedState: string): boolean {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(encodedState);
    if (!jsonString) return false;
    
    const parsedState = JSON.parse(jsonString) as TypographyState;
    setTypographyStore(parsedState);
    return true;
  } catch (err) {
    console.error("Failed to parse state from URL:", err);
    return false;
  }
}

// Action Helpers
export function updateTypographyGlobal(updates: Partial<Pick<TypographyState, 'width' | 'height' | 'bgColor' | 'duration' | 'selectedId' | 'isPlaying' | 'time'>>) {
  setTypographyStore(updates);
}

export function updateTypographyElement(id: string, updates: Partial<TypographyElement>) {
  setTypographyStore(
    'elements',
    (el) => el.id === id,
    (el) => ({ ...el, ...updates })
  );
}

export function addTypographyElement(element: TypographyElement) {
  setTypographyStore('elements', (elements) => [...elements, element]);
  setTypographyStore('selectedId', element.id);
}

export function removeTypographyElement(id: string) {
  setTypographyStore('elements', (elements) => elements.filter((el) => el.id !== id));
  if (typographyStore.selectedId === id) {
    setTypographyStore('selectedId', null);
  }
}

export function moveTypographyElement(id: string, direction: -1 | 1) {
  const index = typographyStore.elements.findIndex(el => el.id === id);
  if (index === -1) return;
  
  if (direction === -1 && index > 0) {
    setTypographyStore('elements', (elements) => {
      const newElements = [...elements];
      [newElements[index - 1], newElements[index]] = [newElements[index], newElements[index - 1]];
      return newElements;
    });
  } else if (direction === 1 && index < typographyStore.elements.length - 1) {
    setTypographyStore('elements', (elements) => {
      const newElements = [...elements];
      [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
      return newElements;
    });
  }
}
