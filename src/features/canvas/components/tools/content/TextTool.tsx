import React from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { measureText } from "../../../utils/text/TextMeasurement";
import type { CanvasTool } from "../../../managers/ToolManager";
import type { CanvasElement, ElementId } from "../../../../../../types/index";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

function createTextarea(screenX: number, screenY: number, fontSize: number, fontFamily: string): HTMLTextAreaElement {
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
  ta.style.color = '#111827'; // Always use dark color for visibility during editing
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

// Canvas tool implementation for direct Konva event handling
export class TextCanvasTool implements CanvasTool {
  name = 'text';
  private stage?: Konva.Stage;
  private layer?: Konva.Layer;
  private handlers: Array<{ evt: string; fn: (e: any) => void }> = [];
  private activeEditor?: HTMLTextAreaElement;

  attach(stage: Konva.Stage, layer: Konva.Layer) {
    console.log("[TextCanvasTool] Attaching to stage and layer");
    this.stage = stage;
    this.layer = layer;

    const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      console.log("[TextCanvasTool] Stage click intercepted", { target: e.target });

      const target = e.target;

      // Debug logging for all conditions
      console.log("[TextCanvasTool] Debug - target:", target);
      console.log("[TextCanvasTool] Debug - target.className:", (target as any).className);
      console.log("[TextCanvasTool] Debug - target === stage:", target === stage);
      console.log("[TextCanvasTool] Debug - activeEditor:", !!this.activeEditor);

      // Skip if clicking on existing text element
      if (target && (target as any).className === 'Text') {
        console.log("[TextCanvasTool] Returning early: clicked on existing Text element");
        return;
      }

      // Skip if clicking on non-text canvas elements (but allow stage clicks for new text creation)
      if (target !== stage && target && (target as any).className && (target as any).className !== 'Text') {
        console.log("[TextCanvasTool] Returning early: clicked on non-text element with className:", (target as any).className);
        return;
      }

      // Skip if there's already an active editor
      if (this.activeEditor) {
        console.log("[TextCanvasTool] Returning early: activeEditor already exists");
        return;
      }

      const pointerPos = stage.getPointerPosition();
      console.log("[TextCanvasTool] Debug - pointerPos:", pointerPos);
      if (!pointerPos) {
        console.warn('[TextCanvasTool] Returning early: No pointer position available');
        return;
      }

      console.log('[TextCanvasTool] Creating text editor at screen pos:', pointerPos);

      // Convert to world coordinates for the final element
      const stagePos = stage.position();
      const stageScale = stage.scaleX();
      const worldX = (pointerPos.x - stagePos.x) / stageScale;
      const worldY = (pointerPos.y - stagePos.y) / stageScale;
      const worldPos = { x: worldX, y: worldY };

      console.log('[TextCanvasTool] World position:', worldPos);

      // Get current UI state from store
      const currentStore = useUnifiedCanvasStore.getState();
      const fillColor = currentStore.fillColor ?? '#111827';
      const fontSize = 18;
      const fontFamily = 'Inter, system-ui, sans-serif';

      // Get screen position for the DOM editor
      const containerRect = stage.container().getBoundingClientRect();
      const screenX = containerRect.left + pointerPos.x;
      const screenY = containerRect.top + pointerPos.y;

      const ta = createTextarea(screenX, screenY, fontSize, fontFamily);
      document.body.appendChild(ta);
      this.activeEditor = ta;

      // Auto-resize function using measureText
      const updateSize = () => {
        const text = ta.value || 'W';
        const m = measureText({ text, fontFamily, fontSize });
        const newWidth = Math.max(20, Math.ceil(m.width + 8));
        ta.style.width = `${newWidth}px`;
        ta.style.height = `${Math.round(fontSize * 1.2)}px`;
      };

      updateSize();
      ta.addEventListener('input', updateSize);

      // Commit function
      const commitText = (cancel = false) => {
        const value = (ta.value || '').trim();

        ta.removeEventListener('input', updateSize);
        try {
          ta.remove();
        } catch (error) {
          console.warn('[TextCanvasTool] Error removing textarea:', error);
        }
        this.activeEditor = undefined;

        if (!cancel && value.length > 0) {
          const m = measureText({ text: value, fontFamily, fontSize });
          const width = Math.max(10, Math.ceil(m.width + 8));
          const height = Math.round(fontSize * 1.2);

          const elementId = crypto.randomUUID() as ElementId;
          const textElement: CanvasElement = {
            id: elementId,
            type: 'text' as const,
            x: worldPos.x,
            y: worldPos.y,
            width,
            height,
            text: value,
            style: {
              fill: fillColor,
              fontFamily,
              fontSize
            }
          };

          console.log('[TextCanvasTool] Creating text element:', textElement);

          console.log('[TextCanvasTool] Creating text element:', textElement);

          // Use withUndo for proper history tracking and the new Phase 2 pattern
          if (currentStore.withUndo) {
            currentStore.withUndo('Add text', () => {
              currentStore.addElement(textElement, { select: true, pushHistory: false }); // withUndo handles history
            });
          } else {
            // Fallback if withUndo not available
            currentStore.addElement(textElement, { select: true });
          }

          console.log('[TextCanvasTool] Text element added to store');
        }

        // Switch back to select tool
        currentStore.setSelectedTool?.('select');
      };

      // Event handlers
      const handleKeyDown = (ke: KeyboardEvent) => {
        ke.stopPropagation();

        if (ke.key === 'Enter' && !ke.shiftKey) {
          ke.preventDefault();
          commitText(false);
        } else if (ke.key === 'Escape') {
          ke.preventDefault();
          commitText(true);
        }
      };

      const handleBlur = () => {
        setTimeout(() => commitText(false), 50);
      };

      ta.addEventListener('keydown', handleKeyDown);
      ta.addEventListener('blur', handleBlur, { once: true });

      // Focus with slight delay
      setTimeout(() => {
        try {
          ta.focus();
        } catch (error) {
          console.warn('[TextCanvasTool] Error focusing textarea:', error);
        }
      }, 10);
    };

    const onTextDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const target = e.target as Konva.Text;
      if (!target || (target as any).className !== 'Text') return;
      if (!stage || !layer) return;

      // Get the element ID and edit existing text
      const elementId = target.getAttr('elementId') || target.id();
      if (elementId) {
        console.log('Double-click on existing text element:', elementId);
        // TODO: Implement existing text editing
        // Note: This should be handled by TextRenderer's dblclick handler
      }
    };

    const onTextDblTap = (e: Konva.KonvaEventObject<TouchEvent>) => onTextDblClick(e as any);

    // Bind events to stage with namespacing to avoid conflicts
    // Use capture phase (true) to ensure we intercept before Canvas component
    stage.on('click.text-tool', onStageClick);
    stage.on('dblclick.text-tool', onTextDblClick);
    stage.on('dbltap.text-tool', onTextDblTap);

    this.handlers.push({ evt: 'click.text-tool', fn: onStageClick });
    this.handlers.push({ evt: 'dblclick.text-tool', fn: onTextDblClick });
    this.handlers.push({ evt: 'dbltap.text-tool', fn: onTextDblTap });
  }

  detach() {
    console.log("[TextCanvasTool] Detaching from stage");

    // Clean up any active editor
    if (this.activeEditor) {
      try {
        this.activeEditor.remove();
      } catch (error) {
        console.warn('[TextCanvasTool] Error removing active editor:', error);
      }
      this.activeEditor = undefined;
    }

    if (!this.stage) return;

    // Remove our event handlers
    for (const { evt, fn } of this.handlers) {
      this.stage.off(evt, fn);
    }
    this.handlers = [];

    this.stage = undefined;
    if (this.layer) {
      this.layer = undefined;
    }
  }
}

// Legacy React component - kept for backward compatibility but inactive when canvas tool is used
export const TextTool: React.FC<TextToolProps> = ({
  isActive,
  stageRef,
  toolId = "text",
}) => {
  // This React component is now inactive - the canvas tool handles all interactions
  // Log when the component is rendered for debugging
  React.useEffect(() => {
    console.log("[TextTool] React component rendered (inactive):", {
      isActive,
      toolId,
      hasStage: !!stageRef.current,
    });
  }, [isActive, toolId, stageRef]);

  return null;
};

export default TextTool;