import { renderHook, act } from "@testing-library/react";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import Konva from "konva";
import type { MutableRefObject } from "react";

import { useCanvasEvents } from "../../../features/canvas/components/figjam/hooks/useCanvasEvents";
import { useUnifiedCanvasStore } from "../../../features/canvas/stores/unifiedCanvasStore";
import type { CanvasElement } from "../../../../types";
import type { RafBatcher } from "../../../features/canvas/utils/performance/RafBatcher";
import type GridRenderer from "../../../features/canvas/components/GridRenderer";

const createKonvaClickEvent = (
  target: Konva.Node,
  evt: MouseEvent,
): Konva.KonvaEventObject<MouseEvent> =>
  ({
    type: "click",
    target,
    currentTarget: target,
    evt,
    cancelBubble: false,
    pointerId: 0,
  } as unknown as Konva.KonvaEventObject<MouseEvent>);

const createKonvaWheelEvent = (
  target: Konva.Node,
  evt: WheelEvent,
): Konva.KonvaEventObject<WheelEvent> =>
  ({
    type: "wheel",
    target,
    currentTarget: target,
    evt,
    cancelBubble: false,
    pointerId: 0,
  } as unknown as Konva.KonvaEventObject<WheelEvent>);

const createImmediateBatcherRef = (): MutableRefObject<RafBatcher | null> => ({
  current: {
    enqueueWrite: (fn: () => void) => {
      fn();
      return true;
    },
  } as unknown as RafBatcher,
});

