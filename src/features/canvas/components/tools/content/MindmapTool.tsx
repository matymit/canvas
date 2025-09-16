// Mindmap tool with preview/commit, DOM editing, and child spawning
// Follows existing tool patterns with four-layer usage and unified store integration

import React, { useEffect, useRef } from "react";
import Konva from "konva";
import { nanoid } from "nanoid";
import type { 
  MindmapNodeElement, 
  MindmapEdgeElement 
} from "../../../types/elements/mindmap";
import { 
  createMindmapNode, 
  createMindmapEdge, 
  calculateChildPosition,
  getNodeConnectionPoint,
  MINDMAP_CONFIG,
  DEFAULT_NODE_STYLE,
  DEFAULT_BRANCH_STYLE 
} from "../../../types/elements/mindmap";
import { useUnifiedCanvasStore } from "../../../stores/unifiedCanvasStore";

type StageRef = React.RefObject<Konva.Stage | null>;

export interface MindmapToolProps { 
  isActive: boolean; 
  stageRef: StageRef; 
  toolId?: string; 
}

function getNamedOrIndexedLayer(stage: Konva.Stage, name: string, indexFallback: number): Konva.Layer | null {
  // Try by name or id; fallback to index if not named
  const named = stage.findOne<Konva.Layer>(`Layer[name='${name}'], #${name}`);
  if (named && named instanceof Konva.Layer) return named;
  const layers = stage.getLayers();
  return layers[indexFallback] ?? null;
}

export const MindmapTool: React.FC<MindmapToolProps> = ({ 
  isActive, 
  stageRef, 
  toolId = "mindmap" 
}) => {
  const getSelectedTool = useUnifiedCanvasStore(s => s.ui?.selectedTool);
  const setSelectedTool = useUnifiedCanvasStore(s => s.ui?.setSelectedTool);
  const upsertElement = useUnifiedCanvasStore(s => s.element?.upsert);
  const replaceSelection = useUnifiedCanvasStore(s => s.replaceSelectionWithSingle);
  const getSelectedIds = useUnifiedCanvasStore(s => s.getSelectedIds);

  const stateRef = useRef<{ 
    start: { x: number; y: number } | null; 
    preview: Konva.Rect | null;
  }>({ start: null, preview: null });

  useEffect(() => {
    const stage = stageRef.current;
    const active = isActive && getSelectedTool === toolId;
    if (!stage || !active) return;

    const previewLayer = getNamedOrIndexedLayer(stage, 'preview', 2) || 
                        stage.getLayers()[stage.getLayers().length - 2] || 
                        stage.getLayers()[0];
    
    if (!previewLayer) return;

    const onPointerDown = () => {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      stateRef.current.start = { x: pos.x, y: pos.y };

      // Create preview rectangle with dashed border
      const preview = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: DEFAULT_NODE_STYLE.stroke,
        strokeWidth: DEFAULT_NODE_STYLE.strokeWidth,
        dash: [4, 4],
        listening: false,
        perfectDrawEnabled: false,
        name: "mindmap-preview",
      });

      stateRef.current.preview = preview;
      previewLayer.add(preview);
      previewLayer.batchDraw();

      stage.on('pointermove.mindmap', onPointerMove);
      stage.on('pointerup.mindmap', onPointerUp);
    };

    const onPointerMove = () => {
      const start = stateRef.current.start;
      const preview = stateRef.current.preview;
      if (!start || !preview) return;

      const pos = stage.getPointerPosition();
      if (!pos) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      preview.position({ x, y });
      preview.size({ width: w, height: h });
      previewLayer.batchDraw();
    };

    const commitNode = (x: number, y: number, w: number, h: number): string | undefined => {
      const { defaultNodeWidth, defaultNodeHeight, minNodeWidth, minNodeHeight, defaultText } = MINDMAP_CONFIG;
      
      // Use default size for small drags or clicks
      const finalWidth = w < 20 ? defaultNodeWidth : Math.max(minNodeWidth, w);
      const finalHeight = h < 20 ? defaultNodeHeight : Math.max(minNodeHeight, h);

      const nodeData = createMindmapNode(x, y, defaultText);
      const elementData = {
        ...nodeData,
        id: nanoid(),
        width: finalWidth,
        height: finalHeight,
        // Store mindmap-specific data in the data field
        data: {
          text: nodeData.text,
          style: nodeData.style,
          parentId: nodeData.parentId,
        },
        // Convert to CanvasElement format
        bounds: { x, y, width: finalWidth, height: finalHeight },
      } as any;

      const nodeId = upsertElement?.(elementData);
      
      if (nodeId && replaceSelection) {
        replaceSelection(nodeId);
      }
      
      // Open editor for immediate text input
      setTimeout(() => openNodeEditor(stage, nodeId || nanoid(), elementData), 50);
      
      return nodeId;
    };

    const spawnChild = (parentId: string) => {
      const store = useUnifiedCanvasStore.getState();
      const getElement = store.element?.getById;
      const parent = getElement?.(parentId) as MindmapNodeElement | undefined;
      
      if (!parent) return;

      // Calculate child position
      const childPos = calculateChildPosition(parent, 0);
      const childData = createMindmapNode(
        childPos.x, 
        childPos.y, 
        MINDMAP_CONFIG.childText, 
        parentId
      );
      
      const childElementData = {
        ...childData,
        id: nanoid(),
        // Store mindmap-specific data in the data field
        data: {
          text: childData.text,
          style: childData.style,
          parentId: childData.parentId,
        },
        // Convert to CanvasElement format 
        bounds: { 
          x: childPos.x, 
          y: childPos.y, 
          width: childData.width, 
          height: childData.height 
        },
      } as any;

      const childId = upsertElement?.(childElementData);

      // Create connecting edge
      if (childId) {
        const edgeData = createMindmapEdge(parentId, childId);
        const edgeElementData = {
          ...edgeData,
          id: nanoid(),
          // Edges don't have x,y but CanvasElement requires them
          x: 0,
          y: 0,
          // Store edge-specific data in the data field
          data: {
            fromId: edgeData.fromId,
            toId: edgeData.toId,
            style: edgeData.style,
          },
          // Edges don't need bounds but include for consistency
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        } as any;
        
        upsertElement?.(edgeElementData);
        
        // Select the new child and open editor
        if (replaceSelection) {
          replaceSelection(childId);
        }
        
        setTimeout(() => openNodeEditor(stage, childId, childElementData), 50);
      }
    };

    const onPointerUp = () => {
      stage.off('pointermove.mindmap');
      stage.off('pointerup.mindmap');

      const start = stateRef.current.start;
      const preview = stateRef.current.preview;
      stateRef.current.start = null;

      if (preview) {
        preview.remove();
        preview.destroy();
        previewLayer.batchDraw();
        stateRef.current.preview = null;
      }

      const pos = stage.getPointerPosition();
      if (!start || !pos) return;

      const x = Math.min(start.x, pos.x);
      const y = Math.min(start.y, pos.y);
      const w = Math.abs(pos.x - start.x);
      const h = Math.abs(pos.y - start.y);

      commitNode(x, y, w, h);
      setSelectedTool?.("select");
    };

    // Keyboard handler for spawning children
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const selectedIds = getSelectedIds?.() || [];
        const lastSelectedId = selectedIds[selectedIds.length - 1];
        
        if (lastSelectedId) {
          e.preventDefault();
          spawnChild(lastSelectedId);
        }
      }
    };

    stage.on('pointerdown.mindmap', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      stage.off('pointerdown.mindmap');
      stage.off('pointermove.mindmap');
      stage.off('pointerup.mindmap');
      window.removeEventListener('keydown', onKeyDown);
      
      // Cleanup preview if exists
      const preview = stateRef.current.preview;
      if (preview) {
        preview.destroy();
        stateRef.current.preview = null;
      }
      stateRef.current.start = null;
      previewLayer.batchDraw();
    };
  }, [isActive, stageRef, getSelectedTool, toolId, upsertElement, setSelectedTool, replaceSelection, getSelectedIds]);

  return null;
};

