// features/canvas/plugins/PluginArchitecture.ts

import type Konva from 'konva';

// Tool event interface, aligned with the modular system design
// See "Tool Event Interface" in the technical report.
export interface ToolEventHandler {
  // Pointer events (preferred modern path)
  onPointerDown?: (e: Konva.KonvaEventObject<PointerEvent>) => boolean;
  onPointerMove?: (e: Konva.KonvaEventObject<PointerEvent>) => boolean;
  onPointerUp?: (e: Konva.KonvaEventObject<PointerEvent>) => boolean;

  // Mouse fallback
  onMouseDown?: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  onMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  onMouseUp?: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;
  onClick?: (e: Konva.KonvaEventObject<MouseEvent>) => boolean;

  // Keyboard
  onKeyDown?: (e: KeyboardEvent) => boolean;
  onKeyUp?: (e: KeyboardEvent) => boolean;

  // Lifecycle
  canHandle?: (e: Konva.KonvaEventObject<Event> | Event) => boolean;
  priority?: number; // higher means earlier handling
}

export type CursorType =
  | 'default'
  | 'grab'
  | 'grabbing'
  | 'crosshair'
  | 'text'
  | 'move'
  | 'ns-resize'
  | 'ew-resize'
  | 'nesw-resize'
  | 'nwse-resize';

export enum PluginType {
  Tool = 'tool',
  Element = 'element',
  Export = 'export',
  Import = 'import',
  Filter = 'filter',
  Analytics = 'analytics',
  Collaboration = 'collaboration',
  AI = 'ai',
}

export interface CanvasLayers {
  background?: Konva.Layer;
  main?: Konva.Layer;
  preview?: Konva.Layer;
  overlay?: Konva.Layer;
}

export interface CanvasPluginContext {
  stage: Konva.Stage;
  layers: CanvasLayers;
  dpr: number;
  // Optionally wire to a store facade; use unknown to avoid tight coupling
  getState?: () => unknown;
  dispatch?: (action: Record<string, unknown>) => void;
  // Simple publish/subscribe for inter-plugin communication
  bus: PluginBus;
}

export interface CanvasPlugin {
  id: string;
  name: string;
  version: string;
  type: PluginType;

  // Called when the plugin is enabled and context is ready
  init?: (ctx: CanvasPluginContext) => void | Promise<void>;
  // Called when the plugin is being disabled/unregistered
  dispose?: () => void | Promise<void>;
}

export interface ToolPlugin extends CanvasPlugin {
  type: PluginType.Tool;
  cursor?: CursorType;
  shortcuts?: string[]; // e.g., ['p'] for pen
  category?: 'basic' | 'drawing' | 'shape' | 'connector' | 'content' | 'advanced';
  eventHandler: ToolEventHandler;
}

type AnyPlugin = CanvasPlugin | ToolPlugin;

export type PluginEventPayload = Record<string, unknown>;

export class PluginBus {
  private readonly listeners = new Map<string, Set<(payload: PluginEventPayload) => void>>();

  emit(event: string, payload: PluginEventPayload = {}): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        // swallow to keep bus resilient
      }
    }
  }

  on(event: string, handler: (payload: PluginEventPayload) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
      if (set && set.size === 0) this.listeners.delete(event);
    };
  }

  clearAll(): void {
    this.listeners.clear();
  }
}

export interface PluginManagerOptions {
  autoEnable?: boolean; // enable immediately upon registration if context exists
}

export class PluginManager {
  private readonly plugins = new Map<string, AnyPlugin>();
  private readonly enabled = new Set<string>();
  private context?: CanvasPluginContext;
  private readonly options: PluginManagerOptions;

  constructor(options: PluginManagerOptions = {}) {
    this.options = options;
  }

  getContext(): CanvasPluginContext | undefined {
    return this.context;
  }

  // Provide canvas context when Stage/layers are ready; init already-registered plugins
  provideContext(ctx: Omit<CanvasPluginContext, 'bus'> & { bus?: PluginBus }): void {
    const bus = ctx.bus ?? new PluginBus();
    this.context = { ...ctx, bus };
    // initialize enabled plugins that have init
    for (const id of this.enabled) {
      const plugin = this.plugins.get(id);
      if (plugin?.init) {
        plugin.init(this.context);
      }
    }
  }

  register(plugin: AnyPlugin): void {
    if (this.plugins.has(plugin.id)) return;
    this.plugins.set(plugin.id, plugin);

    const shouldEnable = this.options.autoEnable ?? true;
    if (shouldEnable) {
      this.enable(plugin.id);
    }
  }

  unregister(id: string): void {
    if (!this.plugins.has(id)) return;
    // ensure disposal if enabled
    if (this.enabled.has(id)) {
      try {
        this.plugins.get(id)?.dispose?.();
      } catch {
        // ignore
      }
      this.enabled.delete(id);
    }
    this.plugins.delete(id);
  }

  enable(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin || this.enabled.has(id)) return;
    this.enabled.add(id);
    if (this.context && plugin.init) {
      plugin.init(this.context);
    }
  }

  disable(id: string): void {
    if (!this.enabled.has(id)) return;
    try {
      this.plugins.get(id)?.dispose?.();
    } finally {
      this.enabled.delete(id);
    }
  }

  clear(): void {
    for (const id of [...this.enabled]) {
      try {
        this.plugins.get(id)?.dispose?.();
      } catch {
        // ignore
      }
      this.enabled.delete(id);
    }
    this.plugins.clear();
    this.context?.bus.clearAll();
  }

  // Aggregates active tool handlers sorted by priority, matching event delegation patterns
  getActiveToolHandlers(): Array<{ pluginId: string; handler: ToolEventHandler; priority: number }> {
    const out: Array<{ pluginId: string; handler: ToolEventHandler; priority: number }> = [];
    for (const [id, plugin] of this.plugins) {
      if (!this.enabled.has(id)) continue;
      if (plugin.type === PluginType.Tool) {
        const tool = plugin as ToolPlugin;
        const priority = tool.eventHandler.priority ?? 0;
        out.push({ pluginId: id, handler: tool.eventHandler, priority });
      }
    }
    // higher priority first
    out.sort((a, b) => b.priority - a.priority);
    return out;
  }

  // Broadcast helper for plugins to communicate
  emit(event: string, payload: PluginEventPayload = {}): void {
    this.context?.bus.emit(event, payload);
  }

  on(event: string, handler: (payload: PluginEventPayload) => void): () => void {
    if (!this.context) throw new Error('Plugin context is not provided yet');
    return this.context.bus.on(event, handler);
  }
}