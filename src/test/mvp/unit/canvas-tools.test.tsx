import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useCanvasTools } from "../../../features/canvas/components/figjam/hooks/useCanvasTools";
import type ToolManager from "../../../features/canvas/managers/ToolManager";

describe("useCanvasTools", () => {
  let container: HTMLDivElement;
  const rafBatcherRef = { current: {} } as const;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("applies grab cursor when pan tool is selected", () => {
    const toolManagerRef = { current: null };
    const connectorLayersRef = { current: null };
    const stageRef = { current: null };

    renderHook(() =>
      useCanvasTools({
        containerRef: { current: container },
        stageRef,
        toolManagerRef,
        connectorLayersRef,
        rafBatcherRef: rafBatcherRef as any,
        selectedTool: "pan",
      }),
    );

    expect(container.style.cursor).toBe("grab");
  });

  it("activates text tool via manager when selectedTool is text", () => {
    const activateCanvasTool = vi.fn();
    const detach = vi.fn();
    const manager = {
      activateCanvasTool,
      getActiveCanvasTool: vi.fn(() => ({ detach })),
    } as unknown as ToolManager;
    const toolManagerRef = { current: manager };
    const connectorLayersRef = { current: null };
    const stageRef = { current: null };

    renderHook(() =>
      useCanvasTools({
        containerRef: { current: container },
        stageRef,
        toolManagerRef,
        connectorLayersRef,
        rafBatcherRef: rafBatcherRef as any,
        selectedTool: "text",
      }),
    );

    expect(activateCanvasTool).toHaveBeenCalledWith("text");
    expect(detach).not.toHaveBeenCalled();
  });

  it("detaches existing active tool when switching back to select", () => {
    const detach = vi.fn();
    const manager = {
      activateCanvasTool: vi.fn(),
      getActiveCanvasTool: vi.fn(() => ({ detach })),
    } as unknown as ToolManager;
    const toolManagerRef = { current: manager };
    const connectorLayersRef = { current: null };
    const stageRef = { current: null };

    renderHook(() =>
      useCanvasTools({
        containerRef: { current: container },
        stageRef,
        toolManagerRef,
        connectorLayersRef,
        rafBatcherRef: rafBatcherRef as any,
        selectedTool: "select",
      }),
    );

    expect(detach).toHaveBeenCalledTimes(1);
  });
});
