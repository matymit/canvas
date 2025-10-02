import { render, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Konva from "konva";

import FigJamCanvas from "../../../features/canvas/components/FigJamCanvas";
import { useUnifiedCanvasStore } from "../../../features/canvas/stores/unifiedCanvasStore";

type TestWindow = Window & typeof globalThis & {
  konvaStage?: Konva.Stage;
  canvasRafBatcher?: unknown;
  canvasRafBatcherStats?: unknown;
};

vi.mock("../../../features/canvas/toolbar/CanvasToolbar", () => ({
  __esModule: true,
  default: ({ selectedTool }: { selectedTool: string }) => (
    <div data-testid="toolbar-mock" data-selected-tool={selectedTool} />
  ),
}));

vi.mock("../../../features/canvas/utils/mindmap/mindmapOperations", () => ({
  useMindmapOperations: () => ({
    duplicateNode: vi.fn(),
    createChildNode: vi.fn(),
    duplicateSubtree: vi.fn(),
    getNodeDescendants: vi.fn(),
    getNodeChildren: vi.fn(),
  }),
}));

vi.mock("../../../features/canvas/components/figjam/hooks/useCanvasServices", () => ({
  useCanvasServices: () => ({ serviceNodes: null }),
}));

describe("FigJamCanvas integration", () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useUnifiedCanvasStore.getState() as any;
    store.replaceAll?.([], []);
    store.selection?.clear?.();
    store.viewport?.setPan?.(0, 0);
    store.viewport?.setScale?.(1);
    store.history?.clear?.();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();

    const store = useUnifiedCanvasStore.getState() as any;
    store.replaceAll?.([], []);
    store.selection?.clear?.();
    store.viewport?.setPan?.(0, 0);
    store.viewport?.setScale?.(1);
    store.history?.clear?.();

    const testWindow = window as TestWindow;
    delete testWindow.konvaStage;
    delete testWindow.canvasRafBatcher;
  delete testWindow.canvasRafBatcherStats;
  });

  it("initializes stage resources and cleans them up on unmount", async () => {
    const { getByTestId, unmount } = render(<FigJamCanvas />);

    const stageContainer = await waitFor(() => getByTestId("konva-stage-container"));

    const testWindow = window as TestWindow;
    await waitFor(() => {
      expect(testWindow.konvaStage).toBeInstanceOf(Konva.Stage);
    });

    const stage = testWindow.konvaStage as Konva.Stage;
    const viewport = useUnifiedCanvasStore.getState().viewport;

    expect(stage.getLayers()).toHaveLength(4);
    expect(stage.position()).toEqual({ x: viewport.x, y: viewport.y });
    expect(stage.scaleX()).toBeCloseTo(viewport.scale);
    expect(stage.scaleY()).toBeCloseTo(viewport.scale);

    const overlay = stageContainer.querySelector(
      ".canvas-dom-overlay",
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay?.style.pointerEvents).toBe("none");
    expect(overlay?.style.transformOrigin).toBe("0 0");
    expect(overlay?.style.transform).toBe("translate3d(0, 0, 0)");

    expect(testWindow.canvasRafBatcher).toBeDefined();
  expect(testWindow.canvasRafBatcherStats).toBeDefined();

    unmount();

    await waitFor(() => {
      const afterWindow = window as TestWindow;
      expect(afterWindow.konvaStage).toBeUndefined();
      expect(afterWindow.canvasRafBatcher).toBeUndefined();
      expect(afterWindow.canvasRafBatcherStats).toBeUndefined();
    });

    expect(overlay?.isConnected).toBe(false);

  });
});
