/**
 * Canvas events hook
 */
import { useContext } from 'react';
import type { CanvasEventContextValue } from './canvasEventTypes';
import CanvasEventContext from './CanvasEventContext';

export function useCanvasEvents(): CanvasEventContextValue {
  const ctx = useContext(CanvasEventContext);
  if (!ctx) {
    throw new Error('useCanvasEvents must be used within a CanvasEventProvider');
  }
  return ctx;
}