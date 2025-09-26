// ToolManager for coordinating all canvas tools
// Integrates with the unified store and four-layer architecture

import type React from "react";
import type Konva from "konva";
import type { UnifiedCanvasStore } from "../stores/unifiedCanvasStore";

// New CanvasTool interface for tools that need direct Konva event binding
export interface CanvasTool {
  attach(stage: Konva.Stage, layer: Konva.Layer): void;
  detach(): void;
  name: string;
}

// Tool instance interface
export interface ToolInstance {
  component: React.ComponentType<ToolProps>;
  stageRef: React.RefObject<Konva.Stage>;
  initialized: boolean;
}

// Import all tool components and their prop types
import { TableTool, type TableToolProps } from "../components/tools/content/TableTool";
import { TextTool, type TextToolProps } from "../components/tools/content/TextTool";
import { ImageTool, type ImageToolProps } from "../components/tools/content/ImageTool";
import { MindmapTool, type MindmapToolProps } from "../components/tools/content/MindmapTool";
import { PenTool, type PenToolProps } from "../components/tools/drawing/PenTool";
import MarkerTool, { type MarkerToolProps } from "../components/tools/drawing/MarkerTool";
import HighlighterTool, { type HighlighterToolProps } from "../components/tools/drawing/HighlighterTool";
import EraserTool, { type EraserToolProps } from "../components/tools/drawing/EraserTool";
import { CircleTool, type CircleToolProps } from "../components/tools/shapes/CircleTool";
// RectangleTool and TriangleTool have been archived as they are no longer used
import StickyNoteTool, { type StickyNoteToolProps } from "../components/tools/creation/StickyNoteTool";
import { ConnectorTool, type ConnectorToolProps } from "../components/tools/creation/ConnectorTool";

// Union type for all tool props
type ToolProps =
  | TableToolProps
  | TextToolProps
  | PenToolProps
  | MarkerToolProps
  | HighlighterToolProps
  | EraserToolProps
  | ImageToolProps
  | MindmapToolProps
  | CircleToolProps
  | StickyNoteToolProps
  | ConnectorToolProps;

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: "navigation" | "content" | "drawing" | "shapes" | "creation";
  component?: React.ComponentType<ToolProps>;
  cursor: string;
  shortcut?: string;
}

export interface ToolManagerOptions {
  stage: Konva.Stage;
  mainLayer: Konva.Layer;
  store: UnifiedCanvasStore;
}

export class ToolManager {
  private readonly stage: Konva.Stage;
  private readonly mainLayer: Konva.Layer;
  private readonly store: UnifiedCanvasStore;
  private readonly toolInstances = new Map<string, ToolInstance>();
  private activeCanvasTool: CanvasTool | null = null;
  private _keyboardCleanup?: () => void;

  // Tool registry with all available tools
  private tools: Record<string, ToolDefinition> = {
    select: {
      id: "select",
      name: "Select",
      description: "Select and move objects",
      category: "navigation",
      cursor: "default",
      shortcut: "V",
    },
    pan: {
      id: "pan",
      name: "Pan",
      description: "Pan around the canvas",
      category: "navigation",
      cursor: "grab",
      shortcut: "H",
    },
    table: {
      id: "table",
      name: "Table",
      description: "Create tables",
      category: "content",
      component: TableTool,
      cursor: "crosshair",
      shortcut: "T",
    },
    text: {
      id: "text",
      name: "Text",
      description: "Add text",
      category: "content",
      component: TextTool,
      cursor: "text",
      shortcut: "T",
    },
    "sticky-note": {
      id: "sticky-note",
      name: "Sticky Note",
      description: "Add sticky notes",
      category: "creation",
      component: StickyNoteTool,
      cursor: "crosshair",
      shortcut: "S",
    },
    pen: {
      id: "pen",
      name: "Pen",
      description: "Draw with pen",
      category: "drawing",
      component: PenTool,
      cursor: "crosshair",
      shortcut: "P",
    },
    marker: {
      id: "marker",
      name: "Marker",
      description: "Draw with marker",
      category: "drawing",
      component: MarkerTool,
      cursor: "crosshair",
      shortcut: "M",
    },
    highlighter: {
      id: "highlighter",
      name: "Highlighter",
      description: "Highlight content",
      category: "drawing",
      component: HighlighterTool,
      cursor: "crosshair",
      shortcut: "G",
    },
    // Rectangle and Triangle tools have been archived as they are no longer used
    line: {
      id: "line",
      name: "Line",
      description: "Draw straight lines",
      category: "shapes",
      component: ConnectorTool,
      cursor: "crosshair",
      shortcut: "L",
    },
    arrow: {
      id: "arrow",
      name: "Arrow",
      description: "Draw arrows",
      category: "shapes",
      component: ConnectorTool,
      cursor: "crosshair",
      shortcut: "A",
    },
    "connector-line": {
      id: "connector-line",
      name: "Connector Line",
      description: "Create connector lines",
      category: "shapes",
      component: ConnectorTool,
      cursor: "crosshair",
      shortcut: "N",
    },
    "connector-arrow": {
      id: "connector-arrow",
      name: "Connector Arrow",
      description: "Create connector arrows",
      category: "shapes",
      component: ConnectorTool,
      cursor: "crosshair",
      shortcut: "W",
    },
    "draw-circle": {
      id: "draw-circle",
      name: "Circle",
      description: "Draw circles",
      category: "shapes",
      component: CircleTool,
      cursor: "crosshair",
      shortcut: "C",
    },
    eraser: {
      id: "eraser",
      name: "Eraser",
      description: "Erase content",
      category: "drawing",
      component: EraserTool,
      cursor: "crosshair",
      shortcut: "E",
    },
    image: {
      id: "image",
      name: "Image",
      description: "Add images",
      category: "content",
      component: ImageTool,
      cursor: "crosshair",
      shortcut: "I",
    },
    mindmap: {
      id: "mindmap",
      name: "Mindmap",
      description: "Create mindmaps",
      category: "content",
      component: MindmapTool,
      cursor: "crosshair",
      shortcut: "D",
    },
    comment: {
      id: "comment",
      name: "Comment",
      description: "Add comments",
      category: "creation",
      cursor: "crosshair",
      shortcut: "O",
    },
  };

