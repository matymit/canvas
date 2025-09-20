import Konva from "konva";
import { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import type { MindmapNodeElement } from "@/features/canvas/types/mindmap";
import { MINDMAP_CONFIG, measureMindmapLabel } from "@/features/canvas/types/mindmap";

type Nullable<T> = T | null | undefined;

function toScreenPoint(stage: Konva.Stage, x: number, y: number) {
  const transform = stage.getAbsoluteTransform();
  return transform.point({ x, y });
}

export function openMindmapNodeEditor(
  stage: Konva.Stage,
  nodeId: string,
  nodeModel: MindmapNodeElement
) {
  const container = stage.container();
  const rect = container.getBoundingClientRect();

  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;

  const textOrigin = toScreenPoint(
    stage,
    nodeModel.x + nodeModel.style.paddingX,
    nodeModel.y + nodeModel.style.paddingY
  );

  const editor = document.createElement("div");
  editor.contentEditable = "true";
  editor.textContent = nodeModel.text ?? "";

  Object.assign(editor.style, {
    position: "absolute",
    left: `${rect.left + textOrigin.x}px`,
    top: `${rect.top + textOrigin.y}px`,
    width: `${Math.max(120, nodeModel.width - nodeModel.style.paddingX * 2) * scaleX}px`,
    minHeight: `${Math.max(28, nodeModel.height - nodeModel.style.paddingY * 2) * scaleY}px`,
    padding: `${nodeModel.style.paddingY * scaleY}px ${nodeModel.style.paddingX * scaleX}px`,
    border: "1px solid rgba(59, 130, 246, 0.45)",
    borderRadius: `${nodeModel.style.cornerRadius * ((scaleX + scaleY) / 2)}px`,
    background: nodeModel.style.fill,
    color: nodeModel.style.textColor,
    fontFamily: nodeModel.style.fontFamily,
    fontSize: `${nodeModel.style.fontSize * scaleY}px`,
    fontWeight: nodeModel.style.fontStyle?.includes("bold") ? "600" : "500",
    lineHeight: `${MINDMAP_CONFIG.lineHeight}`,
    resize: "none",
    outline: "none",
    zIndex: "1000",
    boxShadow: "0 6px 18px rgba(15, 23, 42, 0.12)",
    display: "block",
    textAlign: "center",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } as CSSStyleDeclaration);

  document.body.appendChild(editor);

  const range = document.createRange();
  range.selectNodeContents(editor);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.focus();

  const cleanup = () => {
    editor.removeEventListener("keydown", handleKeyDown);
    editor.removeEventListener("blur", handleBlur);
    editor.parentElement?.removeChild(editor);
  };

  const commit = (cancel: boolean) => {
    const value = editor.textContent?.trim() ?? "";
    cleanup();
    if (cancel) return;

    const store = useUnifiedCanvasStore.getState();
    const update: Nullable<(id: string, patch: Partial<any>, opts?: { pushHistory?: boolean }) => void> =
      (store.updateElement as any) ?? store.element?.update;

    if (update) {
      const nextText = value || nodeModel.text;
      const metrics = measureMindmapLabel(nextText, nodeModel.style);
      const width = Math.max(metrics.width + nodeModel.style.paddingX * 2, MINDMAP_CONFIG.minNodeWidth);
      const height = Math.max(metrics.height + nodeModel.style.paddingY * 2, MINDMAP_CONFIG.minNodeHeight);

      update(
        nodeId,
        {
          text: nextText,
          width,
          height,
          textWidth: metrics.width,
          textHeight: metrics.height,
        },
        { pushHistory: true }
      );
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit(false);
    } else if (event.key === "Escape") {
      event.preventDefault();
      commit(true);
    }
  };

  const handleBlur = () => commit(false);

  editor.addEventListener("keydown", handleKeyDown);
  editor.addEventListener("blur", handleBlur, { once: true });
}
