// features/canvas/components/tools/creation/StickyNoteTool.tsx
import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

export interface StickyNoteToolProps {
  isActive: boolean;
  stageRef: React.RefObject<Konva.Stage | null>;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
}

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;
const DEFAULT_FILL = '#FFF59D'; // light yellow
const DEFAULT_TEXT = '';
const DEFAULT_FONT_SIZE = 16;

// Get reference to StickyNoteModule for direct text editing trigger
function getStickyNoteModule(): any {
  return (window as any).stickyNoteModule;
}

const StickyNoteTool: React.FC<StickyNoteToolProps> = ({
  isActive,
  stageRef,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  fill,
  text = DEFAULT_TEXT,
  fontSize = DEFAULT_FONT_SIZE,
}) => {
  // Get the selected sticky note color from the store
  const selectedStickyNoteColor = useUnifiedCanvasStore((s: any) => 
    s.stickyNoteColor || s.ui?.stickyNoteColor || s.colors?.stickyNote || DEFAULT_FILL
  );
  const actualFill = fill ?? selectedStickyNoteColor;
  
  // Store methods with proper fallbacks
  const createElement = useUnifiedCanvasStore((s: any) => 
    s.element?.upsert || s.addElement || s.elements?.create
  );
  const setSelectedTool = useUnifiedCanvasStore((s: any) => 
    s.setSelectedTool || s.ui?.setSelectedTool
  );
  const setSelection = useUnifiedCanvasStore((s: any) => 
    s.selection?.set || s.setSelection
  );
  const withUndo = useUnifiedCanvasStore((s: any) => 
    s.withUndo || s.history?.withUndo
  );

  // Tool activation effect
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    console.log('[StickyNoteTool] Activating with color:', actualFill);

    const handlePointerDown = (e?: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Create sticky note element using proper store method
      const stickyElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky-note' as const,
        x: pos.x - width / 2,
        y: pos.y - height / 2,
        width,
        height,
        text: text, // Start with empty text for immediate editing
        style: {
          fill: actualFill,
          fontSize,
          fontFamily: 'Inter, sans-serif',
          textColor: '#333333',
          padding: 12,
        },
        data: {
          text: text,
        }
      };
      
      console.log('[StickyNoteTool] Creating element:', stickyElement);
      
      // Create element in store with history
      if (createElement) {
        if (withUndo) {
          withUndo('Add sticky note', () => {
            createElement(stickyElement);
          });
        } else {
          createElement(stickyElement);
        }
      } else {
        console.error('[StickyNoteTool] No createElement method available!');
        return;
      }

      // FIXED: Immediate auto-selection for resize frame
      if (setSelection) {
        setTimeout(() => {
          console.log('[StickyNoteTool] Auto-selecting element:', stickyElement.id);
          setSelection([stickyElement.id]);
        }, 50); // Quick selection first
      }

      // FIXED: Immediate text editing with proper timing
      setTimeout(() => {
        const stickyModule = getStickyNoteModule();
        if (stickyModule?.triggerImmediateTextEdit) {
          console.log('[StickyNoteTool] Triggering immediate text edit for:', stickyElement.id);
          stickyModule.triggerImmediateTextEdit(stickyElement.id);
        }
      }, 100); // Allow renderer to create element first

      // FIXED: Switch to select tool after both selection and text editing are initiated
      setTimeout(() => {
        if (setSelectedTool) {
          setSelectedTool('select');
        }
      }, 150);

      if (e) e.cancelBubble = true;
    };

    // Attach to stage pointer events
    stage.on('pointerdown.sticky', handlePointerDown);

    // Cleanup
    return () => {
      stage.off('pointerdown.sticky');
    };
  }, [isActive, stageRef, width, height, actualFill, text, fontSize, createElement, setSelectedTool, setSelection, withUndo]);

  return null;
};

export default StickyNoteTool;