  constructor({ stage, mainLayer, store }: ToolManagerOptions) {
    this.stage = stage;
    this.mainLayer = mainLayer;
    this.store = store;

    // Initialize tool instances for tools with components
    this.initializeTools();

    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private initializeTools() {
    // Create refs for tool components that need stage access
    const stageRef = { current: this.stage };

    Object.values(this.tools).forEach((tool) => {
      if (tool.component) {
        // For now, we'll create tool instances when they're first activated
        // This is more efficient than creating all tools upfront
        this.toolInstances.set(tool.id, {
          component: tool.component,
          stageRef,
          initialized: false,
        });
      }
    });
  }

  private setupKeyboardShortcuts() {
    const container = this.stage.container();
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if no input is focused
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const tool = Object.values(this.tools).find(
        (t) => t.shortcut && t.shortcut.toLowerCase() === key,
      );

      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.activateTool(tool.id);
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    // Store cleanup function
    this._keyboardCleanup = () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }

  public activateTool(toolId: string) {
    const tool = this.tools[toolId];
    if (!tool) {
      // Warning: Unknown tool
      return;
    }

    // Detach previous canvas tool if any
    if (this.activeCanvasTool) {
      this.activeCanvasTool.detach();
      this.activeCanvasTool = null;
    }

    // Update store
    this.store.ui?.setSelectedTool?.(toolId);

    // Update cursor
    const container = this.stage.container();
    if (container) {
      container.style.cursor = tool.cursor;
    }

    // Handle tool-specific activation
    this.handleToolActivation(toolId);
  }

  private handleToolActivation(toolId: string) {
    const tool = this.tools[toolId];

    // For navigation tools (select, pan), we handle them directly
    if (tool.category === "navigation") {
      this.handleNavigationTool(toolId);
      return;
    }

    // For tools with React components, they handle their own activation through hooks
    // The components watch for store changes and activate/deactivate accordingly

    // Check if this tool has a canvas tool implementation
    const canvasTool = this.toolInstances.get(toolId + '_canvas') as unknown as CanvasTool;
    if (canvasTool) {
      this.activateCanvasTool(toolId);
    }
  }

  private handleNavigationTool(toolId: string) {
    switch (toolId) {
      case "select":
        // Enable selection interactions
        this.stage.draggable(false);
        break;
      case "pan":
        // Enable pan mode
        this.stage.draggable(true);
        break;
    }
  }

  public getTool(toolId: string): ToolDefinition | undefined {
    return this.tools[toolId];
  }

  public getAllTools(): ToolDefinition[] {
    return Object.values(this.tools);
  }

  public getToolsByCategory(
    category: ToolDefinition["category"],
  ): ToolDefinition[] {
    return Object.values(this.tools).filter(
      (tool) => tool.category === category,
    );
  }

  public registerTool(tool: ToolDefinition) {
    this.tools[tool.id] = tool;

    if (tool.component) {
      const stageRef = { current: this.stage };
      this.toolInstances.set(tool.id, {
        component: tool.component,
        stageRef,
        initialized: false,
      });
    }
  }

  public unregisterTool(toolId: string) {
    delete this.tools[toolId];
    this.toolInstances.delete(toolId);
  }

  public destroy() {
    // Detach active canvas tool
    if (this.activeCanvasTool) {
      this.activeCanvasTool.detach();
      this.activeCanvasTool = null;
    }

    // Cleanup keyboard shortcuts
    if (this._keyboardCleanup) {
      this._keyboardCleanup();
    }

    // Clear tool instances
    this.toolInstances.clear();
  }

  // Method to register canvas tools that implement CanvasTool interface
  public registerCanvasTool(toolId: string, tool: CanvasTool) {
    this.toolInstances.set(toolId + '_canvas', tool as unknown as ToolInstance);
  }

  // Method to activate a canvas tool
  public activateCanvasTool(toolId: string) {
    const tool = this.toolInstances.get(toolId + '_canvas') as unknown as CanvasTool;
    if (tool) {
      if (this.activeCanvasTool) {
        this.activeCanvasTool.detach();
      }
      this.activeCanvasTool = tool;
      tool.attach(this.stage, this.mainLayer);
    }
  }

  // Get current active canvas tool
  public getActiveCanvasTool(): CanvasTool | null {
    return this.activeCanvasTool;
  }
}

export default ToolManager;
