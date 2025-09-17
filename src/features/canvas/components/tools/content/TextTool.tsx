import React, { useEffect, useRef, useCallback } from 'react';
import Konva from 'konva';
import { useUnifiedCanvasStore } from '../../../stores/unifiedCanvasStore';
import { measureText } from '../../../utils/text/TextMeasurement';

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

function createTextarea(left: number, top: number, fontSize: number, color: string, fontFamily: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.setAttribute('data-testid', 'text-portal-input');
  ta.style.position = 'absolute';
  ta.style.left = `${left}px`;
  ta.style.top = `${top}px`;
  ta.style.minWidth = '4px';
  ta.style.width = '4px';
  ta.style.height = `${Math.round(fontSize * 1.2)}px`; // fixed single-line height
  ta.style.padding = '0px';
  ta.style.border = '0px';
  ta.style.borderRadius = '0px';
  ta.style.outline = 'none';
  ta.style.resize = 'none'; // no manual resize
  ta.style.cursor = 'text';
  ta.style.background = 'transparent';
  ta.style.color = color;
  ta.style.fontFamily = fontFamily;
  ta.style.fontSize = `${fontSize}px`;
  ta.style.lineHeight = '1.2';
  ta.style.zIndex = '1000';
  ta.style.boxShadow = 'none';
  ta.style.pointerEvents = 'auto';
  ta.style.whiteSpace = 'nowrap';
  ta.style.overflow = 'hidden';
  return ta;
}

export const TextTool: React.FC<TextToolProps> = ({ isActive, stageRef, toolId = 'text' }) => {
  // Store subscriptions with proper fallbacks
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool || 'select');
  const fillColor = useUnifiedCanvasStore((state) => state.fillColor || '#111827');
  
  // Store methods with better error handling
  const setSelectedTool = useUnifiedCanvasStore((state) => state.setSelectedTool);
  const withUndo = useUnifiedCanvasStore((state) => state.withUndo || state.history?.withUndo);
  
  // Element management with fallbacks
  const addElement = useUnifiedCanvasStore((state) => {
    // Try multiple patterns to find the add/upsert method
    return state.addElement || 
           state.element?.upsert || 
           state.elements?.addElement ||
           state.upsertElement ||
           ((el: any) => {
             console.warn('[TextTool] No addElement method found in store');
             return el.id;
           });
  });

  const fontSize = 18;
  const fontFamily = 'Inter, system-ui, sans-serif';
  const activeEditorRef = useRef<HTMLTextAreaElement | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    const existing = activeEditorRef.current;
    if (existing) {
      try {
        existing.remove();
      } catch (error) {
        console.warn('[TextTool] Error removing textarea:', error);
      }
      activeEditorRef.current = null;
    }
  }, []);

  // Commit text function
  const commitText = useCallback((textarea: HTMLTextAreaElement, position: { x: number; y: number }, cancel = false) => {
    const value = (textarea.value || '').trim();
    
    // Remove textarea
    try {
      textarea.remove();
    } catch (error) {
      console.warn('[TextTool] Error removing textarea on commit:', error);
    }
    
    if (activeEditorRef.current === textarea) {
      activeEditorRef.current = null;
    }

    if (!cancel && value.length > 0) {
      const m = measureText({ text: value, fontFamily, fontSize });
      const width = Math.max(1, Math.ceil(m.width));
      const height = Math.round(fontSize * 1.2); // fixed single-line height

      const textElement = {
        id: crypto.randomUUID(),
        type: 'text' as const,
        x: position.x,
        y: position.y,
        width,
        height,
        text: value,
        style: { 
          fill: fillColor, 
          fontFamily, 
          fontSize 
        },
        bounds: { 
          x: position.x, 
          y: position.y, 
          width, 
          height 
        },
      };

      const commitFn = () => {
        try {
          console.log('[TextTool] Creating text element:', textElement);
          const elementId = addElement(textElement);
          console.log('[TextTool] Text element created with ID:', elementId);
        } catch (error) {
          console.error('[TextTool] Error creating text element:', error);
        }
      };

      if (withUndo) {
        try {
          withUndo('Insert text', commitFn);
        } catch (error) {
          console.warn('[TextTool] Error with undo wrapper, executing directly:', error);
          commitFn();
        }
      } else {
        commitFn();
      }
    }

    // Switch back to select tool
    if (setSelectedTool) {
      try {
        setSelectedTool('select');
      } catch (error) {
        console.warn('[TextTool] Error setting select tool:', error);
      }
    }
  }, [fillColor, fontSize, fontFamily, addElement, withUndo, setSelectedTool]);

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && (selectedTool === toolId);
    
    console.log('[TextTool] Effect:', { active, selectedTool, toolId, hasStage: !!stage });
    
    if (!stage || !active) {
      cleanup();
      return;
    }

    const onStageClick = (e: Konva.KonvaEventObject<PointerEvent>) => {
      console.log('[TextTool] Stage click:', { 
        active, 
        hasActiveEditor: !!activeEditorRef.current, 
        selectedTool,
        toolId 
      });
      
      if (!active || activeEditorRef.current || selectedTool !== toolId) {
        return;
      }

      const pos = stage.getPointerPosition();
      if (!pos) {
        console.warn('[TextTool] No pointer position available');
        return;
      }

      console.log('[TextTool] Creating text editor at:', pos);

      const rect = stage.container().getBoundingClientRect();
      const left = rect.left + pos.x;
      const top = rect.top + pos.y;

      const ta = createTextarea(left, top, fontSize, fillColor, fontFamily);
      document.body.appendChild(ta);
      activeEditorRef.current = ta;
      
      // Focus with slight delay to ensure proper attachment
      setTimeout(() => {
        try {
          ta.focus();
        } catch (error) {
          console.warn('[TextTool] Error focusing textarea:', error);
        }
      }, 10);

      const updateSize = () => {
        const text = ta.value || '';
        const m = measureText({ text: text || 'W', fontFamily, fontSize }); // Use 'W' as minimum
        ta.style.width = `${Math.max(4, Math.ceil(m.width))}px`;
        ta.style.height = `${Math.round(fontSize * 1.2)}px`;
      };

      updateSize();
      ta.addEventListener('input', updateSize);

      const commit = (cancel = false) => {
        ta.removeEventListener('input', updateSize);
        commitText(ta, pos, cancel);
      };

      const handleKeyDown = (ke: KeyboardEvent) => {
        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          commit(false);
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          commit(true);
        }
      };

      const handleBlur = () => {
        // Small delay to allow for other events to process
        setTimeout(() => commit(false), 10);
      };

      ta.addEventListener('keydown', handleKeyDown);
      ta.addEventListener('blur', handleBlur, { once: true });

      e.cancelBubble = true;
    };

    console.log('[TextTool] Adding stage click listener');
    stage.on('click.texttool', onStageClick);

    return () => {
      console.log('[TextTool] Cleaning up stage listener and active editor');
      stage.off('click.texttool');
      cleanup();
    };
  }, [isActive, selectedTool, toolId, stageRef, fillColor, fontSize, fontFamily, commitText, cleanup]);

  return null;
};

export default TextTool;