# Canvas API Reference

This document provides API documentation for key Canvas interfaces, components, and utilities.

## Core Store Modules

### UnifiedCanvasStore

The central Zustand store managing all application state.

```typescript
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

const store = useUnifiedCanvasStore();
```

#### Element Module (`store.element`)

Manages canvas elements with CRUD operations.

```typescript
// Get element by ID
const element = store.element.getById(elementId: ElementId): CanvasElement | undefined

// Get multiple elements by IDs
const elements = store.element.getByIds(ids: ElementId[]): CanvasElement[]

// Add or update element
store.element.upsert(element: CanvasElement): void

// Update element properties
store.element.update(id: ElementId, patch: Partial<CanvasElement>): void

// Delete element
store.element.delete(id: ElementId): void

// Duplicate element
store.element.duplicate(id: ElementId): ElementId

// Get all elements as array
const elements = store.element.getAllElements(): CanvasElement[]

// Get element order for rendering
const order = store.element.getElementOrder(): ElementId[]
```

#### History Module (`store.history`)

Provides undo/redo functionality with transaction batching.

```typescript
// Execute operation with undo support
store.history.withUndo(description: string, mutator: () => void): void

// Undo last operation
store.history.undo(): void

// Redo next operation
store.history.redo(): void

// Check if undo/redo available
const canUndo = store.history.canUndo(): boolean
const canRedo = store.history.canRedo(): boolean

// Batch multiple operations
store.history.beginBatch(): void
store.history.endBatch(description: string): void

// Get history state
const history = store.history.getHistory(): { past: StateSnapshot[], future: StateSnapshot[] }
```

#### Selection Module (`store.selection`)

Manages element selection state.

```typescript
// Select single element
store.selection.selectOne(id: ElementId, additive?: boolean): void

// Select multiple elements
store.selection.selectMany(ids: ElementId[]): void

// Clear selection
store.selection.clearSelection(): void

// Toggle element selection
store.selection.toggle(id: ElementId): void

// Get selected elements
const selected = store.selection.getSelectedIds(): Set<ElementId>

// Check if element is selected
const isSelected = store.selection.isSelected(id: ElementId): boolean
```

#### Viewport Module (`store.viewport`)

Controls pan, zoom, and coordinate transformations.

```typescript
// Set viewport position
store.viewport.setPan(x: number, y: number): void

// Set zoom level
store.viewport.setScale(scale: number): void

// Get viewport state
const viewport = store.viewport.getViewport(): ViewportState

// Coordinate transformations
const stagePoint = store.viewport.worldToStage(worldX: number, worldY: number): Point
const worldPoint = store.viewport.stageToWorld(stageX: number, stageY: number): Point

// Fit content in viewport
store.viewport.fitToContent(): void

// Reset viewport to default
store.viewport.resetView(): void
```

#### UI Module (`store.ui`)

Manages UI state including active tools and settings.

```typescript
// Set active tool
store.ui.setActiveTool(toolType: ToolType): void

// Get active tool
const activeTool = store.ui.getActiveTool(): ToolType

// Set tool options
store.ui.setToolOptions(toolType: ToolType, options: ToolOptions): void

// Get tool options
const options = store.ui.getToolOptions(toolType: ToolType): ToolOptions
```

## Core Types

### Canvas Elements

Base element interface extended by all canvas elements:

```typescript
interface CanvasElement {
  id: ElementId;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  created: number;
  modified: number;
}
```

### Element Types

```typescript
type ElementType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'line'
  | 'text'
  | 'image'
  | 'sticky-note'
  | 'table'
  | 'mindmap-node'
  | 'connector';
```

### Drawing Elements

```typescript
interface DrawingElement extends CanvasElement {
  type: 'drawing';
  strokeColor: string;
  strokeWidth: number;
  points: number[];
  drawingType: 'pen' | 'marker' | 'highlighter';
}
```

### Shape Elements

```typescript
interface ShapeElement extends CanvasElement {
  type: 'rectangle' | 'circle' | 'triangle';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashArray?: number[];
  cornerRadius?: number; // for rectangles
}
```

### Text Elements

```typescript
interface TextElement extends CanvasElement {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  fill: string;
  lineHeight?: number;
}
```

### Table Elements

```typescript
interface TableElement extends CanvasElement {
  type: 'table';
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  cells: TableCell[][];
  borderColor: string;
  borderWidth: number;
}

interface TableCell {
  text: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
}
```

### Connector Elements

