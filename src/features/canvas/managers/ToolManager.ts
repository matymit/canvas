// ToolManager for coordinating all canvas tools
// Integrates with the unified store and four-layer architecture

import React from 'react';
import Konva from 'konva';
import type { UnifiedCanvasStore } from '../stores/unifiedCanvasStore';

// Import all tool components
import { TableTool } from '../components/tools/content/TableTool';
import { TextTool } from '../components/tools/content/TextTool';
import { PenTool } from '../components/tools/drawing/PenTool';
import { MarkerTool } from '../components/tools/drawing/MarkerTool';
import { HighlighterTool } from '../components/tools/drawing/HighlighterTool';
import { RectangleTool } from '../components/tools/shapes/RectangleTool';
import { TriangleTool } from '../components/tools/shapes/TriangleTool';
import { ConnectorTool } from '../components/tools/creation/ConnectorTool';
import { StickyNoteTool } from '../components/tools/creation/StickyNoteTool';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: 'navigation' | 'content' | 'drawing' | 'shapes' | 'creation';
  component?: React.ComponentType<any>;
  cursor: string;
  shortcut?: string;
}

export interface ToolManagerOptions {
  stage: Konva.Stage;
  store: UnifiedCanvasStore;
}

export class ToolManager {
  private stage: Konva.Stage;
  private store: UnifiedCanvasStore;
  private toolInstances = new Map<string, any>();
  
  // Tool registry with all available tools
  private tools: Record<string, ToolDefinition> = {
    'select': {
      id: 'select',
      name: 'Select',
      description: 'Select and move objects',
      category: 'navigation',
      cursor: 'default',
      shortcut: 'V',
    },
    'pan': {
      id: 'pan',
      name: 'Pan',
      description: 'Pan around the canvas',
      category: 'navigation',
      cursor: 'grab',
      shortcut: 'H',
    },
    'table': {
      id: 'table',
      name: 'Table',
      description: 'Create tables',
      category: 'content',
      component: TableTool,
      cursor: 'crosshair',
      shortcut: 'T',
    },
    'text': {
      id: 'text',
      name: 'Text',
      description: 'Add text',
      category: 'content',
      component: TextTool,
      cursor: 'text',
      shortcut: 'T',
    },
    'sticky-note': {
      id: 'sticky-note',
      name: 'Sticky Note',
      description: 'Add sticky notes',
      category: 'creation',
      component: StickyNoteTool,
      cursor: 'crosshair',
      shortcut: 'S',
    },
    'pen': {
      id: 'pen',
      name: 'Pen',
      description: 'Draw with pen',
      category: 'drawing',
      component: PenTool,
      cursor: 'crosshair',
      shortcut: 'P',
    },
    'marker': {
      id: 'marker',
      name: 'Marker',
      description: 'Draw with marker',
      category: 'drawing',
      component: MarkerTool,
      cursor: 'crosshair',
      shortcut: 'M',
    },
    'highlighter': {
      id: 'highlighter',
      name: 'Highlighter',
      description: 'Highlight content',
      category: 'drawing',
      component: HighlighterTool,
      cursor: 'crosshair',
      shortcut: 'L',
    },
    'draw-rectangle': {
      id: 'draw-rectangle',
      name: 'Rectangle',
      description: 'Draw rectangles',
      category: 'shapes',
      component: RectangleTool,
      cursor: 'crosshair',
      shortcut: 'R',
    },
    'draw-triangle': {
      id: 'draw-triangle',
      name: 'Triangle',
      description: 'Draw triangles',
      category: 'shapes',
      component: TriangleTool,
      cursor: 'crosshair',
      shortcut: 'A',
    },
    'connector-line': {
      id: 'connector-line',
      name: 'Connector',
      description: 'Connect elements',
      category: 'creation',
      component: ConnectorTool,
      cursor: 'crosshair',
      shortcut: 'C',
    },
    'comment': {
      id: 'comment',
      name: 'Comment',
      description: 'Add comments',
      category: 'creation',
      cursor: 'crosshair',
      shortcut: 'O',
    },
  };

  constructor({ stage, store }: ToolManagerOptions) {
    this.stage = stage;
    this.store = store;
    
    // Initialize tool instances for tools with components
    this.initializeTools();
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private initializeTools() {
    // Create refs for tool components that need stage access
    const stageRef = { current: this.stage };
    
    Object.values(this.tools).forEach(tool => {
      if (tool.component) {
        // For now, we'll create tool instances when they're first activated
        // This is more efficient than creating all tools upfront
        this.toolInstances.set(tool.id, {
          component: tool.component,
          stageRef,
          initialized: false
        });
      }
    });
  }

  private setupKeyboardShortcuts() {
    const container = this.stage.container();
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if no input is focused
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const tool = Object.values(this.tools).find(t => 
        t.shortcut && t.shortcut.toLowerCase() === key
      );

      if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.activateTool(tool.id);
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Store cleanup function
    (this as any)._keyboardCleanup = () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  public activateTool(toolId: string) {
    const tool = this.tools[toolId];
    if (!tool) {
      console.warn(`Unknown tool: ${toolId}`);
      return;
    }

    // Update store
    this.store.setSelectedTool(toolId);

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
    if (tool.category === 'navigation') {
      this.handleNavigationTool(toolId);
      return;
    }

    // For tools with React components, they handle their own activation through hooks
    // The components watch for store changes and activate/deactivate accordingly
  }

  private handleNavigationTool(toolId: string) {
    switch (toolId) {
      case 'select':
        // Enable selection interactions
        this.stage.draggable(false);
        break;
      case 'pan':
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

  public getToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return Object.values(this.tools).filter(tool => tool.category === category);
  }

  public registerTool(tool: ToolDefinition) {
    this.tools[tool.id] = tool;
    
    if (tool.component) {
      const stageRef = { current: this.stage };
      this.toolInstances.set(tool.id, {
        component: tool.component,
        stageRef,
        initialized: false
      });
    }
  }

  public unregisterTool(toolId: string) {
    delete this.tools[toolId];
    this.toolInstances.delete(toolId);
  }

  public destroy() {
    // Cleanup keyboard shortcuts
    if ((this as any)._keyboardCleanup) {
      (this as any)._keyboardCleanup();
    }

    // Clear tool instances
    this.toolInstances.clear();
  }
}

export default ToolManager;