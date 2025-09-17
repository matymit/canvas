// features/canvas/components/ZoomControls.tsx
import React from 'react';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';

export interface ZoomControlsProps {
  // Optional callbacks for external control
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onFit?: () => void;
  // Display options
  zoomLevel?: number;
  className?: string;
  variant?: 'figma' | 'modern'; // Style variant
  showFitButton?: boolean;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  zoomLevel,
  className = '',
  variant = 'modern',
  showFitButton = true,
}) => {
  const viewport = useUnifiedCanvasStore((state) => state.viewport);
  
  // Use store methods if no external handlers provided
  const handleZoomIn = onZoomIn || (() => {
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
    const currentIndex = zoomLevels.findIndex(z => z >= viewport.scale);
    const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
    viewport.setScale(zoomLevels[nextIndex]);
  });
  
  const handleZoomOut = onZoomOut || (() => {
    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];
    const currentIndex = zoomLevels.findIndex(z => z >= viewport.scale);
    const prevIndex = Math.max(currentIndex - 1, 0);
    viewport.setScale(zoomLevels[prevIndex]);
  });
  
  const handleReset = onReset || (() => viewport.reset());
  const handleFit = onFit || (() => viewport.fitToContent(50));
  
  const currentZoom = zoomLevel ?? viewport.scale;
  const zoomPercentage = Math.round(currentZoom * 100);
  
  if (variant === 'figma') {
    return (
      <div className={`zoom-controls flex items-center gap-1 ${className}`}>
        <button
          className="zoom-button p-1 hover:bg-gray-100 rounded"
          onClick={handleZoomOut}
          title="Zoom Out"
          data-testid="zoom-out"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8h10v1H3z"/>
          </svg>
        </button>

        <button
          className="zoom-level px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
          onClick={handleReset}
          title="Reset Zoom"
          data-testid="zoom-reset"
        >
          {zoomPercentage}%
        </button>

        <button
          className="zoom-button p-1 hover:bg-gray-100 rounded"
          onClick={handleZoomIn}
          title="Zoom In"
          data-testid="zoom-in"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3v5H13v1H8v5H7V9H2V8h5V3h1z"/>
          </svg>
        </button>

        {showFitButton && (
          <button
            className="zoom-button p-1 hover:bg-gray-100 rounded"
            onClick={handleFit}
            title="Fit to Screen"
            data-testid="zoom-fit"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h4v1H3v3H2V2zm8 0h4v4h-1V3h-3V2zM2 10h1v3h3v1H2v-4zm11 0h1v4h-4v-1h3v-3z"/>
            </svg>
          </button>
        )}
      </div>
    );
  }
  
  // Modern variant (default)
  const baseButton = 'px-2 py-1 text-sm border border-border/60 bg-panel hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        className={baseButton}
        onClick={handleZoomOut}
        title="Zoom Out (Ctrl+-)"
        aria-label="Zoom out"
        data-testid="zoom-out"
      >
        −
      </button>
      
      <div className="px-2 py-1 text-xs text-text-secondary min-w-[4rem] text-center">
        {zoomPercentage}%
      </div>
      
      <button
        type="button"
        className={baseButton}
        onClick={handleZoomIn}
        title="Zoom In (Ctrl++)"
        aria-label="Zoom in"
        data-testid="zoom-in"
      >
        +
      </button>
      
      <button
        type="button"
        className={`${baseButton} ml-1`}
        onClick={handleReset}
        title="Reset Zoom (Ctrl+0)"
        data-testid="zoom-reset"
      >
        Reset
      </button>
      
      {showFitButton && (
        <button
          type="button"
          className={baseButton}
          onClick={handleFit}
          title="Fit to Content (Ctrl+F)"
          data-testid="zoom-fit"
        >
          Fit
        </button>
      )}
    </div>
  );
};

export default ZoomControls;