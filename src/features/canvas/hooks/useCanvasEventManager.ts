// features/canvashooks/useCanvasEventManager.ts
import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';

type AnyKonvaEvent = Konva.KonvaEventObject<Event>;

export interface ToolEventHandler {
  // Pointer-first
  onPointerDown?: (e: AnyKonvaEvent) => boolean | void;
  onPointerMove?: (e: AnyKonvaEvent) => boolean | void;
  onPointerUp?: (e: AnyKonvaEvent) => boolean | void;
  // Mouse fallbacks
  onClick?: (e: AnyKonvaEvent) => boolean | void;
  onMouseDown?: (e: AnyKonvaEvent) => boolean | void;
  onMouseMove?: (e: AnyKonvaEvent) => boolean | void;
  onMouseUp?: (e: AnyKonvaEvent) => boolean | void;
  // Context menu
  onContextMenu?: (e: AnyKonvaEvent) => boolean | void;
  // Wheel/keyboard
  onWheel?: (e: AnyKonvaEvent) => boolean | void;
  onKeyDown?: (e: KeyboardEvent) => boolean | void;
  onKeyUp?: (e: KeyboardEvent) => boolean | void;

  canHandle?: (e: AnyKonvaEvent | KeyboardEvent) => boolean;
  priority?: number;
}

class LocalCanvasEventManager {
  private readonly tools = new Map<string, ToolEventHandler>();
  private readonly priorities = new Map<string, number>();
  private activeToolId: string | null = null;

  registerTool(id: string, handler: ToolEventHandler, priority = 0) {
    this.tools.set(id, handler);
    this.priorities.set(id, priority);
  }
  unregisterTool(id: string) {
    this.tools.delete(id);
    this.priorities.delete(id);
    if (this.activeToolId === id) this.activeToolId = null;
  }
  setActiveTool(id: string | null) {
    this.activeToolId = id;
  }
  setPriority(id: string, p: number) {
    if (this.tools.has(id)) this.priorities.set(id, p);
  }
  private sortedTools(): Array<[string, ToolEventHandler]> {
    return Array.from(this.tools.entries()).sort((a, b) => {
      const pa = this.priorities.get(a[0]) ?? a[1]?.priority ?? 0;
      const pb = this.priorities.get(b[0]) ?? b[1]?.priority ?? 0;
      return pb - pa;
    });
  }
  delegateEvent<T extends keyof ToolEventHandler>(eventType: T, event: AnyKonvaEvent | KeyboardEvent): boolean {
    // 1) active tool first
    if (this.activeToolId) {
      const active = this.tools.get(this.activeToolId);
      const handler = active?.[eventType] as ((ev: AnyKonvaEvent | KeyboardEvent) => boolean | void) | undefined;
      if (handler && (active?.canHandle?.(event) !== false)) {
        const consumed = handler(event);
        if (consumed === true) return true;
      }
    }
    // 2) fallbacks by priority
    for (const [id, tool] of this.sortedTools()) {
      if (id === this.activeToolId) continue;
      const handler = tool[eventType] as ((ev: AnyKonvaEvent | KeyboardEvent) => boolean | void) | undefined;
      if (!handler) continue;
      if (tool.canHandle?.(event) === false) continue;
      const consumed = handler(event);
      if (consumed === true) return true;
    }
    return false;
  }
}

export interface GuidesAPI {
  draw: (guides: Konva.Shape[]) => void;
  clear: () => void;
}

export interface SnapResult {
  x?: number;
  y?: number;
  guides?: Konva.Shape[]; // optional guidelines to render on drag
}

export interface UseCanvasEventManagerParams {
  stageRef: React.RefObject<Konva.Stage | null>;
  activeToolId: string | null;

  // SmartGuides / snapping
  snapper?: (node: Konva.Node, evt: Konva.KonvaEventObject<DragEvent>) => SnapResult | void;
  guides?: GuidesAPI;
}

export interface UseCanvasEventManagerApi {
  registerTool: (id: string, handler: ToolEventHandler, priority?: number) => void;
  unregisterTool: (id: string) => void;
  setActiveTool: (id: string | null) => void;
  setToolPriority: (id: string, priority: number) => void;
  delegate: <T extends keyof ToolEventHandler>(type: T, ev: AnyKonvaEvent | KeyboardEvent) => boolean;
}

