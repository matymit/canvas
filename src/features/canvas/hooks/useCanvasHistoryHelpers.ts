// features/canvas/hooks/useCanvasHistoryHelpers.ts
import Konva from 'konva';

export type AttrsMap = Record<string, unknown>;

export type AttrsOp = {
  type: 'attrs';
  targetId: string;
  targetType?: string;
  before: AttrsMap;
  after: AttrsMap;
};

export type AddOp = {
  type: 'add';
  parentId: string;
  targetId: string;
  index: number;
  nodeJSON: string; // serialized single node JSON
};

export type RemoveOp = {
  type: 'remove';
  parentId: string;
  targetId: string;
  index: number;
  nodeJSON: string; // serialized single node JSON
};

export type ReorderOp = {
  type: 'reorder';
  parentId: string;
  targetId: string;
  fromIndex: number;
  toIndex: number;
};

export type HistoryOp = AttrsOp | AddOp | RemoveOp | ReorderOp;

const isContainer = (node: Konva.Node | null | undefined): node is Konva.Container =>
  !!node && typeof (node as { add?: unknown }).add === 'function';

const idGen = (() => {
  let n = 0;
  return () => `k-${Date.now().toString(36)}-${(++n).toString(36)}`;
})();

/**
 * Ensure a Konva node has an id set. Returns the id.
 */
export function ensureNodeId(node: Konva.Node): string {
  let id = node.id();
  if (!id) {
    id = idGen();
    node.id(id);
  }
  return id;
}

/**
 * Find node by id within a stage using selector API.
 */
export function findNodeById(stage: Konva.Stage, id: string): Konva.Node | undefined {
  if (!id) return undefined;
  const node = stage.findOne(`#${id}`);
  return node ?? undefined;
}

/**
 * Serialize a single node to JSON string.
 * Note: event handlers and image pixel data are not serialized.
 */
export function serializeNode(node: Konva.Node): string {
  // toJSON returns string with node attrs and children if any
  return node.toJSON();
}

/**
 * Create a node instance from JSON string.
 * The JSON should describe a single node (not a full Stage).
 */
export function createNodeFromJSON(json: string): Konva.Node {
  // Node.create can construct nodes from JSON
  return Konva.Node.create(json) as Konva.Node;
}

/**
 * Get the node's index relative to its parent using zIndex API.
 */
export function getNodeIndex(node: Konva.Node): number {
  return node.zIndex();
}

/**
 * Compute minimal attrs diff, returning only changed keys.
 * Keys in ignore can be skipped (e.g., for non-serializable fields).
 */
export function diffAttrs(
  before: AttrsMap,
  after: AttrsMap,
  ignore: string[] = []
): { before: AttrsMap; after: AttrsMap } {
  const ignoreSet = new Set(ignore);
  const changedKeys = new Set<string>();

  for (const k in before) {
    if (ignoreSet.has(k)) continue;
    const b = before[k];
    const a = after[k];
    // shallow compare; deep structs should be normalized by caller
    if (b !== a) changedKeys.add(k);
  }
  for (const k in after) {
    if (ignoreSet.has(k)) continue;
    if (!(k in before)) changedKeys.add(k);
  }

  const bOut: AttrsMap = {};
  const aOut: AttrsMap = {};
  changedKeys.forEach((k) => {
    if (k in before) bOut[k] = before[k];
    if (k in after) aOut[k] = after[k];
    // if missing in one side, it will be undefined when applied via setAttrs
  });

  return { before: bOut, after: aOut };
}

/**
 * Capture a shallow snapshot of node attributes for diffing.
 */
export function snapshotAttrs(node: Konva.Node, pickKeys?: string[]): AttrsMap {
  const attrs = node.getAttrs();
  if (!pickKeys || pickKeys.length === 0) return { ...attrs };
  const out: AttrsMap = {};
  for (const k of pickKeys) out[k] = attrs[k];
  return out;
}

/**
 * Apply a single operation in the given direction.
 * Returns true if applied, false if skipped due to missing nodes/parents.
 */