export default MindmapTool;

// DOM overlay editor for immediate text input - matches TextTool pattern
function openNodeEditor(
  stage: Konva.Stage, 
  nodeId: string, 
  nodeModel: Omit<MindmapNodeElement, "id"> & { id: string }
) {
  const container = stage.container();
  const rect = container.getBoundingClientRect();
  const stageTransform = stage.getAbsoluteTransform();
  const scaleX = stage.scaleX() || 1;
  const scaleY = stage.scaleY() || 1;
  
  // Position at node's text area (world -> screen)
  const textX = nodeModel.x + nodeModel.style.paddingX;
  const textY = nodeModel.y + nodeModel.style.paddingY;
  const screenPos = stageTransform.point({ x: textX, y: textY });
  const left = rect.left + screenPos.x;
  const top = rect.top + screenPos.y;

  // Scale size metrics to match current zoom to avoid overflow/underflow
  const contentWidth = Math.max(120, (nodeModel.width - nodeModel.style.paddingX * 2)) * scaleX;
  const contentMinHeight = 32 * scaleY;
  const padY = 8 * scaleY;
  const padX = 10 * scaleX;
  const radius = nodeModel.style.cornerRadius * ((scaleX + scaleY) / 2);
  const fontSizePx = nodeModel.style.fontSize * scaleY;

  const textarea = document.createElement("textarea");
  Object.assign(textarea.style, {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    width: `${contentWidth}px`,
    minHeight: `${contentMinHeight}px`,
    padding: `${padY}px ${padX}px`,
    border: "2px solid #3B82F6",
    borderRadius: `${radius}px`,
    background: nodeModel.style.fill,
    color: nodeModel.style.textColor,
    fontFamily: nodeModel.style.fontFamily,
    fontSize: `${fontSizePx}px`,
    fontWeight: "600",
    lineHeight: "1.25",
    zIndex: "1000",
    outline: "none",
    resize: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  } as CSSStyleDeclaration);
  
  textarea.value = nodeModel.text || "";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const commit = (cancel: boolean) => {
    const value = textarea.value.trim();
    if (textarea.parentElement) {
      textarea.parentElement.removeChild(textarea);
    }
    
    if (cancel || !value) return;
    
    // Update node text in store
    const store = useUnifiedCanvasStore.getState();
    const updateElement = store.element?.update;
    if (updateElement) {
      updateElement(nodeId, { 
        data: {
          ...store.element.getById?.(nodeId)?.data,
          text: value
        }
      });
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      commit(true);
    }
    // Allow Shift+Enter for multi-line text
  };
  
  const handleBlur = () => {
    commit(false);
  };

  textarea.addEventListener("keydown", handleKeyDown);
  textarea.addEventListener("blur", handleBlur, { once: true });
}