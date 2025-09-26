import type Konva from "konva";

// Minimal element type discriminator from your element union
type ElementId = string;
type AnyElement = {
  id: ElementId;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  data?: Record<string, unknown>;
  colWidths?: number[];
  rowHeights?: number[];
  // per type fields follow...
};

type Store = {
  getElement?: (id: ElementId) => AnyElement | undefined;
  updateElement?: (
    id: ElementId,
    patch: Partial<AnyElement>,
    opts?: { pushHistory?: boolean },
  ) => void;
  history?: {
    beginBatch?: (label?: string) => void;
    endBatch?: (commit?: boolean) => void;
  };
};

export interface TransformCommitDeps {
  getStore: () => Store;
}

function round(n: number) {
  return Math.round(n);
}

function commitRectLike(el: AnyElement, node: Konva.Node, store: Store) {
  const k = node as Konva.Node & {
    scaleX(): number;
    scaleY(): number;
    x(): number;
    y(): number;
    rotation?(): number;
  };
  const sx = k.scaleX() ?? 1;
  const sy = k.scaleY() ?? 1;
  const nx = k.x();
  const ny = k.y();
  const rot = k.rotation?.() ?? el.rotation ?? 0;
  const w = Math.max(1, round((el.width ?? 1) * sx));
  const h = Math.max(1, round((el.height ?? 1) * sy));
  // reset scales to 1 after committing absolute size
  k.scaleX(1);
  k.scaleY(1);
  store.updateElement?.(
    el.id,
    { x: nx, y: ny, width: w, height: h, rotation: rot },
    { pushHistory: true },
  );
}

function commitImage(el: AnyElement, node: Konva.Node, store: Store) {
  // shares the same geometry normalization as rect-like
  commitRectLike(el, node, store);
}

function commitTable(
  el: AnyElement & { colWidths?: number[]; rowHeights?: number[] },
  node: Konva.Node,
  store: Store,
) {
  const k = node as Konva.Node & {
    scaleX(): number;
    scaleY(): number;
    x(): number;
    y(): number;
    rotation?(): number;
  };
  const sx = k.scaleX() ?? 1;
  const sy = k.scaleY() ?? 1;
  const nx = k.x();
  const ny = k.y();
  const rot = k.rotation?.() ?? el.rotation ?? 0;
  const colWidths = (el.colWidths ?? []).map((v) => Math.max(8, round(v * sx)));
  const rowHeights = (el.rowHeights ?? []).map((v) =>
    Math.max(8, round(v * sy)),
  );
  // reset scales to 1
  k.scaleX(1);
  k.scaleY(1);
  store.updateElement?.(
    el.id,
    {
      x: nx,
      y: ny,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeights.reduce((a, b) => a + b, 0),
      rotation: rot,
      data: {
        ...(el.data || {}),
        colWidths,
        rowHeights,
      },
    },
    { pushHistory: true },
  );
}

function commitText(el: AnyElement, node: Konva.Node, store: Store) {
  // Text boxes: keep width from scale; height can be measured/auto-grown elsewhere
  commitRectLike(el, node, store);
}

function commitSticky(el: AnyElement, node: Konva.Node, store: Store) {
  // Sticky behaves like a rectangle for geometry commit; text rewrap handled by renderer/editor
  commitRectLike(el, node, store);
}

function commitMindmapNode(el: AnyElement, node: Konva.Node, store: Store) {
  // Nodes are box-like; edges reroute via live routing wire
  commitRectLike(el, node, store);
}

function commitConnector(el: AnyElement, node: Konva.Node, store: Store) {
  // Typically non-resizable; allow move/rotation if enabled
  const k = node as Konva.Node & {
    x(): number;
    y(): number;
    rotation?(): number;
  };
  const nx = k.x();
  const ny = k.y();
  const rot = k.rotation?.() ?? el.rotation ?? 0;
  store.updateElement?.(
    el.id,
    { x: nx, y: ny, rotation: rot },
    { pushHistory: true },
  );
}

export function commitTransformForNode(
  node: Konva.Node,
  deps: TransformCommitDeps,
) {
  const store = deps.getStore();
  const id = node.id?.() as string;
  if (!id) return;
  const el = store.getElement?.(id);
  if (!el) return;

  switch (el.type) {
    case "rectangle":
    case "circle":
    case "triangle":
    case "shape":
      return commitRectLike(el, node, store);
    case "image":
      return commitImage(el, node, store);
    case "table":
      return commitTable(el, node, store);
    case "text":
      return commitText(el, node, store);
    case "sticky-note":
      return commitSticky(el, node, store);
    case "mindmap-node":
      return commitMindmapNode(el, node, store);
    case "connector":
    case "line":
    case "arrow":
      return commitConnector(el, node, store);
    default:
      return commitRectLike(el, node, store);
  }
}

export function beginTransformBatch(
  deps: TransformCommitDeps,
  label = "transform",
) {
  deps.getStore().history?.beginBatch?.(label);
}

export function endTransformBatch(deps: TransformCommitDeps) {
  deps.getStore().history?.endBatch?.(true);
}
