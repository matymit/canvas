// features/canvas/components/tools/creation/StickyNoteTool.tsx
import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "@features/canvas/stores/unifiedCanvasStore";

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

// Get reference to StickyNoteModule for direct text editing trigger
function getStickyNoteModule(): any {
  return (window as any).stickyNoteModule;
}

// Get reference to SelectionModule for immediate selection
function getSelectionModule(): any {
  return (window as any).selectionModule;
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
  const selectedStickyNoteColor = useUnifiedCanvasStore(
    (s: any) =>
      s.stickyNoteColor ||
      s.ui?.stickyNoteColor ||
      s.colors?.stickyNote ||
      DEFAULT_FILL,
  );
  const actualFill = fill ?? selectedStickyNoteColor;

  // FIXED: Track creation promises to ensure proper sequencing
  const creationPromiseRef = useRef<Promise<void> | null>(null);

  // Tool activation effect
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    const handlePointerDown = async (
      e?: Konva.KonvaEventObject<PointerEvent>,
    ) => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const elementId = `sticky-${Date.now()}`;

      // Create sticky note element using proper store method
      const stickyElement = {
        id: elementId,
        type: "sticky-note" as const,
        x: pos.x - width / 2,
        y: pos.y - height / 2,
        width,
        height,
        text: text, // Start with empty text for immediate editing
        style: {
          fill: actualFill,
          fontSize,
          fontFamily: "Inter, sans-serif",
          textColor: "#333333",
          padding: 12,
        },
        data: {
          text: text,
        },
      };

      // FIXED: Sequential creation with proper timing and error handling
      try {
        // Create element in store with history
        const createElement =
          useUnifiedCanvasStore.getState().element?.upsert ||
          useUnifiedCanvasStore.getState().addElement;
        const withUndo = (
          useUnifiedCanvasStore.getState() as any
        ).history?.withUndo?.bind(
          (useUnifiedCanvasStore.getState() as any).history,
        );

        if (!createElement) {
          console.error("[StickyNoteTool] No createElement method available!");
          return;
        }

        // Create with history
        const createFn = () => {
          createElement(stickyElement);
        };

        if (withUndo) {
          withUndo("Add sticky note", createFn);
        } else {
          createFn();
        }

        // FIXED: Chain operations with proper timing
        creationPromiseRef.current = new Promise<void>((resolve) => {
          // Step 1: Wait for element to be created and rendered (100ms)
          setTimeout(() => {
            // Step 2: Auto-select using SelectionModule with retry logic
            const selectionModule = getSelectionModule();
            if (selectionModule?.autoSelectElement) {
              selectionModule.autoSelectElement(elementId);
            } else {
              // Fallback selection
              const store = useUnifiedCanvasStore.getState();
              if (store.setSelection) {
                store.setSelection([elementId]);
              } else if (store.selection?.set) {
                store.selection.set([elementId]);
              }
            }

            // Step 3: Wait for selection to complete (50ms)
            setTimeout(() => {
              // Step 4: Trigger immediate text editing
              const stickyModule = getStickyNoteModule();
              if (stickyModule?.triggerImmediateTextEdit) {
                stickyModule.triggerImmediateTextEdit(elementId);
              } else {
                console.warn(
                  "[StickyNoteTool] StickyNoteModule not available for text editing",
                );
              }

              // Step 5: Switch to select tool after text editing starts (50ms)
              setTimeout(() => {
                const setSelectedTool =
                  useUnifiedCanvasStore.getState().setSelectedTool;
                if (setSelectedTool) {
                  setSelectedTool("select");
                }
                resolve();
              }, 50);
            }, 50);
          }, 100);
        });
      } catch (error) {
        console.error("[StickyNoteTool] Failed to create sticky note:", error);
      }

      if (e) e.cancelBubble = true;
    };

    // Attach to stage pointer events
    stage.on("pointerdown.sticky", handlePointerDown);

    // Cleanup
    return () => {
      stage.off("pointerdown.sticky");
      creationPromiseRef.current = null;
    };
  }, [isActive, stageRef, width, height, actualFill, text, fontSize]);

  return null;
};

export default StickyNoteTool;
