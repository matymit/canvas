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
    s.setSelection
  );
  const withUndo = useUnifiedCanvasStore((s: any) => 
    s.withUndo || s.history?.withUndo
  );

  const activeEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const suppressOpenRef = useRef<boolean>(false);
  const justOpenedRef = useRef<boolean>(false);

  // Close editor if tool deactivates
  useEffect(() => {
    if (isActive) return;
    const ta = activeEditorRef.current;
    if (!ta) return;
    try { 
      ta.style.display = 'none'; 
      ta.remove(); 
    } catch {}
    activeEditorRef.current = null;
  }, [isActive]);

  // Tool activation effect
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    console.log('[StickyNoteTool] Activating with color:', actualFill);

    const createTextarea = (pageX: number, pageY: number, elementId: string) => {
      // Close any existing editor first
      const existing = activeEditorRef.current;
      if (existing) {
        try { 
          existing.style.display = 'none';
          existing.remove(); 
        } catch {}
        activeEditorRef.current = null;
      }

      const ta = document.createElement('textarea');
      justOpenedRef.current = true;
      ta.setAttribute('data-testid', 'sticky-note-input');
      ta.style.cssText = `
        position: absolute;
        left: ${pageX}px;
        top: ${pageY}px;
        width: ${width}px;
        height: ${height}px;
        padding: 12px;
        border: 2px solid #007acc;
        border-radius: 6px;
        background: #fffbea;
        z-index: 1000;
        font-family: Inter, sans-serif;
        font-size: 16px;
        resize: none;
        outline: none;
      `;
      ta.value = text;
      document.body.appendChild(ta);
      activeEditorRef.current = ta;
      ta.focus();
      
      // Allow current event cycle to finish
      setTimeout(() => { justOpenedRef.current = false; }, 0);

      const commit = () => {
        const newText = ta.value.trim();
        
        // Update element in store
        if (newText) {
          const updateElement = useUnifiedCanvasStore.getState().element?.update;
          if (updateElement) {
            updateElement(elementId, { text: newText });
          }
        }
        
        // Clean up editor
        try {
          ta.style.display = 'none';
          ta.remove();
        } catch {}
        if (activeEditorRef.current === ta) activeEditorRef.current = null;
      };

      // Event handlers
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
          e.preventDefault(); 
          commit(); 
        }
        if (e.key === 'Escape') { 
          e.preventDefault(); 
          commit(); 
        }
      });
      ta.addEventListener('blur', commit, { once: true });
      
      return ta;
    };

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
        text: text,
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

      // Auto-select the created element for immediate transform handles
      if (setSelection) {
        // Small delay to ensure element is rendered first
        setTimeout(() => {
          console.log('[StickyNoteTool] Auto-selecting element:', stickyElement.id);
          setSelection([stickyElement.id]);
        }, 50);
      }

      // Open text editor immediately
      try {
        const container = stage.container();
        const rect = container.getBoundingClientRect();
        const ta = createTextarea(
          rect.left + pos.x - width / 2, 
          rect.top + pos.y - height / 2,
          stickyElement.id
        );
      } catch (error) {
        console.warn('[StickyNoteTool] Failed to create text editor:', error);
      }

      // Auto-switch back to select tool after short delay (allow for text input)
      setTimeout(() => {
        if (setSelectedTool) {
          setSelectedTool('select');
        }
      }, 100);

      if (e) e.cancelBubble = true;
    };

    // Attach to stage pointer events
    stage.on('pointerdown.sticky', handlePointerDown);

    // Container click handler for fallback
    const container = stage.container();
    const onContainerPointerDown = (evt: PointerEvent) => {
      if (!isActive) return;
      if (suppressOpenRef.current) return;
      if (evt.defaultPrevented) return;
      if (activeEditorRef.current) return;
      
      // Convert client coordinates to stage coordinates
      const rect = container.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      
      // Create mock event for handlePointerDown
      stage.setPointersPositions(evt);
      handlePointerDown();
      
      evt.stopPropagation();
    };
    
    container?.addEventListener('pointerdown', onContainerPointerDown, { capture: true });

    // Cleanup
    return () => {
      stage.off('pointerdown.sticky');
      try { 
        container?.removeEventListener('pointerdown', onContainerPointerDown, { capture: true } as any); 
      } catch {}
    };
  }, [isActive, stageRef, width, height, actualFill, text, fontSize, createElement, setSelectedTool, setSelection, withUndo]);

  // Global cleanup for editor
  useEffect(() => {
    const onDocumentPointerDown = (evt: PointerEvent) => {
      const ta = activeEditorRef.current;
      if (!ta) return;
      if (justOpenedRef.current) return;
      if (ta.contains(evt.target as Node)) return;
      
      // Click outside editor - commit changes
      try {
        ta.style.display = 'none';
        ta.remove();
      } catch {}
      activeEditorRef.current = null;
      suppressOpenRef.current = true;
      setTimeout(() => { suppressOpenRef.current = false; }, 0);
    };

    document.addEventListener('pointerdown', onDocumentPointerDown, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, { capture: true } as any);
    };
  }, []);

  return null;
};

export default StickyNoteTool;