```typescript
interface ConnectorElement extends CanvasElement {
  type: 'connector';
  connectorType: 'line' | 'arrow';
  startPoint: ConnectorEndpoint;
  endPoint: ConnectorEndpoint;
  strokeColor: string;
  strokeWidth: number;
  strokeDashArray?: number[];
}

type ConnectorEndpoint =
  | ConnectorEndpointPoint
  | ConnectorEndpointElement;

interface ConnectorEndpointPoint {
  type: 'point';
  x: number;
  y: number;
}

interface ConnectorEndpointElement {
  type: 'element';
  elementId: ElementId;
  anchor: AnchorSide;
}

type AnchorSide = 'left' | 'right' | 'top' | 'bottom' | 'center';
```

## Tool System

### Tool Interface

All tools implement the `ToolEventHandler` interface:

```typescript
interface ToolEventHandler {
  toolType: ToolType;
  priority: number;

  onPointerDown?(event: KonvaEventObject<PointerEvent>): boolean;
  onPointerMove?(event: KonvaEventObject<PointerEvent>): boolean;
  onPointerUp?(event: KonvaEventObject<PointerEvent>): boolean;
  onKeyDown?(event: KeyboardEvent): boolean;
  onKeyUp?(event: KeyboardEvent): boolean;

  cleanup?(): void;
}
```

### Creating Custom Tools

```typescript
import { ToolEventHandler } from '@features/canvas/types/tools';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

class CustomTool implements ToolEventHandler {
  toolType = 'custom' as const;
  priority = 1;

  private store = useUnifiedCanvasStore.getState();

  onPointerDown(event: KonvaEventObject<PointerEvent>): boolean {
    // Handle pointer down
    return true; // Return true if event was handled
  }

  onPointerMove(event: KonvaEventObject<PointerEvent>): boolean {
    // Handle pointer move
    return false; // Return false to allow other handlers
  }

  onPointerUp(event: KonvaEventObject<PointerEvent>): boolean {
    // Handle pointer up, commit element to store
    this.store.history.withUndo('Create custom element', () => {
      this.store.element.upsert(newElement);
    });
    return true;
  }

  cleanup(): void {
    // Clean up resources, remove event listeners
  }
}
```

## Renderer Modules

### Renderer Interface

Renderer modules handle element-specific rendering logic:

```typescript
interface RendererModule {
  type: ElementType;
  mount(stage: Konva.Stage, layers: CanvasLayers): void;
  unmount(): void;
  handleElementUpdate(element: CanvasElement): void;
  handleElementDelete(elementId: ElementId): void;
}
```

### Creating Custom Renderers

```typescript
import { RendererModule } from '@features/canvas/renderer/types';
import { useUnifiedCanvasStore } from '@features/canvas/stores/unifiedCanvasStore';

class CustomRenderer implements RendererModule {
  type = 'custom' as const;

  private store = useUnifiedCanvasStore.getState();
  private unsubscribe?: () => void;
  private konvaNodes = new Map<ElementId, Konva.Node>();

  mount(stage: Konva.Stage, layers: CanvasLayers): void {
    // Subscribe to store changes
    this.unsubscribe = this.store.element.subscribe(
      (state) => state.elements,
      (elements) => this.reconcileElements(elements),
      { equalityFn: shallow }
    );
  }

  unmount(): void {
    this.unsubscribe?.();
    this.konvaNodes.clear();
  }

  private reconcileElements(elements: Map<ElementId, CanvasElement>): void {
    // Handle element updates, additions, deletions
    elements.forEach((element) => {
      if (element.type === 'custom') {
        this.renderElement(element);
      }
    });

    layers.main.batchDraw();
  }

  private renderElement(element: CustomElement): void {
    // Create or update Konva node for element
    let node = this.konvaNodes.get(element.id);
    if (!node) {
      node = new Konva.Rect({
        id: element.id,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        // ... other properties
      });
      this.konvaNodes.set(element.id, node);
      layers.main.add(node);
    } else {
      // Update existing node
      node.setAttrs({
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      });
    }
  }
}
```

## Utility Functions

### Canvas Utilities

```typescript
import {
  getElementBounds,
  getElementCenter,
  isPointInElement,
  getElementsInRect
} from '@features/canvas/utils/geometry';

// Get element bounding box
const bounds = getElementBounds(element: CanvasElement): Bounds

// Get element center point
const center = getElementCenter(element: CanvasElement): Point

// Test if point is inside element
const isInside = isPointInElement(point: Point, element: CanvasElement): boolean

// Get elements intersecting rectangle
const elements = getElementsInRect(rect: Rect, elements: CanvasElement[]): CanvasElement[]
```