export default function useCanvasEventManager(
  params: UseCanvasEventManagerParams
): UseCanvasEventManagerApi {
  const managerRef = useRef<LocalCanvasEventManager | null>(null);
  if (!managerRef.current) managerRef.current = new LocalCanvasEventManager();

  // Keep active tool in sync
  useEffect(() => {
    if (managerRef.current) {
      managerRef.current.setActiveTool(params.activeToolId ?? null);
    }
  }, [params.activeToolId]);

  // Stage listeners + drag snapping routing
  useEffect(() => {
    const stage = params.stageRef.current;
    const mgr = managerRef.current;
    if (!stage || !mgr) return;

    // Pointer-first
    const onPD = (e: AnyKonvaEvent) => mgr.delegateEvent('onPointerDown', e);
    const onPM = (e: AnyKonvaEvent) => mgr.delegateEvent('onPointerMove', e);
    const onPU = (e: AnyKonvaEvent) => mgr.delegateEvent('onPointerUp', e);

    // Mouse fallbacks
    const onClick = (e: AnyKonvaEvent) => mgr.delegateEvent('onClick', e);
    const onMD = (e: AnyKonvaEvent) => mgr.delegateEvent('onMouseDown', e);
    const onMM = (e: AnyKonvaEvent) => mgr.delegateEvent('onMouseMove', e);
    const onMU = (e: AnyKonvaEvent) => mgr.delegateEvent('onMouseUp', e);

    // Context menu
    const onContextMenu = (e: AnyKonvaEvent) => mgr.delegateEvent('onContextMenu', e);

    // Wheel
    const onWheel = (e: AnyKonvaEvent) => mgr.delegateEvent('onWheel', e);

    // Drag / SmartGuides
    const onDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
      params.guides?.clear();
      // also delegate to tools if needed
      mgr.delegateEvent('onPointerDown', e);
    };

    const onDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target as Konva.Node;
      if (params.snapper) {
        const res = params.snapper(node, e);
        if (res) {
          // Prefer absolute position for groups/complex snapping
          const abs = node.getAbsolutePosition();
          node.absolutePosition({
            x: res.x ?? abs.x,
            y: res.y ?? abs.y,
          });
          if (res.guides && res.guides.length > 0) {
            params.guides?.draw(res.guides);
          } else {
            params.guides?.clear();
          }
        }
      }
    };

    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      params.guides?.clear();
      mgr.delegateEvent('onPointerUp', e);
    };

    // Register
    stage.on('pointerdown', onPD);
    stage.on('pointermove', onPM);
    stage.on('pointerup', onPU);

    stage.on('click', onClick);
    stage.on('mousedown', onMD);
    stage.on('mousemove', onMM);
    stage.on('mouseup', onMU);

    stage.on('contextmenu', onContextMenu);
    stage.on('wheel', onWheel);

    stage.on('dragstart', onDragStart);
    stage.on('dragmove', onDragMove);
    stage.on('dragend', onDragEnd);

    // Keyboard at window level
    const onKeyDown = (e: KeyboardEvent) => mgr.delegateEvent('onKeyDown', e);
    const onKeyUp = (e: KeyboardEvent) => mgr.delegateEvent('onKeyUp', e);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      stage.off('pointerdown', onPD);
      stage.off('pointermove', onPM);
      stage.off('pointerup', onPU);
      stage.off('click', onClick);
      stage.off('mousedown', onMD);
      stage.off('mousemove', onMM);
      stage.off('mouseup', onMU);
      stage.off('contextmenu', onContextMenu);
      stage.off('wheel', onWheel);

      stage.off('dragstart', onDragStart);
      stage.off('dragmove', onDragMove);
      stage.off('dragend', onDragEnd);

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [params]);

  return useMemo<UseCanvasEventManagerApi>(
    () => ({
      registerTool: (id, handler, priority = 0) => managerRef.current?.registerTool(id, handler, priority),
      unregisterTool: (id) => managerRef.current?.unregisterTool(id),
      setActiveTool: (id) => managerRef.current?.setActiveTool(id),
      setToolPriority: (id, p) => managerRef.current?.setPriority(id, p),
      delegate: (type, ev) => managerRef.current?.delegateEvent(type, ev) ?? false,
    }),
    []
  );
}