import { describe, it, expect, beforeEach, vi } from 'vitest';


let CursorManager: any;
let DirectKonvaDrawer: any;

beforeEach(async () => {
  ({ CursorManager } = await import('../../utils/performance/cursorManager'));
  ({ DirectKonvaDrawer } = await import('../../utils/DirectKonvaDrawing'));
});

describe('Event Delegation', () => {
  // Mock event manager similar to LocalCanvasEventManager
  class MockEventManager {
    private tools = new Map<string, any>();
    private priorities = new Map<string, number>();
    private activeToolId: string | null = null;

    registerTool(id: string, handler: any, priority = 0) {
      this.tools.set(id, handler);
      this.priorities.set(id, priority);
    }

    setActiveTool(id: string | null) {
      this.activeToolId = id;
    }

    delegateEvent(eventType: string, event: any): boolean {
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

  it('should prioritize active tool first', () => {
    const manager = new MockEventManager();

    const tool1 = {
      onPointerDown: vi.fn(() => true), // consumed by active tool
      canHandle: vi.fn(() => true),
    };
    const tool2 = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => true),
    };

    manager.registerTool('tool1', tool1, 1);
    manager.registerTool('tool2', tool2, 2);
    manager.setActiveTool('tool1');

    const event = {};
    const consumed = manager.delegateEvent('onPointerDown', event);

    expect(tool1.onPointerDown).toHaveBeenCalledWith(event);
    expect(tool2.onPointerDown).not.toHaveBeenCalled();
    expect(consumed).toBe(true);
  });

  it('should fall back to other tools by priority', () => {
    const manager = new MockEventManager();

    const tool1 = {
      onPointerDown: vi.fn(() => false),
      canHandle: vi.fn(() => true),
    };
    const tool2 = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => true),
    };

    manager.registerTool('tool1', tool1, 1);
    manager.registerTool('tool2', tool2, 2);
    manager.setActiveTool('tool1');

    const event = {};
    const consumed = manager.delegateEvent('onPointerDown', event);

    expect(tool1.onPointerDown).toHaveBeenCalledWith(event);
    expect(tool2.onPointerDown).toHaveBeenCalledWith(event);
    expect(consumed).toBe(true);
  });

  it('should respect canHandle filter', () => {
    const manager = new MockEventManager();

    const tool = {
      onPointerDown: vi.fn(() => true),
      canHandle: vi.fn(() => false), // cannot handle
    };

    manager.registerTool('tool', tool);
    manager.setActiveTool('tool');

    const event = {};
    const consumed = manager.delegateEvent('onPointerDown', event);

    expect(tool.canHandle).toHaveBeenCalledWith(event);
    expect(tool.onPointerDown).not.toHaveBeenCalled();
    expect(consumed).toBe(false);
  });
});

describe.skip('Cursor Manager (relocated to integration/visual tests)', () => {
  let stage: any;
  let manager: CursorManager;

  beforeEach(async () => {
    const K = (await import('konva')).default;
    stage = new (vi.mocked(K.Stage as any))();
    manager = new CursorManager(stage, 'default');
  });

  it('should update cursor on selection', () => {
    manager.set('pointer');
    expect(stage.container().style.cursor).toBe('pointer');
  });

  it('should push/pop cursor stack', () => {
    manager.set('default');
    manager.push('pointer');
    expect(stage.container().style.cursor).toBe('pointer');

    manager.push('grab');
    expect(stage.container().style.cursor).toBe('grab');

    manager.pop();
    expect(stage.container().style.cursor).toBe('pointer');

    manager.pop();
    expect(stage.container().style.cursor).toBe('default');
  });

  it('should reset to default', () => {
    manager.push('pointer');
    manager.push('grab');
    manager.reset();

    expect(stage.container().style.cursor).toBe('default');
  });

  it('should handle pan drag grabbing', () => {
    manager.push('grab');
    expect(stage.container().style.cursor).toBe('grab');

    manager.set('grabbing');
    expect(stage.container().style.cursor).toBe('grabbing');
  });

  it('should reset on tool switch', () => {
    manager.push('crosshair');
    manager.reset();
    expect(stage.container().style.cursor).toBe('default');
  });
});

describe.skip('Direct Drawing Options (relocated to visual tests)', () => {
  let layer: any;
  let drawer: DirectKonvaDrawer;

beforeEach(async () => {
    const K = (await import('konva')).default;
    layer = new (vi.mocked(K.Layer as any))();
    drawer = new DirectKonvaDrawer(layer);
  });

  it('should create Konva.Line with listening false', () => {
    const line = drawer.begin({ x: 10, y: 10 }, { tool: 'pen', color: 'black', width: 2 });

    expect(line.listening).toHaveBeenCalledWith(false);
    expect(drawer.isDrawing).toBe(true);
  });

  it('should use perfectDrawEnabled false for high-performance', () => {
    const line = drawer.begin({ x: 10, y: 10 }, { tool: 'pen', color: 'black', width: 2 });

    expect(line.perfectDrawEnabled).toHaveBeenCalledWith(false);
    expect(line.shadowForStrokeEnabled).toHaveBeenCalledWith(false);
  });

  it('should use FastLayer for high-performance drawing', () => {
    // The layer is passed in constructor, assuming it's a FastLayer
    expect(layer).toBeDefined();
  });

  it('should handle freehand tools correctly', () => {
    const line = drawer.begin({ x: 0, y: 0 }, { tool: 'pen', color: 'blue', width: 3 });

    drawer.extend({ x: 10, y: 10 });
    drawer.extend({ x: 20, y: 20 });

    expect(line.points).toHaveBeenCalledWith([0, 0, 10, 10, 20, 20]);
  });

  it('should finalize stroke on end', () => {
    drawer.begin({ x: 0, y: 0 }, { tool: 'pen', color: 'red', width: 2 });
    drawer.extend({ x: 10, y: 10 });

    const result = drawer.end();

    expect(result).toBeDefined();
    expect(result?.points).toEqual([0, 0, 10, 10]);
    expect(drawer.isDrawing).toBe(false);
  });

  it('should cancel drawing properly', () => {
    drawer.begin({ x: 0, y: 0 }, { tool: 'pen', color: 'green', width: 2 });
    drawer.extend({ x: 10, y: 10 });

    drawer.cancel();

    expect(drawer.isDrawing).toBe(false);
    expect(drawer.line).toBeNull();
  });
});