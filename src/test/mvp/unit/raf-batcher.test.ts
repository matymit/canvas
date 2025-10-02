import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type Konva from "konva";

import { RafBatcher } from "../../../features/canvas/utils/performance/RafBatcher";
import type { RafBatcherFlushStats } from "../../../features/canvas/utils/performance/RafBatcher";

const createMockLayer = () => {
  return {
    batchDraw: vi.fn(),
    draw: vi.fn(),
  } as unknown as Konva.Layer;
};

describe("RafBatcher instrumentation", () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let scheduledCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    scheduledCallback = null;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      scheduledCallback = cb;
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    scheduledCallback = null;
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.restoreAllMocks();
  });

  it("publishes execution counts to the onFlush handler", () => {
    const onFlush = vi.fn<(stats: RafBatcherFlushStats) => void>();
    const batcher = new RafBatcher({ onFlush });
    const read = vi.fn();
    const write = vi.fn();
    const layer = createMockLayer();

    batcher.enqueueRead(read);
    batcher.enqueueWrite(write);
    batcher.requestLayerDraw(layer);

    expect(scheduledCallback).toBeTypeOf("function");

    batcher.flushNow();

    expect(read).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(layer.batchDraw).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith({ readCount: 1, writeCount: 1, drawCount: 1 });
  });

  it("supports swapping instrumentation handlers at runtime", () => {
    const batcher = new RafBatcher({ preferImmediateDrawInRAF: true });
    const handler = vi.fn<(stats: RafBatcherFlushStats) => void>();
    const layer = createMockLayer();

    batcher.setOnFlush(handler);
    batcher.requestLayerDraw(layer);

    batcher.flushNow();

    expect(layer.draw).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith({ readCount: 0, writeCount: 0, drawCount: 1 });

    handler.mockClear();
    batcher.setOnFlush(undefined);
    batcher.requestLayerDraw(layer);
    batcher.flushNow();

    expect(handler).not.toHaveBeenCalled();
  });
});
