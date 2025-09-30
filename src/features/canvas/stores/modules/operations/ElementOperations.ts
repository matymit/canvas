// features/canvas/stores/modules/operations/ElementOperations.ts
import type { WritableDraft } from "immer";
import type { ElementId, CanvasElement } from "../../../../../../types/index";

export interface ElementState {
  elements: Map<ElementId, CanvasElement>;
  elementOrder: ElementId[];
}

function __sanitize<T>(v: T): T {
  try {
    if (v && typeof v === "object" && v !== null) {
      const copy = Array.isArray(v) ? v.slice() : { ...v };
      for (const k of Object.keys(copy)) {
        if (k.startsWith("_")) delete (copy as Record<string, unknown>)[k];
      }
      return copy as T;
    }
  } catch {
    // Ignore sanitization errors
  }
  return v;
}

export function addElement(
  draft: WritableDraft<ElementState>,
  element: CanvasElement,
  index?: number
): void {
  const targetIndex = Math.max(
    0,
    Math.min(
      typeof index === "number" ? index : draft.elementOrder.length,
      draft.elementOrder.length
    )
  );

  draft.elements = new Map<ElementId, CanvasElement>(draft.elements);
  draft.elements.set(element.id as ElementId, __sanitize(element));
  draft.elementOrder = draft.elementOrder.slice();
  draft.elementOrder.splice(targetIndex, 0, element.id as ElementId);
}

export function addElements(
  draft: WritableDraft<ElementState>,
  elements: CanvasElement[],
  index?: number
): void {
  draft.elements = new Map<ElementId, CanvasElement>(draft.elements);
  draft.elementOrder = draft.elementOrder.slice();

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const at =
      typeof index === "number"
        ? Math.min(draft.elementOrder.length, index + i)
        : draft.elementOrder.length;
    draft.elements.set(el.id as ElementId, __sanitize(el));
    draft.elementOrder.splice(at, 0, el.id as ElementId);
  }
}

export function updateElement(
  draft: WritableDraft<ElementState>,
  id: ElementId,
  patch: Partial<CanvasElement> | ((el: CanvasElement) => CanvasElement)
): void {
  const prev = draft.elements.get(id);
  if (!prev) return;

  const next = __sanitize(
    typeof patch === "function"
      ? (patch as (el: CanvasElement) => CanvasElement)(prev)
      : { ...prev, ...patch }
  );

  const newMap = new Map<ElementId, CanvasElement>(draft.elements);
  newMap.set(id, next);
  draft.elements = newMap;
}

export function updateElements(
  draft: WritableDraft<ElementState>,
  patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>
): void {
  const newMap = new Map<ElementId, CanvasElement>(draft.elements);

  for (const { id, patch } of patches) {
    const prev = newMap.get(id);
    if (!prev) continue;
    const next = __sanitize({ ...prev, ...patch });
    newMap.set(id, next);
  }

  draft.elements = newMap;
}

export function removeElement(
  draft: WritableDraft<ElementState>,
  id: ElementId
): CanvasElement | undefined {
  const element = draft.elements.get(id);
  if (!element) return undefined;

  const newMap = new Map<ElementId, CanvasElement>(draft.elements);
  newMap.delete(id);
  draft.elements = newMap;
  draft.elementOrder = draft.elementOrder.filter((eid) => eid !== id);

  return element;
}

export function removeElements(
  draft: WritableDraft<ElementState>,
  ids: ElementId[]
): CanvasElement[] {
  const removed: CanvasElement[] = [];
  const newMap = new Map<ElementId, CanvasElement>(draft.elements);

  for (const id of ids) {
    const el = newMap.get(id);
    if (el) {
      removed.push(el);
      newMap.delete(id);
    }
  }

  draft.elements = newMap;

  if (removed.length > 0) {
    const toRemove = new Set(ids);
    draft.elementOrder = draft.elementOrder.filter(
      (eid: ElementId) => !toRemove.has(eid)
    );
  }

  return removed;
}

export function moveElement(
  draft: WritableDraft<ElementState>,
  id: ElementId,
  toIndex: number
): void {
  const order = draft.elementOrder.slice();
  const from = order.indexOf(id);
  if (from === -1) return;
  
  order.splice(from, 1);
  const clamped = Math.max(0, Math.min(order.length, toIndex));
  order.splice(clamped, 0, id);
  draft.elementOrder = order;
}

export function bringToFront(
  draft: WritableDraft<ElementState>,
  id: ElementId
): void {
  const order = draft.elementOrder.slice();
  const from = order.indexOf(id);
  if (from === -1) return;
  
  order.splice(from, 1);
  order.push(id);
  draft.elementOrder = order;
}

export function sendToBack(
  draft: WritableDraft<ElementState>,
  id: ElementId
): void {
  const order = draft.elementOrder.slice();
  const from = order.indexOf(id);
  if (from === -1) return;
  
  order.splice(from, 1);
  order.unshift(id);
  draft.elementOrder = order;
}

export function replaceAllElements(
  draft: WritableDraft<ElementState>,
  elements: CanvasElement[],
  order?: ElementId[]
): void {
  const map = new Map<ElementId, CanvasElement>();
  for (const el of elements) map.set(el.id as ElementId, el);
  
  draft.elements = map;
  draft.elementOrder = order ?? elements.map((e) => e.id as ElementId);
}

export function duplicateElement(
  draft: WritableDraft<ElementState>,
  id: ElementId,
  offset?: { x: number; y: number }
): { newId: ElementId; element: CanvasElement } | undefined {
  const el = draft.elements.get(id);
  if (!el) return undefined;

  const newId = (crypto?.randomUUID?.() ??
    `${id}-copy`) as unknown as ElementId;
  const clonedElement = { ...el, id: newId } as CanvasElement;

  const dx = offset?.x ?? 12;
  const dy = offset?.y ?? 12;

  if ("x" in clonedElement && typeof clonedElement.x === "number") {
    clonedElement.x += dx;
  }
  if ("y" in clonedElement && typeof clonedElement.y === "number") {
    clonedElement.y += dy;
  }
  if (
    "points" in clonedElement &&
    Array.isArray(clonedElement.points) &&
    clonedElement.points.length >= 2
  ) {
    const pts = clonedElement.points as number[];
    const shifted: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      shifted.push(pts[i] + dx, pts[i + 1] + dy);
    }
    clonedElement.points = shifted;
  }

  addElement(draft, clonedElement);

  return { newId, element: clonedElement };
}

// Query helpers
export function hasElement(
  state: ElementState,
  id: ElementId
): boolean {
  return state.elements.has(id);
}

export function getElement(
  state: ElementState,
  id: ElementId
): CanvasElement | undefined {
  return state.elements.get(id);
}

export function getElements(
  state: ElementState,
  ids: Iterable<ElementId>
): CanvasElement[] {
  const map = state.elements;
  const out: CanvasElement[] = [];
  const idArray = Array.isArray(ids) ? ids : Array.from(ids);
  for (const id of idArray) {
    const el = map.get(id);
    if (el) out.push(el);
  }
  return out;
}

export function getAllElementsInOrder(
  state: ElementState
): CanvasElement[] {
  const map = state.elements;
  const ordered: CanvasElement[] = [];
  for (const id of state.elementOrder) {
    const element = map.get(id);
    if (element) ordered.push(element);
  }
  return ordered;
}
