// features/canvas/hooks/useSmartGuidesIntegration.ts
import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { SmartGuides, type GuideLine } from '../components/SmartGuides';
import { useUnifiedCanvasStore } from '../stores/unifiedCanvasStore';

export interface UseSmartGuidesIntegrationParams {
  overlayLayer: Konva.Layer | null;
}

/**
 * Hook to integrate SmartGuides component with the guides module state
 */
export function useSmartGuidesIntegration({ overlayLayer }: UseSmartGuidesIntegrationParams) {
  const { guidesEnabled, activeGuides } = useUnifiedCanvasStore();
  const smartGuidesRef = useRef<SmartGuides | null>(null);

  // Initialize SmartGuides when overlay layer is available
  useEffect(() => {
    if (!overlayLayer) return;

    const smartGuides = new SmartGuides(overlayLayer, {
      color: '#3B82F6',
      strokeWidth: 1,
      dash: [4, 4],
      showLabels: true,
    });

    smartGuidesRef.current = smartGuides;

    return () => {
      smartGuides.destroy();
      smartGuidesRef.current = null;
    };
  }, [overlayLayer]);

  // Sync guides state with SmartGuides component
  useEffect(() => {
    const smartGuides = smartGuidesRef.current;
    if (!smartGuides) return;

    if (guidesEnabled && activeGuides.length > 0) {
      // Convert store guide format to SmartGuides format
      const convertedGuides: GuideLine[] = activeGuides.map(guide => {
        if (guide.axis === 'x') {
          return {
            type: 'v',
            x: guide.value,
            y1: -10000,
            y2: 10000,
            label: guide.source ? `${guide.source}` : undefined,
          };
        } else {
          return {
            type: 'h',
            y: guide.value,
            x1: -10000,
            x2: 10000,
            label: guide.source ? `${guide.source}` : undefined,
          };
        }
      });

      smartGuides.show(convertedGuides);
    } else {
      smartGuides.clear();
    }
  }, [guidesEnabled, activeGuides]);

  return smartGuidesRef.current;
}

export default useSmartGuidesIntegration;