export function applyOp(stage: Konva.Stage, op: HistoryOp, direction: 'undo' | 'redo'): boolean {
  switch (op.type) {
    case 'attrs': {
      const node = findNodeById(stage, op.targetId);
      if (!node) return false;
      const payload = direction === 'redo' ? op.after : op.before;
      node.setAttrs(payload);
      const layer = node.getLayer();
      if (layer) layer.batchDraw();
      return true;
    }
    case 'add': {
      if (direction === 'redo') {
        const parent = findNodeById(stage, op.parentId);
        if (!isContainer(parent)) return false;
        // If node already exists, just ensure z order
        let node = findNodeById(stage, op.targetId);
        if (!node) {
          node = createNodeFromJSON(op.nodeJSON);
          ensureNodeId(node); // keep id stable
          parent.add(node);
        } else if (node.getParent() !== parent) {
          node.moveTo(parent as Konva.Container);
        }
        node.zIndex(op.index);
        const layer = node.getLayer();
        if (layer) layer.batchDraw();
        return true;
      } else {
        // undo add => remove node
        const node = findNodeById(stage, op.targetId);
        if (!node) return false;
        node.remove();
        const layer = node.getLayer();
        if (layer) layer.batchDraw();
        return true;
      }
    }
    case 'remove': {
      if (direction === 'redo') {
        // remove node
        const node = findNodeById(stage, op.targetId);
        if (!node) return false;
        node.remove();
        const layer = node.getLayer();
        if (layer) layer.batchDraw();
        return true;
      } else {
        // undo remove => re-add from JSON
        const parent = findNodeById(stage, op.parentId);
        if (!isContainer(parent)) return false;
        let node = findNodeById(stage, op.targetId);
        if (!node) {
          node = createNodeFromJSON(op.nodeJSON);
          ensureNodeId(node);
          parent.add(node);
        } else if (node.getParent() !== parent) {
          node.moveTo(parent as Konva.Container);
        }
        node.zIndex(op.index);
        const layer = node.getLayer();
        if (layer) layer.batchDraw();
        return true;
      }
    }
    case 'reorder': {
      const node = findNodeById(stage, op.targetId);
      const parent = findNodeById(stage, op.parentId);
      if (!node || !isContainer(parent) || node.getParent() !== parent) return false;
      const index = direction === 'redo' ? op.toIndex : op.fromIndex;
      node.zIndex(index);
      const layer = node.getLayer();
      if (layer) layer.batchDraw();
      return true;
    }
    default:
      return false;
  }
}

/**
 * Apply multiple operations; on undo, ops are applied in reverse order to respect dependencies.
 */
export function applyOps(stage: Konva.Stage, ops: HistoryOp[], direction: 'undo' | 'redo'): void {
  const ordered = direction === 'undo' ? [...ops].reverse() : ops;
  // Optionally, batch draw at the end; individual ops already call batchDraw on layers
  ordered.forEach((op) => {
    applyOp(stage, op, direction);
  });
}

/**
 * Build an attribute-change operation for a node by comparing snapshots.
 */
export function makeAttrsOp(
  node: Konva.Node,
  before: AttrsMap,
  after: AttrsMap,
  ignore: string[] = []
): AttrsOp | null {
  const id = ensureNodeId(node);
  const { before: b, after: a } = diffAttrs(before, after, ignore);
  const changed = Object.keys({ ...b, ...a }).length > 0;
  if (!changed) return null;
  return {
    type: 'attrs',
    targetId: id,
    targetType: node.getClassName(),
    before: b,
    after: a,
  };
}

/**
 * Build add/remove/reorder ops from actual node state, for consumers that prefer auto-capture.
 */
export function makeAddOp(node: Konva.Node): AddOp {
  const parent = node.getParent() as Konva.Container;
  const parentId = ensureNodeId(parent);
  const targetId = ensureNodeId(node);
  return {
    type: 'add',
    parentId,
    targetId,
    index: getNodeIndex(node),
    nodeJSON: serializeNode(node),
  };
}

export function makeRemoveOp(node: Konva.Node): RemoveOp {
  const parent = node.getParent() as Konva.Container;
  const parentId = ensureNodeId(parent);
  const targetId = ensureNodeId(node);
  return {
    type: 'remove',
    parentId,
    targetId,
    index: getNodeIndex(node),
    nodeJSON: serializeNode(node),
  };
}

export function makeReorderOp(node: Konva.Node, fromIndex: number, toIndex: number): ReorderOp {
  const parent = node.getParent() as Konva.Container;
  const parentId = ensureNodeId(parent);
  const targetId = ensureNodeId(node);
  return {
    type: 'reorder',
    parentId,
    targetId,
    fromIndex,
    toIndex,
  };
}