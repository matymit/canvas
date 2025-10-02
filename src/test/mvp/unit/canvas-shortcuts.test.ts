import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useCanvasShortcuts } from "../../../features/canvas/components/figjam/hooks/useCanvasShortcuts";
import { useUnifiedCanvasStore } from "../../../features/canvas/stores/unifiedCanvasStore";

type ElementId = string;
type CanvasElement = {
  id: ElementId;
  type: string;
  [key: string]: unknown;
};

describe("useCanvasShortcuts", () => {
  let mockStore: any;
  let getStateSpy: ReturnType<typeof vi.spyOn>;

  const baseViewport = {
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    fitToContent: vi.fn(),
  };

  beforeEach(() => {
    const mindmapElement = {
      id: "node-1",
      type: "mindmap-node",
      x: 0,
      y: 0,
    } as CanvasElement;

    const secondaryElement = {
      id: "node-2",
      type: "rect",
      x: 10,
      y: 10,
    } as CanvasElement;

    const elements = new Map<ElementId, CanvasElement>([
      [mindmapElement.id as ElementId, mindmapElement],
      [secondaryElement.id as ElementId, secondaryElement],
    ]);

    mockStore = {
      elements,
      getElement: vi.fn((id: ElementId) => elements.get(id)),
      element: {
        getById: vi.fn((id: ElementId) => elements.get(id)),
        delete: vi.fn(),
        duplicate: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        bringToFront: vi.fn(),
        sendToBack: vi.fn(),
        getAll: vi.fn(),
        replaceAll: vi.fn(),
      },
      removeElements: vi.fn(),
      clearSelection: vi.fn(),
      setSelection: vi.fn(),
      selection: { set: vi.fn() },
      addElement: vi.fn(),
      duplicateElement: vi.fn(),
    };

    getStateSpy = vi
      .spyOn(useUnifiedCanvasStore, "getState")
      .mockReturnValue(mockStore);
  });

  afterEach(() => {
    getStateSpy.mockRestore();
    vi.resetAllMocks();
  });

  it("creates a child mindmap node when Enter is pressed on a single mindmap selection", () => {
    const mindmapOps = {
      createChildNode: vi.fn(),
      duplicateNode: vi.fn(),
    };

    const selectedIds = new Set<ElementId>(["node-1" as ElementId]);
    const { unmount } = renderHook(() =>
      useCanvasShortcuts({
        selectedElementIds: selectedIds,
        elements: mockStore.elements,
        viewport: baseViewport,
        withUndo: undefined,
        deleteSelected: undefined,
        setSelection: vi.fn(),
        undo: undefined,
        redo: undefined,
        setSelectedTool: vi.fn(),
        mindmapOps,
      }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(mindmapOps.createChildNode).toHaveBeenCalledWith("node-1");
    expect(mockStore.setSelection).not.toHaveBeenCalled();

    unmount();
  });

  it("selects all elements when Ctrl+A is pressed", () => {
    const setSelection = vi.fn();

    const { unmount } = renderHook(() =>
      useCanvasShortcuts({
        selectedElementIds: new Set<ElementId>(),
        elements: mockStore.elements,
        viewport: baseViewport,
        withUndo: undefined,
        deleteSelected: undefined,
        setSelection,
        undo: undefined,
        redo: undefined,
        setSelectedTool: vi.fn(),
        mindmapOps: {
          createChildNode: vi.fn(),
          duplicateNode: vi.fn(),
        },
      }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(setSelection).toHaveBeenCalledWith([
      "node-1" as ElementId,
      "node-2" as ElementId,
    ]);

    unmount();
  });

  it("uses withUndo when deleting selected elements", () => {
    const deleteSelected = vi.fn();
    const withUndo = vi.fn((description: string, fn: () => void) => fn());

    const { unmount } = renderHook(() =>
      useCanvasShortcuts({
        selectedElementIds: new Set<ElementId>(["node-1" as ElementId]),
        elements: mockStore.elements,
        viewport: baseViewport,
        withUndo,
        deleteSelected,
        setSelection: vi.fn(),
        undo: undefined,
        redo: undefined,
        setSelectedTool: vi.fn(),
        mindmapOps: {
          createChildNode: vi.fn(),
          duplicateNode: vi.fn(),
        },
      }),
    );

    const event = new KeyboardEvent("keydown", {
      key: "Delete",
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(withUndo).toHaveBeenCalledWith(
      "Delete selected elements",
      expect.any(Function),
    );
    expect(deleteSelected).toHaveBeenCalled();
    expect(mockStore.removeElements).not.toHaveBeenCalled();

    unmount();
  });
});
