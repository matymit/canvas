// Simple clipboard management for canvas elements
import type { CanvasElement } from "../../../../types";

// Simple in-memory clipboard - in a real app this might be more sophisticated
let clipboardElements: CanvasElement[] = [];

export const clipboard = {
  // Copy elements to clipboard
  copy: (elements: CanvasElement[]): void => {
    clipboardElements = elements.map(el => ({ ...el })); // Deep clone
  },

  // Get elements from clipboard
  paste: (): CanvasElement[] => {
    return clipboardElements.map(el => ({ ...el })); // Deep clone
  },

  // Check if clipboard has elements
  hasContent: (): boolean => {
    return clipboardElements.length > 0;
  },

  // Clear clipboard
  clear: (): void => {
    clipboardElements = [];
  },

  // Get clipboard length
  length: (): number => {
    return clipboardElements.length;
  }
};

export default clipboard;