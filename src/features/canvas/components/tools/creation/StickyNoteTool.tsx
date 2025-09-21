// features/canvas/components/tools/creation/StickyNoteTool.tsx
import React, { useEffect } from "react";
import Konva from "konva";
import { useUnifiedCanvasStore } from "@features/canvas/stores/unifiedCanvasStore";
import type { CanvasElement, ElementId } from "../../../../../../types/index";

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
interface StickyNoteModule {
  triggerImmediateTextEdit?: (elementId: string) => void;
}

function getStickyNoteModule(): StickyNoteModule | undefined {
  return (window as Window & { stickyNoteModule?: StickyNoteModule }).stickyNoteModule;
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
    (s) => s.stickyNoteColor || DEFAULT_FILL,
  );
  const actualFill = fill ?? selectedStickyNoteColor;

  // Tool activation effect
  useEffect(() => {
    const stage = stageRef.current;
    if (!isActive || !stage) return;

    // Tool activated, adding stage listener

    const handlePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Pointer down detected

      const elementId = crypto.randomUUID() as ElementId;

      // Create sticky note element with proper CanvasElement structure
      const stickyElement: CanvasElement = {
        id: elementId,
        type: "sticky-note",
        x: pos.x - width / 2,
        y: pos.y - height / 2,
        width,
        height,
        text: text, // Start with specified text (empty for immediate editing)
        fill: actualFill, // Use fill property for color
        // Also include style for backward compatibility
        style: {
          fill: actualFill,
          fontSize,
          fontFamily: "Inter, sans-serif"
        },
      };

      // Creating sticky note element

      // Use the store's addElement method with auto-selection
      const store = useUnifiedCanvasStore.getState();

      // Use withUndo for proper history tracking
      store.withUndo("Add sticky note", () => {
        store.addElement(stickyElement, { select: true, pushHistory: false }); // withUndo handles history
      });

      // Element added to store

      // Wait for render, then auto-select and trigger text editing
      setTimeout(() => {
        // Attempting auto-text edit

        // Try to trigger text editing via StickyNoteModule
        const stickyModule = getStickyNoteModule();
        if (stickyModule?.triggerImmediateTextEdit) {
          stickyModule.triggerImmediateTextEdit(elementId);
        } else {
          // StickyNoteModule not available for text editing
        }

        // Switch back to select tool
        setTimeout(() => {
          store.setSelectedTool("select");
          // Switched back to select tool
        }, 100);
      }, 150);

      e.cancelBubble = true;
    };

    // Attach to stage pointer events
    stage.on("pointerdown.sticky", handlePointerDown);

    // Cleanup
    return () => {
      // Tool deactivated, removing stage listener
      stage.off("pointerdown.sticky");
    };
  }, [isActive, stageRef, width, height, actualFill, text, fontSize]);

  return null;
};

export default StickyNoteTool;