### Drawing Utilities

```typescript
import {
  createStrokePath,
  smoothPath,
  decimatePath
} from '@features/canvas/utils/drawing';

// Create stroke path from points
const path = createStrokePath(points: number[], strokeWidth: number): string

// Smooth path using curves
const smoothed = smoothPath(points: number[]): number[]

// Reduce point density
const decimated = decimatePath(points: number[], minDistance: number): number[]
```

### Performance Utilities

```typescript
import {
  batchedRAF,
  RafBatcher
} from '@features/canvas/utils/performance/RafBatcher';

// Batch operation in next animation frame
batchedRAF(() => {
  layer.batchDraw();
});

// Create RAF batcher for multiple operations
const batcher = new RafBatcher();
batcher.schedule(() => {
  // Batched operation
});
```

## Event Management

### Event Manager

```typescript
import { useCanvasEventManager } from '@features/canvas/hooks/useCanvasEventManager';

const eventManager = useCanvasEventManager(stage, layers);

// Register tool
eventManager.registerTool(tool: ToolEventHandler);

// Unregister tool
eventManager.unregisterTool(toolType: ToolType);

// Set active tool
eventManager.setActiveTool(toolType: ToolType);
```

### Custom Event Handling

```typescript
// Listen for custom canvas events
stage.on('elementCreated', (event) => {
  const element = event.detail;
  // Handle element creation
});

// Dispatch custom events
stage.fire('customEvent', { detail: customData });
```

## Hooks

### Canvas Hooks

```typescript
import {
  useCanvasStore,
  useCanvasSelection,
  useCanvasViewport,
  useCanvasHistory
} from '@features/canvas/hooks';

// Access store with selectors
const elements = useCanvasStore(state => state.elements);

// Selection management
const { selectedIds, selectElement, clearSelection } = useCanvasSelection();

// Viewport controls
const { viewport, setPan, setScale, fitToContent } = useCanvasViewport();

// History operations
const { undo, redo, canUndo, canRedo } = useCanvasHistory();
```

## Constants and Configuration

### Layer Configuration

```typescript
import { LAYER_CONFIG } from '@features/canvas/constants/layers';

const config = {
  BACKGROUND_LAYER: 0,
  MAIN_LAYER: 1,
  PREVIEW_LAYER: 2,
  OVERLAY_LAYER: 3,
  MAX_LAYERS: 4
};
```

### Performance Budgets

```typescript
import { PERFORMANCE_BUDGETS } from '@features/canvas/constants/performance';

const budgets = {
  MAX_FPS: 60,
  MAX_FRAME_TIME_MS: 16.67,
  MAX_MEMORY_MB: 500,
  MAX_NODES_PER_LAYER: 1000
};
```

### Tool Types

```typescript
import { TOOL_TYPES } from '@features/canvas/constants/tools';

const tools = {
  SELECT: 'select',
  PAN: 'pan',
  PEN: 'pen',
  MARKER: 'marker',
  HIGHLIGHTER: 'highlighter',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TEXT: 'text',
  // ... more tools
};
```

## Error Handling

### Error Boundaries

```typescript
import { CanvasErrorBoundary } from '@features/canvas/components/CanvasErrorBoundary';

// Wrap canvas components
<CanvasErrorBoundary>
  <CanvasComponent />
</CanvasErrorBoundary>
```

### Error Utilities

```typescript
import {
  handleCanvasError,
  logPerformanceWarning,
  reportMemoryUsage
} from '@features/canvas/utils/errors';

// Handle and log canvas errors
try {
  // Canvas operation
} catch (error) {
  handleCanvasError(error, 'Operation context');
}

// Log performance warnings
if (frameTime > 16.67) {
  logPerformanceWarning('Frame time exceeded budget', { frameTime });
}
```

## Best Practices

### Store Operations
- Always use `withUndo` for user-initiated changes
- Batch multiple operations with `beginBatch`/`endBatch`
- Use selective subscriptions to minimize re-renders

### Rendering
- Call `layer.batchDraw()` after DOM updates
- Use RAF batching for frequent updates
- Disable `listening` on static layers

### Memory Management
- Clean up event listeners in tool cleanup methods
- Remove Konva nodes when elements are deleted
- Use object pooling for frequently created objects

### Performance
- Keep layers under node count limits
- Use viewport culling for large scenes
- Cache complex shapes when possible

---

This API reference covers the core interfaces and patterns used in Canvas development. For implementation examples, see the source code and existing tool implementations.