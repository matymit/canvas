import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import Konva from 'konva';
// Store imports are kept defensive, adapt to your store facade
import { useUnifiedCanvasStore, type UnifiedCanvasStore } from '../stores/unifiedCanvasStore';
import { commitTransformForNode, beginTransformBatch, endTransformBatch } from '../managers/interaction/TransformCommit';

type ElementId = string;

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionAPI {
  // State
  selectedIds: Set<ElementId>;
  isSelected: (id: ElementId) => boolean;
  marquee: MarqueeRect | null;

  // Selection ops
  selectOnly: (id: ElementId) => void;
  addToSelection: (id: ElementId) => void;
  toggleSelection: (id: ElementId) => void;
  clearSelection: () => void;

  // Stage handlers
  handleElementPointerDown: (id: ElementId, e: Konva.KonvaEventObject<PointerEvent>) => void;
  handleStagePointerDown: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handleStagePointerMove: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  handleStagePointerUp: (e: Konva.KonvaEventObject<PointerEvent>) => void;

  // Transformer control (internal, but exposed for flexibility)
  attachTransformerToSelection: () => void;
  detachTransformer: () => void;
}

export interface UseSelectionManagerParams {
  stageRef: React.RefObject<Konva.Stage | null>;
  transformerRef?: React.RefObject<Konva.Transformer | null>;
  overlayLayerRef?: React.RefObject<Konva.Layer | null>;
}

