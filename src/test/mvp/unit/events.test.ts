import { describe, it, expect, vi } from "vitest";

describe("Event Delegation", () => {
  // Mock event manager similar to LocalCanvasEventManager
  class MockEventManager {
    private tools = new Map<string, any>();
    private priorities = new Map<string, number>();
    private activeToolId: string | null = null;

    registerTool(id: string, handler: unknown, priority = 0) {
      this.tools.set(id, handler);
      this.priorities.set(id, priority);
    }

    setActiveTool(id: string | null) {
      this.activeToolId = id;
    }

    delegateEvent(eventType: string, event: Event): boolean {
      // Active tool first
      if (this.activeToolId) {
        const active = this.tools.get(this.activeToolId);
        const handler = active?.[eventType];
        if (handler && active?.canHandle?.(event) !== false) {
          const consumed = handler(event);
          if (consumed === true) return true;
        }
      }
      // Fallback by priority
      const sorted = Array.from(this.tools.entries()).sort((a, b) => {
        const pa = this.priorities.get(a[0]) ?? 0;
        const pb = this.priorities.get(b[0]) ?? 0;
        return pb - pa;
      });
      for (const [id, tool] of sorted) {
        if (id === this.activeToolId) continue;
        const handler = tool[eventType];
        if (!handler) continue;
        if (tool.canHandle?.(event) === false) continue;
        const consumed = handler(event);
        if (consumed === true) return true;
      }
      return false;
    }
  }

  it("should prioritize active tool first", () => {
    const manager = new MockEventManager();

    const tool1 = {
      onPointerDown: vi.fn(() => true), // consumed by active tool
      canHandle: vi.fn(() => true),
    };
    const tool2 = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => true),
    };

    manager.registerTool("tool1", tool1, 1);
    manager.registerTool("tool2", tool2, 2);
    manager.setActiveTool("tool1");

    const event = new Event("pointerdown") as any;
    const consumed = manager.delegateEvent("onPointerDown", event);

    expect(tool1.onPointerDown).toHaveBeenCalledWith(event);
    expect(tool2.onPointerDown).not.toHaveBeenCalled();
    expect(consumed).toBe(true);
  });

  it("should fall back to other tools by priority", () => {
    const manager = new MockEventManager();

    const tool1 = {
      onPointerDown: vi.fn(() => false),
      canHandle: vi.fn(() => true),
    };
    const tool2 = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => true),
    };

    manager.registerTool("tool1", tool1, 1);
    manager.registerTool("tool2", tool2, 2);
    manager.setActiveTool("tool1");

    const event = new Event("pointerdown") as any;
    const consumed = manager.delegateEvent("onPointerDown", event);

    expect(tool1.onPointerDown).toHaveBeenCalledWith(event);
    expect(tool2.onPointerDown).toHaveBeenCalledWith(event);
    expect(consumed).toBe(true);
  });

  it("should respect canHandle filter", () => {
    const manager = new MockEventManager();

    const tool = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => false), // cannot handle
    };

    manager.registerTool("tool", tool);
    manager.setActiveTool("tool");

    const event = new Event("pointerdown") as any;
    const consumed = manager.delegateEvent("onPointerDown", event);

    expect(tool.canHandle).toHaveBeenCalledWith(event);
    expect(tool.onPointerDown).not.toHaveBeenCalled();
    expect(consumed).toBe(false);
  });
});

// NOTE: Cursor Manager tests relocated to integration/visual tests - removed from unit tests
// // NOTE: Cursor Manager tests relocated to integration/visual tests - removed from unit tests
// This section was skipped and contained outdated cursor management patterns

// NOTE: Direct Drawing Options tests relocated to visual tests - removed from unit tests
// This section was skipped and contained outdated drawing patterns
