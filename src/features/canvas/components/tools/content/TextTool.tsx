import React from "react";
import type Konva from "konva";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";
import { measureText } from "../../../utils/text/TextMeasurement";
import type { CanvasTool } from "../../../managers/ToolManager";
import type { CanvasElement, ElementId } from "../../../../../../types/index";
import {
  applyVendorAppearanceReset,
  applyVendorTextFillColor,
} from "../../../utils/text/vendorStyles";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface TextToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string; // default: 'text'
}

const DEFAULT_TEXT_COLOR = "#111827";

function createTextarea(
  screenX: number,
  screenY: number,
  fontSize: number,
  fontFamily: string,
): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.setAttribute("data-testid", "text-portal-input");
  ta.style.position = "absolute";
  ta.style.left = `${screenX}px`;
  ta.style.top = `${screenY}px`;
  ta.style.minWidth = "20px";
  ta.style.width = "20px";
  ta.style.height = `${Math.round(fontSize * 1.2)}px`;
  ta.style.padding = "2px 4px";
  // CRITICAL FIX: Use clean styling pattern from openShapeTextEditor.ts
  ta.style.border = "none !important";
  ta.style.outline = "none !important";
  ta.style.borderStyle = "none !important";
  ta.style.borderWidth = "0 !important";
  ta.style.borderColor = "transparent !important";
  ta.style.outlineStyle = "none !important";
  ta.style.outlineWidth = "0 !important";
  ta.style.outlineColor = "transparent !important";
  ta.style.borderRadius = "2px";
  ta.style.resize = "none";
  ta.style.cursor = "text";
  ta.style.background = "rgba(255, 255, 255, 0.95)";
  ta.style.color = DEFAULT_TEXT_COLOR; // Keep DOM editor text consistent with committed fill
  ta.style.fontFamily = fontFamily;
  ta.style.fontSize = `${fontSize}px`;
  ta.style.lineHeight = "1.2";
  ta.style.zIndex = "1000";
  ta.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
  ta.style.pointerEvents = "auto";
  ta.style.whiteSpace = "nowrap";
  ta.style.overflow = "hidden";
  ta.style.boxSizing = "border-box";
  // Enhanced caret visibility and browser compatibility
  ta.style.caretColor = DEFAULT_TEXT_COLOR;
  applyVendorTextFillColor(ta.style, DEFAULT_TEXT_COLOR);
  applyVendorAppearanceReset(ta.style);
  ta.style.appearance = "none";
  return ta;
}

// Canvas tool implementation for direct Konva event handling
export class TextCanvasTool implements CanvasTool {
  name = "text";
  private stage?: Konva.Stage;
  private layer?: Konva.Layer;
  private handlers: Array<{ evt: string; fn: (e: Konva.KonvaEventObject<Event>) => void }> = [];
  private activeEditor?: HTMLTextAreaElement;

