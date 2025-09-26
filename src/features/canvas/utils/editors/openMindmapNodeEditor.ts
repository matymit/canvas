import type Konva from "konva";
import { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import type { MindmapNodeElement } from "@/features/canvas/types/mindmap";
import {
  MINDMAP_CONFIG,
  measureMindmapLabelWithWrap,
} from "@/features/canvas/types/mindmap";

type Nullable<T> = T | null | undefined;

function toScreenPoint(stage: Konva.Stage, x: number, y: number) {
  const transform = stage.getAbsoluteTransform();
  return transform.point({ x, y });
}

export function openMindmapNodeEditor(
  stage: Konva.Stage,
  nodeId: string,
  nodeModel: MindmapNodeElement,
) {
  const container = stage.container();
  const rect = container.getBoundingClientRect();

  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;

  // Position the editor to overlay the entire node, not just the text area
  const nodeOrigin = toScreenPoint(stage, nodeModel.x, nodeModel.y);

  // Maximum width for text wrapping (leaving some padding)
  const maxTextWidth =
    Math.max(MINDMAP_CONFIG.defaultNodeWidth, nodeModel.width) -
    nodeModel.style.paddingX * 2;

  // Track current dimensions
  let currentWidth = nodeModel.width;
  let currentHeight = nodeModel.height;

  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.textContent = nodeModel.text ?? "";

  // Function to update editor dimensions
  const updateEditorDimensions = (width: number, height: number) => {
    currentWidth = width;
    currentHeight = height;
    editor.style.width = `${width * scaleX}px`;
    editor.style.height = `${height * scaleY}px`;

    // Update vertical alignment based on content height
    const contentHeight = height - nodeModel.style.paddingY * 2;
    if (contentHeight < nodeModel.style.fontSize * 2) {
      // Single line - center vertically
      editor.style.alignItems = "center";
    } else {
      // Multiple lines - align to top
      editor.style.alignItems = "flex-start";
    }
  };

  Object.assign(editor.style, {
    position: "absolute",
    left: `${rect.left + nodeOrigin.x}px`,
    top: `${rect.top + nodeOrigin.y}px`,
    // Initial dimensions
    width: `${nodeModel.width * scaleX}px`,
    height: `${nodeModel.height * scaleY}px`,
    // Use the same padding as the node for text positioning
    padding: `${nodeModel.style.paddingY * scaleY}px ${nodeModel.style.paddingX * scaleX}px`,
    // Match the node's visual properties exactly
    borderRadius: `${nodeModel.style.cornerRadius * Math.min(scaleX, scaleY)}px`,
    background: nodeModel.style.fill,
    // Add the node's border to maintain visual consistency
    border:
      nodeModel.style.strokeWidth > 0
        ? `${nodeModel.style.strokeWidth}px solid ${nodeModel.style.stroke}`
        : "none",
    // Match text properties
    color: nodeModel.style.textColor,
    fontFamily: nodeModel.style.fontFamily,
    fontSize: `${nodeModel.style.fontSize * scaleY}px`,
    fontWeight: nodeModel.style.fontStyle?.includes("bold") ? "600" : "500",
    lineHeight: `${MINDMAP_CONFIG.lineHeight}`,
    // Flexbox for alignment
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    // Text behavior - enable wrapping
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    wordWrap: "break-word",
    overflowWrap: "break-word",
    resize: "none",
    outline: "none",
    overflow: "hidden",
    // Ensure it's above other elements but no shadow to avoid disconnected look
    zIndex: "1000",
    boxShadow: "none",
    // Box sizing to include padding and border in dimensions
    boxSizing: "border-box",
    // Subtle focus indicator that doesn't break the illusion
    transition: "box-shadow 0.15s ease, height 0.15s ease",
  } as CSSStyleDeclaration);

  document.body.appendChild(editor);

  // Removed focus glow - blue border was unwanted
  // editor.addEventListener("focus", () => {
  //   editor.style.boxShadow = `0 0 0 2px ${nodeModel.style.stroke || "rgba(59, 130, 246, 0.25)"}`;
  // });

  // Real-time resize handler
  const handleInput = () => {
    const text = editor.textContent || "";

    // Calculate wrapped text dimensions
    const metrics = measureMindmapLabelWithWrap(
      text,
      nodeModel.style,
      maxTextWidth,
      MINDMAP_CONFIG.lineHeight,
    );

    // Calculate new dimensions
    const newWidth = Math.max(
      metrics.width + nodeModel.style.paddingX * 2,
      MINDMAP_CONFIG.minNodeWidth,
    );
    const newHeight = Math.max(
      metrics.height + nodeModel.style.paddingY * 2,
      MINDMAP_CONFIG.minNodeHeight,
    );

    // Update editor dimensions if changed
    if (newHeight !== currentHeight || newWidth !== currentWidth) {
      updateEditorDimensions(newWidth, newHeight);

      // Also update the node in the store (without history)
      const store = useUnifiedCanvasStore.getState();
      const update: Nullable<
        (
          id: string,
          patch: Partial<MindmapNodeElement>,
          opts?: { pushHistory?: boolean },
        ) => void
      > = store.updateElement ?? store.element?.update;

      if (update) {
        update(
          nodeId,
          {
            width: newWidth,
            height: newHeight,
            textWidth: metrics.width,
            textHeight: metrics.height,
          },
          { pushHistory: false },
        );

        // Force immediate transformer refresh by directly accessing the selection module
        requestAnimationFrame(() => {
          // Force a draw on the main layer to ensure visual update is complete
          const mainLayer = stage.findOne(".main-layer") as Konva.Layer | null;
          if (mainLayer && typeof mainLayer.batchDraw === "function") {
            mainLayer.batchDraw();
          }

          // Directly refresh the transformer for immediate sync
          const selectionModule = (
            window as unknown as {
              selectionModule?: { forceRefresh?: () => void };
            }
          ).selectionModule;
          if (
            selectionModule &&
            typeof selectionModule.forceRefresh === "function"
          ) {
            selectionModule.forceRefresh();
          } else {
            // Fallback to bumping selection version if direct refresh not available
            const bumpVersion = (
              store as unknown as { bumpSelectionVersion?: () => void }
            ).bumpSelectionVersion;
            if (typeof bumpVersion === "function") {
              bumpVersion();
            }
          }
        });
      }
    }
  };

  // Add input listener for real-time resizing
  editor.addEventListener("input", handleInput);

  // Focus the editor and position cursor at the end without selecting text
  // CRITICAL FIX: Use multiple strategies to ensure reliable focus and caret positioning
  editor.focus();

  // Ensure the editor is visible and properly positioned before caret positioning
  editor.style.display = "flex";
  editor.style.visibility = "visible";

  // Move cursor to the end of the text with improved reliability
  setTimeout(() => {
    const range = document.createRange();
    const selection = window.getSelection();

    // Clear any existing selections first
    selection?.removeAllRanges();

    if (editor.textContent && editor.textContent.length > 0) {
      // If there's text content, position cursor at the end
      range.selectNodeContents(editor);
      range.collapse(false); // Collapse to end
    } else {
      // If empty, just position at the beginning
      range.selectNodeContents(editor);
      range.collapse(true); // Collapse to start
    }

    selection?.removeAllRanges();
    selection?.addRange(range);

    // Ensure the editor is focused and caret is visible
    editor.focus();
  }, 0);

  const cleanup = () => {
    editor.removeEventListener("keydown", handleKeyDown);
    editor.removeEventListener("keypress", handleKeyPress);
    editor.removeEventListener("keyup", handleKeyUp);
    editor.removeEventListener("input", handleInput);
    editor.removeEventListener("blur", handleBlur);
    editor.parentElement?.removeChild(editor);
  };

  const commit = (cancel: boolean) => {
    const value = editor.textContent?.trim() ?? "";
    cleanup();
    if (cancel) return;

    const store = useUnifiedCanvasStore.getState();
    const update: Nullable<
      (
        id: string,
        patch: Partial<MindmapNodeElement>,
        opts?: { pushHistory?: boolean },
      ) => void
    > = store.updateElement ?? store.element?.update;

    if (update) {
      const nextText = value || nodeModel.text;

      // Use wrapped text measurement for final dimensions
      const metrics = measureMindmapLabelWithWrap(
        nextText,
        nodeModel.style,
        maxTextWidth,
        MINDMAP_CONFIG.lineHeight,
      );

      const width = Math.max(
        metrics.width + nodeModel.style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      );
      const height = Math.max(
        metrics.height + nodeModel.style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      );

      update(
        nodeId,
        {
          text: nextText,
          width,
          height,
          textWidth: metrics.width,
          textHeight: metrics.height,
        },
        { pushHistory: true },
      );

      // Bump selection version to refresh transformer bounds after commit
      const bumpVersion = (
        store as unknown as { bumpSelectionVersion?: () => void }
      ).bumpSelectionVersion;
      if (typeof bumpVersion === "function") {
        bumpVersion();
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Always stop propagation to prevent toolbar shortcuts from firing
    event.stopPropagation();

    // Handle special keys
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit(false);
    } else if (event.key === "Escape") {
      event.preventDefault();
      commit(true);
    }
    // For all other keys, just let them type normally in the editor
    // but prevent the event from bubbling up
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    // Stop propagation for all keypress events
    event.stopPropagation();
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    // Stop propagation for all keyup events
    event.stopPropagation();
  };

  const handleBlur = () => commit(false);

  editor.addEventListener("keydown", handleKeyDown);
  editor.addEventListener("keypress", handleKeyPress);
  editor.addEventListener("keyup", handleKeyUp);
  editor.addEventListener("blur", handleBlur, { once: true });
}
