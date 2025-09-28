// features/canvas/components/tools/creation/StickyNoteTool.tsx
import type React from "react";
import { useCallback, useEffect } from "react";
import type Konva from "konva";
import { useUnifiedCanvasStore } from "@features/canvas/stores/unifiedCanvasStore";
import type { CanvasElement, ElementId } from "../../../../../../types/index";
import { debug } from "../../../../../utils/debug";
import { getWorldPointer } from "@features/canvas/utils/pointer";

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
const DEFAULT_FILL = "#FFF59D"; // light yellow
const DEFAULT_TEXT = "";
const DEFAULT_FONT_SIZE = 16;

const MAX_FOCUS_ATTEMPTS = 120;

// Get reference to StickyNoteModule for direct text editing trigger
interface StickyNoteModule {
  triggerImmediateTextEdit?: (elementId: string) => void;
}

type StickyWindow = Window & {
  stickyNoteModule?: StickyNoteModule;
};

function requestStickyNoteEditing(elementId: string, attempts = 40) {
  if (typeof window === "undefined") return;
  const stickyModule = (window as StickyWindow).stickyNoteModule;

  if (stickyModule?.triggerImmediateTextEdit) {
    stickyModule.triggerImmediateTextEdit(elementId);
    return;
  }

  if (attempts <= 0) return;

  window.setTimeout(() => requestStickyNoteEditing(elementId, attempts - 1), 50);
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
  const resolveFill = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    const uiColor = state.ui?.stickyNoteColor;
    const paletteColor = state.colors?.stickyNote;
    return fill ?? uiColor ?? paletteColor ?? DEFAULT_FILL;
  }, [fill]);

  // Tool activation effect
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    // Set cursor when tool is active
    const container = stage.container();
    if (container) {
      container.style.cursor = "crosshair";
    }

    debug("Tool activated, adding stage listener", { category: 'StickyNoteTool' });

    const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const worldPointer = getWorldPointer(stage);
      if (!worldPointer) return;

      debug("Pointer down detected", { category: 'StickyNoteTool', data: worldPointer });

      const elementId = crypto.randomUUID() as ElementId;
      const fillColor = resolveFill();

      // Create sticky note element with proper CanvasElement structure
      const stickyElement: CanvasElement = {
        id: elementId,
        type: "sticky-note",
        x: worldPointer.x - width / 2,
        y: worldPointer.y - height / 2,
        width,
        height,
        keepAspectRatio: true,
        text: text, // Start with specified text (empty for immediate editing)
        fill: fillColor, // Use fill property for color
        // Also include style for backward compatibility
        style: {
          fill: fillColor,
          fontSize,
          fontFamily: "Inter, sans-serif",
          textAlign: "left",
        },
      };

      debug("Creating sticky note element", { category: 'StickyNoteTool', data: {
        elementId,
        fill: fillColor,
        position: { x: stickyElement.x, y: stickyElement.y }
      }});

      // Use the store's addElement method with auto-selection
      const store = useUnifiedCanvasStore.getState();

      // Use withUndo for proper history tracking
      store.withUndo("Add sticky note", () => {
        store.addElement(stickyElement, { select: true, pushHistory: false }); // withUndo handles history
      });

      debug("Element added to store", { category: 'StickyNoteTool' });

      // CRITICAL: Immediate selection and text editing setup
      // Use multiple timing strategies to ensure reliability
      const scheduleTextEditing = () => {
        debug("Scheduling text editing", { category: 'StickyNoteTool', data: elementId });
        
        // Strategy 1: Immediate attempt
        requestStickyNoteEditing(elementId);
        
        // Strategy 2: Next frame
        if (typeof window !== "undefined" && window.requestAnimationFrame) {
          window.requestAnimationFrame(() => {
            requestStickyNoteEditing(elementId);
          });
        }
        
        // Strategy 3: Short delay for reliable DOM updates
        setTimeout(() => {
          requestStickyNoteEditing(elementId);
        }, 16);

        // Strategy 4: Longer delay as fallback
        setTimeout(() => {
          requestStickyNoteEditing(elementId);
        }, 100);
      };

      scheduleTextEditing();

      let finalized = false;

      const finalizeToolSwitch = () => {
        if (finalized) return;
        finalized = true;
        debug("Switching back to select tool", { category: 'StickyNoteTool' });
        if (typeof store.ui?.setSelectedTool === "function") {
          store.ui.setSelectedTool("select");
        }
      };

      const ensureEditorFocused = (attempt: number) => {
        if (finalized) return;
        if (typeof document === "undefined") {
          debug("No document, finalizing", { category: 'StickyNoteTool' });
          finalizeToolSwitch();
          return;
        }

        const editor = document.querySelector<HTMLTextAreaElement>(
          `textarea[data-sticky-editor="${elementId}"]`,
        );

        if (editor) {
          debug("Found editor, focusing", { category: 'StickyNoteTool' });
          if (document.activeElement !== editor) {
            try {
              editor.focus();
              editor.select(); // Select all text for immediate typing
            } catch (error) {
              debug("Focus error, trying fallback", { category: 'StickyNoteTool', data: error });
              // Fallback focusing
              setTimeout(() => {
                try {
                  editor.focus();
                } catch (e) {
                  debug("Fallback focus also failed", { category: 'StickyNoteTool', data: e });
                }
              }, 10);
            }
          }

          try {
            const caretPosition = editor.value.length;
            editor.setSelectionRange(caretPosition, caretPosition);
          } catch {
            // Ignore selection errors
          }

          finalizeToolSwitch();
          return;
        }

        if (attempt >= MAX_FOCUS_ATTEMPTS) {
          debug("Max focus attempts reached, giving up", { category: 'StickyNoteTool' });
          finalizeToolSwitch();
          return;
        }

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => ensureEditorFocused(attempt + 1));
        } else {
          setTimeout(() => ensureEditorFocused(attempt + 1), 16);
        }
      };

      // Start the editor focus process
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => ensureEditorFocused(0));
      } else {
        setTimeout(() => ensureEditorFocused(0), 16);
      }

      e.cancelBubble = true;
    };

    // Attach to stage pointer events
    stage.on("pointerdown.sticky", handlePointerDown);

    // Cleanup
    return () => {
      debug("Tool deactivated, removing stage listener", { category: 'StickyNoteTool' });
      stage.off("pointerdown.sticky");
      
      // Reset cursor
      const container = stage.container();
      if (container) {
        container.style.cursor = "default";
      }
    };
  }, [isActive, stageRef, width, height, text, fontSize, resolveFill]);

  return null;
};

export default StickyNoteTool;
