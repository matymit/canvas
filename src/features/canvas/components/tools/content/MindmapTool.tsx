import type React from "react";
import { useEffect, useRef } from "react";
import Konva from "konva";
import { nanoid } from "nanoid";
import { useUnifiedCanvasStore } from "@/features/canvas/stores/unifiedCanvasStore";
import {
  DEFAULT_BRANCH_STYLE,
  DEFAULT_NODE_STYLE,
  MINDMAP_CONFIG,
  calculateChildPosition,
  createMindmapEdge,
  createMindmapNode,
  measureMindmapLabel,
} from "@/features/canvas/types/mindmap";
import type {
  BranchStyle,
  MindmapEdgeElement,
  MindmapNodeElement,
  MindmapNodeStyle,
} from "@/features/canvas/types/mindmap";
import type { CanvasElement } from "../../../../../../types/index";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface MindmapToolProps {
  isActive: boolean;
  stageRef: StageRef;
  toolId?: string;
}

interface ToolState {
  start: { x: number; y: number } | null;
  preview: Konva.Rect | null;
}

function cloneStyle(style: MindmapNodeStyle): MindmapNodeStyle {
  return { ...style };
}

function cloneBranchStyle(style: BranchStyle): BranchStyle {
  return { ...style };
}

function ensurePreviewLayer(stage: Konva.Stage): Konva.Layer | null {
  const layers = stage.getLayers();
  const previewLayer = layers[3] ?? layers[layers.length - 2];
  return previewLayer ?? null;
}

