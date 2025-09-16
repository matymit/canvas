# Spatial Utilities and Canvas Monitoring Examples

This directory contains examples showing integration of the new spatial utilities and canvas monitoring with the existing Canvas architecture.

## 🗂️ **New Components Added**

### **Spatial Utilities** (`features/canvas/utils/spatial/`)
- **`spatialQuadTree.ts`** - Generic QuadTree for spatial queries and collision detection
- **`simpleEraserIndex.ts`** - Optimized spatial hash for eraser tool stroke indexing

### **Canvas Monitoring** (`features/canvas/monitoring/`)
- **`canvasMonitor.ts`** - Lightweight performance monitor for Konva stages and layers

## 🎯 **Integration with Project Architecture**

These components align perfectly with project memories:

✅ **Performance Optimization Strategy** - RAF batching, `listening=false`, `perfectDrawEnabled=false`  
✅ **Tool-Specific Drawing Defaults** - Supports pen, marker, highlighter, eraser composite operations  
✅ **Shape Caching Utilities** - Works with complexity-based caching thresholds  
✅ **Event-Driven Tool System** - Priority delegation for tool event handling  
✅ **Element Management Pattern** - O(1) lookups with draw order control  
✅ **Four-Layer Architecture** - background/main/preview/overlay with FastLayer insertion  

## 📊 **Usage Examples**

### **Spatial QuadTree for Viewport Culling**
```typescript
import { QuadTree } from 'features/canvas/utils/spatial';

const quadTree = new QuadTree<CanvasElement>(
  { x: 0, y: 0, width: 1920, height: 1080 },
  {
    maxElements: 8,
    maxDepth: 6,
    getBounds: (element) => element.bounds
  }
);

// Insert elements
elements.forEach(el => quadTree.insert(el));

// Query viewport for culling
const visibleElements = quadTree.queryRange(viewportBounds);
```

### **Eraser Index for Fast Stroke Deletion**
```typescript
import { SimpleEraserIndex } from 'features/canvas/utils/spatial';

const eraserIndex = new SimpleEraserIndex(64); // 64px grid cells

// Add strokes during drawing
eraserIndex.addStroke({
  strokeId: 'stroke_123',
  points: [x1, y1, x2, y2, x3, y3], // flat array
  strokeWidth: 3
});

// Fast eraser queries
const affectedStrokes = eraserIndex.queryCircleStrokeIds(
  mouseX, mouseY, eraserRadius
);
```

### **Canvas Performance Monitoring**
```typescript
import { CanvasMonitor } from 'features/canvas/monitoring';

const monitor = new CanvasMonitor({
  sampleIntervalMs: 250,
  instrumentLayerDraws: true,
  countNodes: true,
  collectMemory: true
});

monitor.attachStage(stage);
monitor.attachLayers([bgLayer, mainLayer, previewLayer, overlayLayer]);

monitor.subscribe((metrics) => {
  console.log(`FPS: ${metrics.fps}, Frame: ${metrics.frameMs}ms`);
  
  // Performance warnings
  if (metrics.fps < 55) {
    console.warn('Performance degradation detected');
  }
});

monitor.start();
```

## 🔧 **Performance Benefits**

🎯 **Spatial Indexing**: O(log n) queries instead of O(n) for viewport culling and hit testing  
⚡ **Eraser Optimization**: Grid-based indexing for rapid stroke candidate retrieval  
📊 **Layer Monitoring**: Direct draw() timing without react-konva overhead  
🎨 **RAF Integration**: Works seamlessly with existing EmergencyRafBatcher  
💾 **Memory Efficiency**: Allocation-conscious spatial structures  

## 🚀 **Integration Points**

### **With RAF Manager**
The spatial utilities work with the existing useRAFManager hook for batched updates:

```typescript
// Batch spatial index updates with RAF
rafManager.enqueueWrite(() => {
  quadTree.update(movedElement);
  eraserIndex.updateStroke(modifiedStroke);
});
```

### **With Canvas Tools**
Eraser and selection tools can leverage spatial indexing:

```typescript
// In eraser tool
const candidates = eraserIndex.queryCircleStrokeIds(x, y, radius);
candidates.forEach(strokeId => deleteStroke(strokeId));

// In selection tool  
const selectableElements = quadTree.queryRange(selectionRect);
```

### **With Four-Layer System**
Monitor integrates with the background/main/preview/overlay architecture:

```typescript
monitor.attachLayers([
  layers.background,  // Static content caching
  layers.main,        // Primary canvas content
  layers.preview,     // Tool preview/feedback
  layers.overlay      // UI overlays and HUD
]);
```

The spatial utilities and monitoring components provide enterprise-grade performance optimizations that complement the existing Canvas architecture while maintaining the "no react-konva" constraint and vanilla Konva integration pattern.