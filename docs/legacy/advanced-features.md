# Legacy: Advanced Features Implementation Plan

> Archived planning notes for pre-refactor FigJam UX parity work. This document is retained for historical reference and should not be treated as an active roadmap.

Based on my review of the existing code and the comprehensive UX requirements from the FigJam forensic analysis, I need to create a detailed list of changes required to implement the sophisticated interaction model. Let me analyze the current codebase first to understand what's already implemented.

## Required Changes to Implement FigJam UX Features

Based on my analysis of the existing modular canvas system and the comprehensive FigJam UX requirements, here are the necessary changes organized by priority:

### 1. Canvas Environment Improvements

**Grid Background Implementation**[1]
- Modify `CanvasLayerManager.ts` to add grid rendering support
- Add `GridRenderer` utility class to create the dot-grid pattern
- Implement grid density and visibility controls in viewport module

**Navigation Model Enhancements**[2][3]
- Enhance `useViewportControls.ts` to include proper cursor feedback during panning
- Add closed-hand cursor during drag operations
- Implement proper zoom controls with "+" and "–" buttons component

### 2. Selection and Manipulation System

**Transformer Integration**[4][5][2]
- Create new `TransformerManager.ts` using Konva.Transformer
- Implement selection handles with corner and midpoint resize anchors
- Add blue bounding box styling to match FigJam appearance
- Support multi-selection with Ctrl/Cmd key handling

**Auto-Sizing Behavior Implementation**[6][7]
- Modify existing shape and text tools to implement auto-grow logic
- Add text measurement utilities for dynamic container sizing
- Implement sticky note auto-sizing without changing font size

### 3. Element Creation Workflow

**Single-Click Placement**[8][7]
- Modify all tool components to support single-click element creation
- Implement default sizing for elements when created via click
- Add immediate text-edit mode entry after element creation

**Contextual Toolbars**[9]
- Create floating toolbar system that appears above selected elements
- Implement text formatting controls (size, weight, alignment, lists, links)
- Add color picker integration for dynamic styling

### 4. Advanced Drawing Features

**Highlighter Layer Management**[7][1]
- Modify `DirectKonvaDrawing.ts` to implement proper z-ordering for highlighter
- Ensure highlighter strokes render behind other elements
- Update layer management to maintain proper stacking order

**Pressure Sensitivity Support**[6]
- Enhance `DirectKonvaDrawing.ts` to support pressure-sensitive drawing
- Add width modulation based on pointer pressure when available
- Implement minimum distance filtering for point optimization

### 5. Smart Interaction Features

**Smart Alignment Guides**[10][2]
- Create `SmartGuides.ts` utility for dynamic alignment detection
- Implement snap-to-align functionality during element movement
- Add visual guide lines on the overlay layer during alignment

**Connector System Enhancement**[10][8]
- Implement automatic anchor point detection on element boundaries
- Add dynamic connector re-routing when connected elements move
- Create curved connector rendering with proper arrowheads

### 6. Performance and Polish

**Animation System**[11]
- Add subtle easing animations for element creation and transformation
- Implement smooth transitions for tool switching
- Add micro-interactions for better user feedback

**Cursor Management Enhancement**[11]
- Expand cursor system to match all tool states
- Add hover feedback for interactive elements
- Implement proper cursor changes during different interaction modes

### 7. Files That Need Creation

**New Files Required:**
- `features/canvas/components/ui/GridRenderer.ts`
- `features/canvas/components/ui/SmartGuides.ts` 
- `features/canvas/components/ui/ContextualToolbar.tsx`
- `features/canvas/components/ui/FloatingColorPicker.tsx`
- `features/canvas/managers/TransformerManager.ts`
- `features/canvas/utils/text/TextMeasurement.ts`
- `features/canvas/utils/alignment/SnapGuides.ts`
- `features/canvas/animation/ElementAnimations.ts`

### 8. Existing Files Requiring Major Updates