describe("useCanvasEvents", () => {
  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let mainLayer: Konva.Layer;

  beforeEach(() => {
    container = document.createElement("div");
    container.style.width = "400px";
    container.style.height = "300px";
    document.body.appendChild(container);

    stage = new Konva.Stage({
      container,
      width: 400,
      height: 300,
    });
    stage.getPointerPosition = vi.fn(() => ({ x: 200, y: 150 }));

    mainLayer = new Konva.Layer();
    stage.add(mainLayer);

    const store = useUnifiedCanvasStore.getState();
    store.replaceAll?.([], []);
    store.selection?.clear?.();
    store.viewport?.reset?.();
    store.ui?.setSelectedTool?.("select");
  });

  afterEach(() => {
    stage.destroy();
    container.remove();

    const store = useUnifiedCanvasStore.getState();
    store.replaceAll?.([], []);
    store.selection?.clear?.();
    store.viewport?.reset?.();
  });

  it("clears selection when background is clicked", () => {
    const stageRef = { current: stage };
    const gridRendererRef = { current: null };
    const element: CanvasElement = {
      id: "rect-1",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 50,
      height: 40,
    };

    const store = useUnifiedCanvasStore.getState();
    store.replaceAll?.([element], [element.id]);
    store.selection?.set?.([element.id]);

    const rafBatcherRef = createImmediateBatcherRef();
    const { unmount } = renderHook(() =>
      useCanvasEvents({ stageRef, gridRendererRef, rafBatcherRef }),
    );

    expect(Array.from(useUnifiedCanvasStore.getState().selectedElementIds)).toEqual([
      element.id,
    ]);

    act(() => {
      const event = createKonvaClickEvent(stage, new MouseEvent("click"));
      stage.fire("click", event);
    });

    expect(useUnifiedCanvasStore.getState().selectedElementIds.size).toBe(0);

    unmount();
  });

  it("selects element when node is clicked", () => {
    const stageRef = { current: stage };
    const gridRendererRef = { current: null };
    const element: CanvasElement = {
      id: "rect-2",
      type: "rectangle",
      x: 20,
      y: 30,
      width: 60,
      height: 45,
    };

    const store = useUnifiedCanvasStore.getState();
    store.replaceAll?.([element], [element.id]);
    store.selection?.clear?.();
    store.ui?.setSelectedTool?.("select");

    const rect = new Konva.Rect({
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      listening: true,
      fill: "#646cff",
    });
    rect.setAttr("elementId", element.id);
    mainLayer.add(rect);
    mainLayer.draw();

    const rafBatcherRef = createImmediateBatcherRef();
    const { unmount } = renderHook(() =>
      useCanvasEvents({ stageRef, gridRendererRef, rafBatcherRef }),
    );

    act(() => {
      const mouse = new MouseEvent("click", { ctrlKey: false, metaKey: false });
      const event = createKonvaClickEvent(rect, mouse);
      stage.fire("click", event);
    });

    expect(Array.from(useUnifiedCanvasStore.getState().selectedElementIds)).toEqual([
      element.id,
    ]);

    unmount();
  });

  it("toggles selection when ctrl-clicking a selected node", () => {
    const stageRef = { current: stage };
    const gridRendererRef = { current: null };
    const element: CanvasElement = {
      id: "rect-3",
      type: "rectangle",
      x: 40,
      y: 50,
      width: 70,
      height: 55,
    };

    const store = useUnifiedCanvasStore.getState();
    store.replaceAll?.([element], [element.id]);
    store.selection?.set?.([element.id]);
    store.ui?.setSelectedTool?.("select");

    const rect = new Konva.Rect({
      id: element.id,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      listening: true,
      fill: "#10b981",
    });
    rect.setAttr("elementId", element.id);
    mainLayer.add(rect);
    mainLayer.draw();

    const rafBatcherRef = createImmediateBatcherRef();
    const { unmount } = renderHook(() =>
      useCanvasEvents({ stageRef, gridRendererRef, rafBatcherRef }),
    );

    expect(Array.from(useUnifiedCanvasStore.getState().selectedElementIds)).toEqual([
      element.id,
    ]);

    act(() => {
      const mouse = new MouseEvent("click", { ctrlKey: true, metaKey: false });
      const event = createKonvaClickEvent(rect, mouse);
      stage.fire("click", event);
    });

    expect(useUnifiedCanvasStore.getState().selectedElementIds.size).toBe(0);

    unmount();
  });

  it("coalesces grid DPR updates via rafBatcher", () => {
    const stageRef = { current: stage };
    const updateOptionsMock = vi.fn();
    const gridRendererRef: MutableRefObject<GridRenderer | null> = {
      current: {
        updateOptions: updateOptionsMock,
      } as unknown as GridRenderer,
    };

    const enqueueWriteCallbacks: Array<() => void> = [];
    const enqueueWriteMock = vi.fn((fn: () => void) => {
      enqueueWriteCallbacks.push(fn);
      return true;
    });
    const rafBatcherRef: MutableRefObject<RafBatcher | null> = {
      current: {
        enqueueWrite: enqueueWriteMock,
      } as unknown as RafBatcher,
    };

    const { unmount } = renderHook(() =>
      useCanvasEvents({ stageRef, gridRendererRef, rafBatcherRef }),
    );

    act(() => {
      const wheelEvent = createKonvaWheelEvent(stage, new WheelEvent("wheel", { deltaY: 1 }));
      stage.fire("wheel", wheelEvent);
    });

    expect(enqueueWriteMock).toHaveBeenCalledTimes(1);
    expect(updateOptionsMock).not.toHaveBeenCalled();

    act(() => {
      const wheelEvent = createKonvaWheelEvent(stage, new WheelEvent("wheel", { deltaY: -1 }));
      stage.fire("wheel", wheelEvent);
    });

    expect(enqueueWriteMock).toHaveBeenCalledTimes(1);

    act(() => {
      enqueueWriteCallbacks.shift()?.();
    });

    expect(updateOptionsMock).toHaveBeenCalledTimes(1);

    act(() => {
      const wheelEvent = createKonvaWheelEvent(stage, new WheelEvent("wheel", { deltaY: 1 }));
      stage.fire("wheel", wheelEvent);
    });

    expect(enqueueWriteMock).toHaveBeenCalledTimes(2);

    act(() => {
      enqueueWriteCallbacks.shift()?.();
    });

    expect(updateOptionsMock).toHaveBeenCalledTimes(2);

    unmount();
  });
});
