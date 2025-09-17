import React from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { openStandaloneTextEditor } from "../../../utils/editors/openStandaloneTextEditor";
import type { CanvasTool } from "../../../managers/ToolManager";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

// Canvas tool implementation for direct Konva event handling
export class TextCanvasTool implements CanvasTool {
  name = 'text';
  private stage?: Konva.Stage;
  private layer?: Konva.Layer;
  private handlers: Array<{ evt: string; fn: (e: any) => void }> = [];

  attach(stage: Konva.Stage, layer: Konva.Layer) {
    console.log("[TextCanvasTool] Attaching to stage and layer");
    this.stage = stage;
    this.layer = layer;

    const onStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      console.log("[TextCanvasTool] Stage click intercepted", { target: e.target });

      // Prevent event propagation to stop Canvas component's handleStageClick from firing
      e.evt.stopPropagation();
      e.evt.preventDefault();

      const target = e.target;
      // Skip if clicking on existing text element
      if (target && (target as any).className === 'Text') return;
      // Skip if clicking on the stage background (not main layer)
      if (target === stage) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Convert screen coordinates to world coordinates
      const worldX = (pos.x - stage.x()) / stage.scaleX();
      const worldY = (pos.y - stage.y()) / stage.scaleY();

      // Get current UI state from store
      const currentStore = useUnifiedCanvasStore.getState();
      const fillColor = currentStore.fillColor ?? currentStore.ui?.fillColor ?? '#111827';
      const fontSize = 18;
      const fontFamily = 'Inter, system-ui, sans-serif';

      openStandaloneTextEditor({
        stage,
        worldX,
        worldY,
        fontFamily,
        fontSize,
        color: fillColor,
        onCommit: (text, finalWorldX, finalWorldY) => {
          // Create text element
          const textElement = {
            id: crypto.randomUUID(),
            type: 'text' as const,
            x: finalWorldX,
            y: finalWorldY,
            width: Math.max(50, text.length * fontSize * 0.6), // Estimate width
            height: fontSize * 1.2,
            text,
            style: {
              fill: fillColor,
              fontFamily,
              fontSize
            },
            bounds: {
              x: finalWorldX,
              y: finalWorldY,
              width: Math.max(50, text.length * fontSize * 0.6),
              height: fontSize * 1.2
            }
          };

          // Add to store with undo support
          const upsertElement = currentStore.element?.upsert;
          const withUndo = currentStore.withUndo;
          const setSelectedTool = currentStore.setSelectedTool;

          const commitFn = () => {
            upsertElement?.(textElement);
          };

          if (withUndo) {
            withUndo('Add text', commitFn);
          } else {
            commitFn();
          }

          // Switch back to select tool
          setSelectedTool?.('select');
        }
      });
    };

    const onTextDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      const target = e.target as Konva.Text;
      if (!target || (target as any).className !== 'Text') return;
      if (!stage || !layer) return;

      // Get the element ID and edit existing text
      const elementId = target.getAttr('elementId') || target.id();
      if (elementId) {
        // For existing text editing, we would implement shape text editor
        // This is a placeholder for future implementation
        console.log('Double-click on existing text element:', elementId);
      }
    };

    const onTextDblTap = (e: Konva.KonvaEventObject<TouchEvent>) => onTextDblClick(e as any);

    // Bind events to stage
    stage.on('click', onStageClick);
    stage.on('dblclick', onTextDblClick);
    stage.on('dbltap', onTextDblTap);

    this.handlers.push({ evt: 'click', fn: onStageClick });
    this.handlers.push({ evt: 'dblclick', fn: onTextDblClick });
    this.handlers.push({ evt: 'dbltap', fn: onTextDblTap });
  }

  detach() {
    console.log("[TextCanvasTool] Detaching from stage");
    if (!this.stage) return;
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
  // We keep it for backward compatibility but it doesn't bind any events

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