**Priority 1 - Critical UX Features:**
- `features/canvas/layers/CanvasLayerManager.ts` - Add grid support
- `features/canvas/hooks/useSelectionManager.ts` - Integrate transformer
- `features/canvas/components/tools/drawing/[All Tools]` - Add single-click creation
- `features/canvas/utils/DirectKonvaDrawing.ts` - Implement pressure sensitivity

**Priority 2 - Enhanced Interactions:**
- `features/canvas/hooks/useCanvasEventManager.ts` - Add smart guides integration  
- `features/canvas/hooks/useViewportControls.ts` - Enhance cursor feedback
- `src/app/pages/Canvas.tsx` - Add contextual toolbars and grid controls

**Priority 3 - Polish and Animation:**
- `features/canvas/stores/unified/CanvasStore.ts` - Add animation state
- All tool components - Add creation animations and micro-interactions

### 9. State Management Extensions

**Store Module Additions:**
- Grid state management (visibility, density, color)
- Smart guides state (active guides, snap tolerance)
- Animation state (pending animations, easing preferences)
- Contextual UI state (active floating toolbars, color pickers)

This comprehensive implementation plan will bring the canvas to full FigJam feature parity while maintaining the existing modular architecture and performance optimizations. The changes are structured to preserve existing functionality while adding the sophisticated UX features identified in the forensic analysis.[9]

Here is a clear, actionable to-do list derived from the combined FigJam UX specification and the current modular canvas codebase, grouped to minimize risk and maximize parity while staying vanilla Konva-first.[1][2]

### Canvas environment
- [ ] Add dot-grid renderer on BackgroundLayer with density, size, and color controls; expose toggles in viewport/UI state.[3][1]
- [ ] Ensure background layer is fully non-interactive and cached; apply HiDPI per-layer scaling on DPR change.[4][3]
- [ ] Enhance pan/zoom: pointer-relative zoom, pinch-zoom, and closed-hand cursor during drag; wire toolbar +/- buttons.[5][1]
- [ ] Keep UI controls (toolbar, zoom controls, header) screen-space and unaffected by stage transforms.[2][1]

### Selection & transform
- [ ] Implement TransformerManager to attach/detach Konva.Transformer to single and multi-selection with corner/mid handles.[1][2]
- [ ] Style transformer: blue bounding box, circular handles, resize-axis rules for constrained shapes.[2][1]
- [ ] Integrate with selection slice: click select, Cmd/Ctrl toggle, marquee select; keep overlay layer on top.[6][1]
- [ ] Emit transform start/change/end to history and element modules with debounced batch updates.[1][2]

### Text and auto-sizing
- [ ] Create TextMeasurement utility (offscreen canvas) for wrapping and height calculation.[2][1]
- [ ] Implement auto-grow: TextBox height grows with content; Rectangle/Circle vertically expand even to ellipse when overflow occurs.[1][2]
- [ ] Keep Sticky Note font size fixed; rewrap on resize without font scaling; add author line metadata.[2][1]
- [ ] Enter text edit mode immediately after creating text-like elements via DOM overlay editor.[1][2]

### Creation workflows
- [ ] Support single-click placement with default sizes for sticky note, shapes, text, table, and connectors.[7][1]
- [ ] Keep click-drag as secondary flow for shapes with live preview on PreviewLayer, committing on release.[7][6]
- [ ] After creation, auto-select new element and show contextual toolbar above it.[2][1]

### Drawing tools
- [ ] Ensure Marker (opaque) and Highlighter (multiply, translucent) commit to MainLayer; keep highlighter visually behind other content.[3][7]
- [ ] Add pressure-sensitive width modulation to direct drawing; add min-distance point decimation to reduce churn.[8][1]
- [ ] Keep preview drawing on FastLayer with RAF batchDraw; disable perfectDraw and shadow-for-stroke while drawing.[5][8]

