# ARCHIVED COMPONENTS

This directory contains components that were archived during the Phase 1 canvas refactoring.

## Archived on: 2024-09-18

### NonReactCanvasStage.tsx
**Reason**: Unnecessary abstraction creating competing Konva.Stage instances
- Created 4-layer architecture instead of required 5 layers (missing highlighter)
- Duplicated functionality that exists in FigJamCanvas.tsx
- Caused conflicts with renderer system setup

### CanvasContainer.tsx
**Reason**: Simple wrapper that added unnecessary abstraction
- Only forwarded props without adding significant value
- Functionality integrated directly into FigJamCanvas.tsx
- Removed to simplify component hierarchy

## Context
These components were removed as part of consolidating to a single canvas implementation using FigJamCanvas.tsx only. The refactoring fixed store-renderer disconnection issues caused by multiple Konva.Stage instances and duplicate setupRenderer() calls.

See `CANVAS_COMPONENT_AUDIT.md` in project root for full analysis.