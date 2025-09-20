import { describe, it, expect, beforeEach } from "vitest";
import { useUnifiedCanvasStore } from "../../stores/unifiedCanvasStore";

// Mock types
type ElementId = string;
interface CanvasElement {
  id: ElementId;
  type:
    | "rectangle"
    | "ellipse"
    | "line"
    | "text"
    | "path"
    | "image"
    | "group"
    | "triangle"
    | "table"
    | "mindmap-node"
    | "mindmap-edge"
    | "connector"
    | "sticky-note"
    | "pen"
    | "marker"
    | "highlighter"
    | "eraser"
    | "drawing"
    | "circle";
  x: number;
  y: number;
}

describe("Undo/Redo Batching", () => {
  beforeEach(() => {
    // Reset store state to a minimal baseline; history module lives at root in this store
    useUnifiedCanvasStore.setState({
      elements: new Map(),
      elementOrder: [],
      selectedElementIds: new Set(),
      selectionVersion: 0,
      lastSelectedId: undefined,
      isTransforming: false,
      viewport: {
        x: 0,
        y: 0,
        scale: 1,
        minScale: 0.1,
        maxScale: 5,
      },
      // Reset history slice at root
      entries: [],
      index: -1,
      mergeWindowMs: 250,
      batching: {
        active: false,
        label: undefined,
        mergeKey: undefined,
        startedAt: null,
        ops: [],
      },
    } as any);
  });

  it("should commit grouped operations as single history entry", () => {
    const store = useUnifiedCanvasStore.getState();

    // Start batch
    (store as any).beginBatch("Batch add elements");

    // Add multiple elements in batch
    const el1: CanvasElement = { id: "1", type: "rectangle", x: 10, y: 0 };
    const el2: CanvasElement = { id: "2", type: "circle", x: 20, y: 0 };
    (store as any).addElements([el1, el2], { pushHistory: true });

    // Finish batch (auto-commit)
    (store as any).endBatch();

    // Check that elements are added
    expect(store.element.getById("1")).toEqual(el1);
    expect(store.element.getById("2")).toEqual(el2);
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual(["1", "2"]);

    // Check history has one entry
    const h = useUnifiedCanvasStore.getState() as any;
    expect(h.entries.length).toBe(1);
    expect(h.entries[0].label).toBe("Batch add elements");
  });

  it("should be reversible in order without orphaning elements", () => {
    const store = useUnifiedCanvasStore.getState();

    // Add initial element
    const initialEl: CanvasElement = {
      id: "initial",
      type: "rectangle",
      x: 0,
      y: 0,
    };
    store.element.upsert(initialEl);

    // Start batch
    (store as any).beginBatch("Batch operations");

    // Add elements and select
    const el1: CanvasElement = { id: "1", type: "rectangle", x: 0, y: 0 };
    const el2: CanvasElement = { id: "2", type: "circle", x: 0, y: 0 };
    (store as any).addElements([el1, el2], { pushHistory: true });
    store.selection.set(["1", "2"]);

    // Finish batch
    (store as any).endBatch();

    // Verify state
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual([
      "initial",
      "1",
      "2",
    ]);

    // Undo batch
    (store as any).undo();

    // Should revert to initial state
    expect(store.element.getById("1")).toBeUndefined();
    expect(store.element.getById("2")).toBeUndefined();
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual(["initial"]);

    // Redo batch
    (store as any).redo();

    // Should restore batch state
    expect(store.element.getById("1")).toEqual(el1);
    expect(store.element.getById("2")).toEqual(el2);
    expect(useUnifiedCanvasStore.getState().elementOrder).toEqual([
      "initial",
      "1",
      "2",
    ]);
  });

  it("should handle multiple batches correctly", () => {
    const store = useUnifiedCanvasStore.getState();

    // First batch
    (store as any).beginBatch("First batch");
    const el1: CanvasElement = { id: "1", type: "rectangle", x: 0, y: 0 };
    (store as any).addElements([el1], { pushHistory: true });
    (store as any).endBatch();

    // Second batch
    (store as any).beginBatch("Second batch");
    const el2: CanvasElement = { id: "2", type: "circle", x: 0, y: 0 };
    (store as any).addElements([el2], { pushHistory: true });
    (store as any).endBatch();

    // Check history
    const hs = useUnifiedCanvasStore.getState() as any;
    expect(hs.entries.length).toBe(2);
    expect(hs.entries[0].label).toBe("First batch");
    expect(hs.entries[1].label).toBe("Second batch");

    // Undo second batch
    (store as any).undo();
    expect(store.element.getById("2")).toBeUndefined();
    expect(store.element.getById("1")).toEqual(el1);

    // Undo first batch
    (store as any).undo();
    expect(store.element.getById("1")).toBeUndefined();

    // Redo first batch
    (store as any).redo();
    expect(store.element.getById("1")).toEqual(el1);
    expect(store.element.getById("2")).toBeUndefined();

    // Redo second batch
    (store as any).redo();
    expect(store.element.getById("2")).toEqual(el2);
  });

  it("should not commit incomplete batches", () => {
    const store = useUnifiedCanvasStore.getState();

    // Start batch but don't end it
    (store as any).beginBatch("Incomplete batch");
    const el: CanvasElement = { id: "1", type: "rectangle", x: 0, y: 0 };
    store.element.upsert(el);

    // Check that element is added but no history entry
    expect(store.element.getById("1")).toEqual(el);
    const hs = useUnifiedCanvasStore.getState() as any;
    expect(hs.entries.length).toBe(0);

    // Clear should reset (simulate canceling batch)
    (store as any).clear();
    // Note: in real implementation, canceling batch would undo operations
  });

  it("should maintain selection state across undo/redo", () => {
    const store = useUnifiedCanvasStore.getState();

    // Add element and select
    const el: CanvasElement = { id: "1", type: "rectangle", x: 0, y: 0 };
    store.element.upsert(el);
    store.selection.set(["1"]);

    // Batch: move element and change selection
    (store as any).beginBatch("Move and select");
    (store as any).updateElement("1", { x: 100 }, { pushHistory: true });
    store.selection.set(["1"]); // re-select (already selected)
    (store as any).endBatch();

    // Verify
    expect(useUnifiedCanvasStore.getState().element.getById("1")?.x).toBe(100);
    expect(useUnifiedCanvasStore.getState().selectedElementIds.has("1")).toBe(
      true,
    );

    // Undo
    (store as any).undo();
    expect(
      useUnifiedCanvasStore.getState().element.getById("1")?.x,
    ).toBeUndefined(); // back to original
    expect(useUnifiedCanvasStore.getState().selectedElementIds.has("1")).toBe(
      true,
    ); // selection maintained from before batch

    // Redo
    (store as any).redo();
    expect(useUnifiedCanvasStore.getState().element.getById("1")?.x).toBe(100);
    expect(useUnifiedCanvasStore.getState().selectedElementIds.has("1")).toBe(
      true,
    );
  });
});