export const MindmapTool: React.FC<MindmapToolProps> = ({
  isActive,
  stageRef,
  toolId = "mindmap",
}) => {
  const selectedTool = useUnifiedCanvasStore((s): string | undefined => s.ui?.selectedTool) ?? "select";
  const setSelectedTool = useUnifiedCanvasStore(
    (s): ((tool: string) => void) | undefined => s.ui?.setSelectedTool,
  );
  const addElement = useUnifiedCanvasStore(
    (
      s,
    ): ((
      element: CanvasElement,
      opts?: { index?: number; select?: boolean; pushHistory?: boolean },
    ) => void) => s.addElement,
  );
  const replaceSelection = useUnifiedCanvasStore(
    (s): ((ids: string[]) => void) => s.setSelection,
  );
  const getSelectedIds = useUnifiedCanvasStore(
    (s): (() => string[]) => s.getSelectedIds,
  );
  const beginBatch = useUnifiedCanvasStore(
    (s): ((label?: string, mergeKey?: string) => void) => s.beginBatch,
  );
  const endBatch = useUnifiedCanvasStore(
    (s): ((commit?: boolean) => void) => s.endBatch,
  );

  const state = useRef<ToolState>({ start: null, preview: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && selectedTool === toolId;
    if (!stage || !active) return;

    // Capture ref value to avoid stale closure issues in cleanup
    const stateCapture = state.current;

    const previewLayer = ensurePreviewLayer(stage);
    if (!previewLayer) return;

    const handlePointerDown = () => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      state.current.start = { x: pointer.x, y: pointer.y };

      const previewRect = new Konva.Rect({
        x: pointer.x,
        y: pointer.y,
        width: 0,
        height: 0,
        stroke: DEFAULT_NODE_STYLE.stroke,
        strokeWidth: DEFAULT_NODE_STYLE.strokeWidth,
        dash: [4, 4],
        listening: false,
        perfectDrawEnabled: false,
        name: "mindmap-preview",
      });

      state.current.preview = previewRect;
      previewLayer.add(previewRect);
      previewLayer.batchDraw();

      stage.on("pointermove.mindmap", handlePointerMove);
      stage.on("pointerup.mindmap", handlePointerUp);
    };

    const handlePointerMove = () => {
      const { start, preview } = state.current;
      if (!start || !preview) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const x = Math.min(start.x, pointer.x);
      const y = Math.min(start.y, pointer.y);
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);

      preview.position({ x, y });
      preview.size({ width, height });
      previewLayer.batchDraw();
    };

    const commitNode = (
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const { minNodeWidth, minNodeHeight } = MINDMAP_CONFIG;
      const rootId = crypto?.randomUUID?.() ?? nanoid();
      const rootText = "Any question or topic";

      // Create root node
      const baseNode = createMindmapNode(x, y, rootText, {
        parentId: null,
        level: 0,
        style: { fill: "#E5E7EB" }, // Neutral gray for root node
      });
      const node = {
        id: rootId,
        ...baseNode,
        style: cloneStyle(baseNode.style),
      } as MindmapNodeElement;

      const metrics = measureMindmapLabel(node.text, node.style);
      node.textWidth = metrics.width;
      node.textHeight = metrics.height;
      const dragWidth = width >= minNodeWidth ? width : 0;
      const dragHeight = height >= minNodeHeight ? height : 0;
      node.width = Math.max(
        metrics.width + node.style.paddingX * 2,
        dragWidth,
        minNodeWidth,
      );
      node.height = Math.max(
        metrics.height + node.style.paddingY * 2,
        dragHeight,
        minNodeHeight,
      );

      beginBatch?.("create-mindmap", "mindmap:create");

      // Add root node
      addElement?.(node, { pushHistory: true, select: false });

      // Create three child nodes with different texts
      const childTexts = ["A concept", "An idea", "A thought"];
      const childIds: string[] = [];

      childTexts.forEach((childText, index) => {
        const childId = crypto?.randomUUID?.() ?? nanoid();
        childIds.push(childId);

        // Calculate child position with vertical spacing
        const childX = node.x + node.width + 140;
        const childY = node.y + (index - 1) * 56; // Center child, then offset up and down

        const baseChild = createMindmapNode(childX, childY, childText, {
          parentId: rootId,
          level: 1,
          style: {
            fill: "#E5E7EB", // Neutral gray for child nodes
          },
        });

        const child = {
          id: childId,
          ...baseChild,
          style: cloneStyle(baseChild.style),
        } as MindmapNodeElement;

        const childMetrics = measureMindmapLabel(child.text, child.style);
        child.textWidth = childMetrics.width;
        child.textHeight = childMetrics.height;
        child.width = Math.max(
          childMetrics.width + child.style.paddingX * 2,
          minNodeWidth,
        );
        child.height = Math.max(
          childMetrics.height + child.style.paddingY * 2,
          minNodeHeight,
        );

        // Add child node
        addElement?.(child, { pushHistory: true, select: false });

        // Create edge from root to child
        const edgeId = crypto?.randomUUID?.() ?? nanoid();
        const branchColor = "#6B7280"; // Neutral gray for branches
        const edge = {
          id: edgeId,
          ...createMindmapEdge(rootId, childId, {
            ...cloneBranchStyle(DEFAULT_BRANCH_STYLE),
            color: branchColor,
          }),
        } as MindmapEdgeElement;

        addElement?.(edge, { pushHistory: true });
      });

      endBatch?.(true);

      // Select the root node after creating everything
      replaceSelection?.([rootId]);
      // Removed automatic editor opening to prevent duplicate editors
      return rootId;
    };

    const spawnChild = (parentId: string) => {
      const store = useUnifiedCanvasStore.getState();
      const getElement = store.getElement ?? store.element?.getById;
      const parent = getElement?.(parentId) as MindmapNodeElement | undefined;
      if (!parent) return;

      const position = calculateChildPosition(parent);
      const childId = crypto?.randomUUID?.() ?? nanoid();
      const level = (parent.level ?? 0) + 1;
      const baseChild = createMindmapNode(
        position.x,
        position.y,
        MINDMAP_CONFIG.childText,
        {
          parentId,
          level,
          style: {
            fill: "#E5E7EB", // Neutral gray for spawned child nodes
          },
        },
      );
      const child = {
        id: childId,
        ...baseChild,
        style: cloneStyle(baseChild.style),
      } as MindmapNodeElement;

      const childMetrics = measureMindmapLabel(child.text, child.style);
      child.textWidth = childMetrics.width;
      child.textHeight = childMetrics.height;
      child.width = Math.max(
        childMetrics.width + child.style.paddingX * 2,
        MINDMAP_CONFIG.minNodeWidth,
      );
      child.height = Math.max(
        childMetrics.height + child.style.paddingY * 2,
        MINDMAP_CONFIG.minNodeHeight,
      );

      const edgeId = crypto?.randomUUID?.() ?? nanoid();
      const branchColor = "#6B7280"; // Neutral gray for spawned branches
      const edge = {
        id: edgeId,
        ...createMindmapEdge(parentId, childId, {
          ...cloneBranchStyle(DEFAULT_BRANCH_STYLE),
          color: branchColor,
        }),
      } as MindmapEdgeElement;

      beginBatch?.("create-mindmap-child", "mindmap:create");
      addElement?.(child, { pushHistory: true, select: false });
      addElement?.(edge, { pushHistory: true });
      endBatch?.(true);

      // Select the parent node (not the new child)
      replaceSelection?.([parentId]);
      // Removed automatic editor opening to prevent duplicate editors
    };

    const handlePointerUp = () => {
      stage.off("pointermove.mindmap");
      stage.off("pointerup.mindmap");

      const { start, preview } = state.current;
      const pointer = stage.getPointerPosition();
      state.current.start = null;

      if (preview) {
        preview.destroy();
        state.current.preview = null;
        previewLayer.batchDraw();
      }

      if (!start || !pointer) return;

      const x = Math.min(start.x, pointer.x);
      const y = Math.min(start.y, pointer.y);
      const width = Math.abs(pointer.x - start.x);
      const height = Math.abs(pointer.y - start.y);

      commitNode(x, y, width, height);
      setSelectedTool?.("select");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      const ids = getSelectedIds?.() ?? [];
      const activeId = ids[ids.length - 1];
      if (!activeId) return;

      event.preventDefault();
      spawnChild(activeId);
    };

    stage.on("pointerdown.mindmap", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      stage.off("pointerdown.mindmap", handlePointerDown);
      stage.off("pointermove.mindmap", handlePointerMove);
      stage.off("pointerup.mindmap", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);

      if (stateCapture.preview) {
        stateCapture.preview.destroy();
        stateCapture.preview = null;
      }
      stateCapture.start = null;
      previewLayer.batchDraw();
    };
  }, [
    isActive,
    selectedTool,
    stageRef,
    toolId,
    setSelectedTool,
    addElement,
    replaceSelection,
    getSelectedIds,
    beginBatch,
    endBatch,
  ]);

  return null;
};

export default MindmapTool;