export default function useSelectionManager(
  params: UseSelectionManagerParams
): SelectionAPI {
  const { stageRef, transformerRef, overlayLayerRef } = params;

  // Store slices (defensive optional chaining)
  const selectedIdsRaw = useUnifiedCanvasStore((s: UnifiedCanvasStore) => s.selectedElementIds ?? new Set());
  const selectedIds = useMemo(() => selectedIdsRaw ?? new Set(), [selectedIdsRaw]);
  const selectionSlice = useUnifiedCanvasStore((s: UnifiedCanvasStore) => s.selection ?? null);
  // const elementSlice = useUnifiedCanvasStore((s: UnifiedCanvasStore) => s.elements ?? new Map<ElementId, Record<string, unknown>>());

  // inject store access for transform commits
  const getStore = useCallback(() => {
    const state = useUnifiedCanvasStore.getState();
    return {
      getElement: (id: ElementId) => state.elements?.get?.(id) || state.element?.getById?.(id),
      updateElement: (id: ElementId, patch: Record<string, unknown>, opts?: Record<string, unknown>) => {
        if (state.element?.update) {
          state.element.update(id, patch);
        } else if (state.updateElement) {
          state.updateElement(id, patch, opts);
        }
      },
      history: state.history,
    };
  }, []);

  // Marquee state
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  const isSelected = useCallback(
    (id: ElementId) => selectedIds?.has?.(id) ?? false,
    [selectedIds]
  );

  const selectOnly = useCallback(
    (id: ElementId) => {
      selectionSlice?.selectOne?.(id, false);
    },
    [selectionSlice]
  );

  const addToSelection = useCallback(
    (id: ElementId) => {
      selectionSlice?.selectOne?.(id, true);
    },
    [selectionSlice]
  );

  const toggleSelection = useCallback(
    (id: ElementId) => {
      selectionSlice?.toggle?.(id);
    },
    [selectionSlice]
  );

  const clearSelection = useCallback(() => {
    selectionSlice?.clear?.();
  }, [selectionSlice]);

  // Create transformer if it doesn't exist and wire lifecycle
  useEffect(() => {
    const overlay = overlayLayerRef?.current;
    if (!overlay) return;

    if (!transformerRef?.current) {
      const tr = new Konva.Transformer({
        ignoreStroke: true,
        rotateEnabled: true,
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        name: 'selection-transformer',
      });
      overlay.add(tr);
      if (transformerRef) {
        (transformerRef.current as Konva.Transformer | null) = tr;
      }
    }

    // wire history/commit
    const tr = transformerRef?.current;
    if (!tr) return;

    const onStart = () => {
      beginTransformBatch({ getStore });
      const state = useUnifiedCanvasStore.getState();
      state.selection?.beginTransform?.();
    };
    
    const onEnd = () => {
      const nodes = tr.nodes();
      nodes.forEach((n) => commitTransformForNode(n, { getStore }));
      const state = useUnifiedCanvasStore.getState();
      state.selection?.endTransform?.();
      endTransformBatch({ getStore });
      overlay.getStage()?.batchDraw();
    };

    tr.on('transformstart', onStart);
    tr.on('transformend', onEnd);

    return () => {
      if (tr) {
        tr.off('transformstart', onStart);
        tr.off('transformend', onEnd);
      }
    };
  }, [overlayLayerRef, transformerRef, getStore]);

  // Transformer helpers
  const detachTransformer = useCallback(() => {
    const tr = transformerRef?.current;
    if (!tr) return;
    // Prefer nodes([]) to fully detach per docs
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [transformerRef]);

  const attachTransformerToSelection = useCallback(() => {
    const tr = transformerRef?.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;

    // Find Konva nodes for selected ids by id
    const nodes: Konva.Node[] = [];
    selectedIds.forEach((id: string) => {
      const node = stage.findOne(`#${id}`);
      if (node) nodes.push(node);
    });

    // Ensure transformer is on overlay if provided
    const overlay = overlayLayerRef?.current ?? tr.getLayer() ?? null;
    if (overlay && tr.getLayer() !== overlay) {
      tr.moveTo(overlay);
    }

    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, stageRef, transformerRef, overlayLayerRef]);

  const handleElementPointerDown = useCallback(
    (id: ElementId, e: Konva.KonvaEventObject<PointerEvent>) => {
      const isToggle = e.evt.ctrlKey || e.evt.metaKey;
      if (isToggle) toggleSelection(id);
      else if (!isSelected(id)) selectOnly(id);
      // prevent stage-level handlers
      e.cancelBubble = true;
    },
    [isSelected, selectOnly, toggleSelection]
  );

  const handleStagePointerDown = useCallback(
    (_e: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = stageRef.current;
      if (!stage) return;
      const p = stage.getPointerPosition();
      if (!p) return;
      dragOriginRef.current = { x: p.x, y: p.y };
      didDragRef.current = false;
      setMarquee({ x: p.x, y: p.y, width: 0, height: 0 });

      // Detach transformer during marquee
      detachTransformer();
    },
    [stageRef, detachTransformer]
  );

  const handleStagePointerMove = useCallback(
    (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!dragOriginRef.current) return;
      const stage = stageRef.current;
      if (!stage) return;
      const p = stage.getPointerPosition();
      if (!p) return;
      const ox = dragOriginRef.current.x;
      const oy = dragOriginRef.current.y;
      const w = p.x - ox;
      const h = p.y - oy;
      if (Math.abs(w) > 3 || Math.abs(h) > 3) {
        didDragRef.current = true;
      }
      setMarquee({
        x: Math.min(ox, p.x),
        y: Math.min(oy, p.y),
        width: Math.abs(w),
        height: Math.abs(h),
      });
    },
    [stageRef]
  );

  const handleStagePointerUp = useCallback(
    (_e: Konva.KonvaEventObject<PointerEvent>) => {
      if (!dragOriginRef.current) {
        setMarquee(null);
        return;
      }
      const wasDrag = didDragRef.current;
      dragOriginRef.current = null;

      if (!wasDrag) {
        // Click on empty space clears selection
        clearSelection();
        setMarquee(null);
        // Re-attach transformer to empty selection
        attachTransformerToSelection();
        return;
      }

      // Commit marquee: query spatial index if present or filter by bounding boxes
      const r = marquee;
      setMarquee(null);
      if (!r) {
        attachTransformerToSelection();
        return;
      }

      // Simple pass using elementSlice and getClientRect() by id
      const stage = stageRef.current;
      if (!stage) {
        attachTransformerToSelection();
        return;
      }

      selectionSlice?.clear?.();

      // If element nodes have id = elementId
      const nodes = stage.find((n: Konva.Node) => {
        // Only consider shapes/groups on main layer
        const layer = n.getLayer();
        if (!layer || layer.name() === 'background' || layer.name() === 'overlay') return false;
        const rect = n.getClientRect();
        const intersects =
          rect.x < r.x + r.width &&
          rect.x + rect.width > r.x &&
          rect.y < r.y + r.height &&
          rect.y + rect.height > r.y;
        return intersects;
      });

      const ids: string[] = [];
      nodes.forEach((n) => {
        const id = n.id();
        if (id) ids.push(id);
      });

      if (ids.length > 0) {
        selectionSlice?.set?.(ids);
      }

      // Re-attach transformer to current selection
      attachTransformerToSelection();
    },
    [stageRef, marquee, selectionSlice, clearSelection, attachTransformerToSelection]
  );

  return useMemo<SelectionAPI>(
    () => ({
      selectedIds,
      isSelected,
      marquee,

      selectOnly,
      addToSelection,
      toggleSelection,
      clearSelection,

      handleElementPointerDown,
      handleStagePointerDown,
      handleStagePointerMove,
      handleStagePointerUp,

      attachTransformerToSelection,
      detachTransformer,
    }),
    [
      selectedIds,
      isSelected,
      marquee,
      selectOnly,
      addToSelection,
      toggleSelection,
      clearSelection,
      handleElementPointerDown,
      handleStagePointerDown,
      handleStagePointerMove,
      handleStagePointerUp,
      attachTransformerToSelection,
      detachTransformer,
    ]
  );
}