### Connectors and anchors
- [ ] Implement connector tool with curved paths, rounded caps, and arrowhead at target end; add anchor hints.[1][2]
- [ ] Snap connector endpoints to shape boundary anchor points; store {targetId, anchorHint}.[2][1]
- [ ] Recompute connector routing live during connected element drag/transform.[1][2]

### Smart alignment
- [ ] Add SmartGuides utility to find edge/center alignments among nearby elements during drag.[5][1]
- [ ] Snap moving element to detected alignment with threshold; render guide lines on OverlayLayer.[5][1]

### Layering & z-order
- [ ] Enforce creation on top for new elements; maintain dedicated z-policy for highlighter behind content.[3][1]
- [ ] Add helpers to temporarily move nodes to Preview/Overlay for drag performance and return on end.[4][3]

### Contextual toolbars
- [ ] Implement floating contextual toolbar above selection: text formatting (size, weight, alignment, lists, links).[2][1]
- [ ] Add color picker for fill/stroke/sticky note; sync changes to store and live node updates.[9][1]

### Viewport & cursors
- [ ] Extend CursorManager mapping for all tools, including pan grab/grabbing states and tool-specific cursors.[5][2]
- [ ] Ensure cursor updates with active tool and during specific interactions (resize, rotate, connect).[1][2]

### History & undo/redo
- [ ] Add operation batching for typing/dragging/transforming; push deltas or inverse ops to history.[2][1]
- [ ] Wire transformer and creation tools to emit history entries on commit.[1][2]

### Performance & polish
- [ ] Add subtle easing animations on creation and transformation; keep under RAF batching.[9][2]
- [ ] Cache complex shapes/long paths and static layers (grid); provide recache utilities.[8][4]
- [ ] Add performance HUD and optional dashboard toggle; surface fps, draw calls, node counts, layer stats.[9][2]

### Collaboration foundations (implied)
- [ ] Prepare presence hooks and action patch broadcasting (no-op stubs) to enable future live cursors and sync.[2][1]
- [ ] Centralize shared timer widget state in store, ready for CRDT/WS integration later.[1][2]

### New files to add
- [ ] features/canvas/components/ui/GridRenderer.ts (dot grid tiling, layer cache)[3][1]
- [ ] features/canvas/components/ui/SmartGuides.ts (overlay guide rendering)[5][1]
- [ ] features/canvas/components/ui/ContextualToolbar.tsx (floating formatting bar)[2][1]
- [ ] features/canvas/components/ui/FloatingColorPicker.tsx (portal color picker)[9][1]
- [ ] features/canvas/managers/TransformerManager.ts (selection transformer lifecycle)[1][2]
- [ ] features/canvas/utils/text/TextMeasurement.ts (wrap/metrics, memoization)[2][1]
- [ ] features/canvas/utils/alignment/SnapGuides.ts (alignment detection, thresholds)[5][1]
- [ ] features/canvas/animation/ElementAnimations.ts (creation/transform easing)[9][2]

### Existing files to update
- [ ] features/canvas/layers/CanvasLayerManager.ts: grid hook-in, highlighter z-policy, helpers for temporary layer moves.[3][1]
- [ ] features/canvashooks/useSelectionManager.ts: integrate marquee with transformer attach/detach.[6][1]
- [ ] features/canvashooks/useCanvasEventManager.ts: route drag events through SmartGuides and snapping.[6][5]
- [ ] features/canvashooks/useViewportControls.ts: cursor feedback, Space-to-pan UI refinements.[5][1]
- [ ] features/canvas/utils/DirectKonvaDrawing.ts: pressure width, minDist, commit policies.[8][1]
- [ ] src/app/pages/Canvas.tsx: contextual toolbar wiring and grid toggles in toolbar.[9][1]

### Store extensions
- [ ] UI slice: grid visibility/density/color; contextual toolbar state; color picker state.[1][2]
- [ ] Guides slice: snap threshold, active guides, enable/disable.[2][1]
- [ ] Animation slice: enable flags and easing presets.[9][2]
- [ ] History slice: batching groups and merge heuristics.[1][2]