  attach(stage: Konva.Stage, layer: Konva.Layer) {
    this.stage = stage;
    this.layer = layer;

    const onStageClick = (e: Konva.KonvaEventObject<Event>) => {
      const target = e.target;

      // Skip if clicking on existing text element
      if (target && (target as Konva.Text).className === "Text") {
        return;
      }

      // Skip if clicking on non-text canvas elements (but allow stage clicks for new text creation)
      if (
        target !== stage &&
        target &&
        (target as Konva.Text).className &&
        (target as Konva.Text).className !== "Text"
      ) {
        return;
      }

      // Skip if there's already an active editor
      if (this.activeEditor) {
        return;
      }

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) {
        return;
      }

      // Convert to world coordinates for the final element
      const stagePos = stage.position();
      const stageScale = stage.scaleX();
      const worldX = (pointerPos.x - stagePos.x) / stageScale;
      const worldY = (pointerPos.y - stagePos.y) / stageScale;
      const worldPos = { x: worldX, y: worldY };

      // Get current UI state from store
      const currentStore = useUnifiedCanvasStore.getState();
      const fillColor = DEFAULT_TEXT_COLOR;
      const fontSize = 18;
      const fontFamily = "Inter, system-ui, sans-serif";

      // Get screen position for the DOM editor
      const containerRect = stage.container().getBoundingClientRect();
      const screenX = containerRect.left + pointerPos.x;
      const screenY = containerRect.top + pointerPos.y;

      const ta = createTextarea(screenX, screenY, fontSize, fontFamily);
      document.body.appendChild(ta);
      this.activeEditor = ta;

      // Auto-resize function using measureText
      const updateSize = () => {
        const text = ta.value || "W";
        const m = measureText({ text, fontFamily, fontSize });
        const newWidth = Math.max(20, Math.ceil(m.width + 8));
        ta.style.width = `${newWidth}px`;
        ta.style.height = `${Math.round(fontSize * 1.2)}px`;
      };

      updateSize();
      ta.addEventListener("input", updateSize);

      // Commit function
      const commitText = (cancel = false) => {
        const value = (ta.value || "").trim();

        ta.removeEventListener("input", updateSize);
        try {
          ta.remove();
        } catch (error) {
          // Silently handle removal errors
        }
        this.activeEditor = undefined;

        if (!cancel && value.length > 0) {
          const m = measureText({ text: value, fontFamily, fontSize });
          const width = Math.max(10, Math.ceil(m.width + 8));
          const height = Math.round(fontSize * 1.2);

          const elementId = crypto.randomUUID() as ElementId;
          const textElement: CanvasElement = {
            id: elementId,
            type: "text" as const,
            x: worldPos.x,
            y: worldPos.y,
            width,
            height,
            text: value,
            style: {
              fill: fillColor,
              fontFamily,
              fontSize,
            },
          };

          // Use withUndo for proper history tracking and the new Phase 2 pattern
          try {
            if (currentStore.withUndo) {
              currentStore.withUndo("Add text", () => {
                currentStore.addElement(textElement, {
                  select: true,
                  pushHistory: false,
                }); // withUndo handles history
              });
            } else {
              // Fallback if withUndo not available
              currentStore.addElement(textElement, { select: true });
            }

            // Double-check that element was added to store
            setTimeout(() => {
              const storeState = useUnifiedCanvasStore.getState();
              const addedElement = storeState.elements.get(elementId);
              if (!addedElement) {
                // Text element NOT found in store after addition
              }
            }, 100);
          } catch (error) {
            // Error adding text element to store
          }
        }

        // Switch back to select tool
        currentStore.ui?.setSelectedTool?.("select");
      };

      // Event handlers
      const handleKeyDown = (ke: KeyboardEvent) => {
        ke.stopPropagation();

        if (ke.key === "Enter" && !ke.shiftKey) {
          ke.preventDefault();
          commitText(false);
        } else if (ke.key === "Escape") {
          ke.preventDefault();
          commitText(true);
        }
      };

      const handleBlur = () => {
        setTimeout(() => commitText(false), 50);
      };

      ta.addEventListener("keydown", handleKeyDown);
      ta.addEventListener("blur", handleBlur, { once: true });

      // Focus with slight delay
      setTimeout(() => {
        try {
          ta.focus();
        } catch (error) {
          // Error focusing textarea
        }
      }, 10);
    };

    const onTextDblClick = (e: Konva.KonvaEventObject<Event>) => {
      const target = e.target as Konva.Text;
      if (!target || (target as Konva.Text).className !== "Text") return;
      if (!stage || !layer) return;

      // Get the element ID and edit existing text
      const elementId = target.getAttr("elementId") || target.id();
      if (elementId) {
        // TODO: Implement existing text editing
        // Note: This should be handled by TextRenderer's dblclick handler
      }
    };

    const onTextDblTap = (e: Konva.KonvaEventObject<Event>) =>
      onTextDblClick(e);

    // Bind events to stage with namespacing to avoid conflicts
    // Use capture phase (true) to ensure we intercept before Canvas component
    stage.on("click.text-tool", onStageClick);
    stage.on("dblclick.text-tool", onTextDblClick);
    stage.on("dbltap.text-tool", onTextDblTap);

    this.handlers.push({ evt: "click.text-tool", fn: onStageClick });
    this.handlers.push({ evt: "dblclick.text-tool", fn: onTextDblClick });
    this.handlers.push({ evt: "dbltap.text-tool", fn: onTextDblTap });
  }

  detach() {
    // Clean up any active editor
    if (this.activeEditor) {
      try {
        this.activeEditor.remove();
      } catch (error) {
        // Silently handle removal errors
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
    // Component is inactive - canvas tool handles all interactions
  }, [isActive, toolId, stageRef]);

  return null;
};

export default TextTool;
