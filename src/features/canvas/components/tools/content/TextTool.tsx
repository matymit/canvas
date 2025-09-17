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

function createTextarea(screenX: number, screenY: number, fontSize: number, color: string, fontFamily: string): HTMLTextAreaElement {
  const ta = document.createElement('textarea');
  ta.setAttribute('data-testid', 'text-portal-input');
  ta.style.position = 'absolute';
  ta.style.left = `${screenX}px`;
  ta.style.top = `${screenY}px`;
  ta.style.minWidth = '20px';
  ta.style.width = '20px';
  ta.style.height = `${Math.round(fontSize * 1.2)}px`;
  ta.style.padding = '2px 4px';
  ta.style.border = '1px dashed rgba(0, 0, 255, 0.5)';
  ta.style.borderRadius = '2px';
  ta.style.outline = 'none';
  ta.style.resize = 'none';
  ta.style.cursor = 'text';
  ta.style.background = 'rgba(255, 255, 255, 0.95)';
  ta.style.color = color;
  ta.style.fontFamily = fontFamily;
  ta.style.fontSize = `${fontSize}px`;
  ta.style.lineHeight = '1.2';
  ta.style.zIndex = '1000';
  ta.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  ta.style.pointerEvents = 'auto';
  ta.style.whiteSpace = 'nowrap';
  ta.style.overflow = 'hidden';
  ta.style.boxSizing = 'border-box';
  return ta;
}

export const TextTool: React.FC<TextToolProps> = ({ isActive, stageRef, toolId = 'text' }) => {
  // Store subscriptions
  const selectedTool = useUnifiedCanvasStore((state) => state.selectedTool);
  const fillColor = useUnifiedCanvasStore((state) => state.fillColor);
  const setSelectedTool = useUnifiedCanvasStore((state) => state.setSelectedTool);
  const addElement = useUnifiedCanvasStore((state) => state.addElement);
  const withUndo = useUnifiedCanvasStore((state) => state.withUndo);

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

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((stage: Konva.Stage, screenX: number, screenY: number) => {
    const stagePos = stage.position();
    const stageScale = stage.scaleX();
    
    const worldX = (screenX - stagePos.x) / stageScale;
    const worldY = (screenY - stagePos.y) / stageScale;
    
    return { x: worldX, y: worldY };
  }, []);

  // Commit text function
  const commitText = useCallback((textarea: HTMLTextAreaElement, worldPosition: { x: number; y: number }, cancel = false) => {
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
      const width = Math.max(10, Math.ceil(m.width + 8)); // Add padding
      const height = Math.round(fontSize * 1.2);

      const textElement = {
        id: crypto.randomUUID(),
        type: 'text' as const,
        x: worldPosition.x,
        y: worldPosition.y,
        width,
        height,
        text: value,
        style: { 
          fill: fillColor, 
          fontFamily, 
          fontSize,
          fontStyle: 'normal',
          fontWeight: 'normal',
          textDecoration: '',
        },
        bounds: { 
          x: worldPosition.x, 
          y: worldPosition.y, 
          width, 
          height 
        },
      };

      const commitFn = () => {
        console.log('[TextTool] Creating text element at world coords:', { worldPosition, element: textElement });
        // Use pushHistory option to ensure history tracking
        addElement(textElement, { pushHistory: true, select: true });
        console.log('[TextTool] Text element created successfully');
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
        toolId,
        target: e.target.constructor.name
      });
      
      // Only handle clicks on the stage itself, not on existing elements
      if (!active || activeEditorRef.current || selectedTool !== toolId || e.target !== stage) {
        return;
      }

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) {
        console.warn('[TextTool] No pointer position available');
        return;
      }

      console.log('[TextTool] Creating text editor at screen pos:', pointerPos);

      // Convert to world coordinates for the final element
      const worldPos = screenToWorld(stage, pointerPos.x, pointerPos.y);
      console.log('[TextTool] World position:', worldPos);

      // Get screen position for the DOM editor
      const containerRect = stage.container().getBoundingClientRect();
      const screenX = containerRect.left + pointerPos.x;
      const screenY = containerRect.top + pointerPos.y;

      const ta = createTextarea(screenX, screenY, fontSize, fillColor, fontFamily);
      document.body.appendChild(ta); // Use body to avoid container transform issues
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
        const text = ta.value || 'W'; // Use 'W' as minimum for sizing
        const m = measureText({ text, fontFamily, fontSize });
        const newWidth = Math.max(20, Math.ceil(m.width + 8));
        ta.style.width = `${newWidth}px`;
        ta.style.height = `${Math.round(fontSize * 1.2)}px`;
      };

      updateSize();
      ta.addEventListener('input', updateSize);

      const commit = (cancel = false) => {
        ta.removeEventListener('input', updateSize);
        commitText(ta, worldPos, cancel);
      };

      const handleKeyDown = (ke: KeyboardEvent) => {
        ke.stopPropagation(); // Prevent canvas shortcuts
        
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
        setTimeout(() => commit(false), 50);
      };

      ta.addEventListener('keydown', handleKeyDown);
      ta.addEventListener('blur', handleBlur, { once: true });

      // Prevent the click from bubbling up
      e.evt.stopPropagation();
      e.cancelBubble = true;
    };

    console.log('[TextTool] Adding stage click listener');
    stage.on('click.texttool', onStageClick);

    return () => {
      console.log('[TextTool] Cleaning up stage listener and active editor');
      stage.off('click.texttool');
      cleanup();
    };
  }, [isActive, selectedTool, toolId, stageRef, fillColor, fontSize, fontFamily, commitText, cleanup, screenToWorld]);

  return null;
};

export default TextTool;