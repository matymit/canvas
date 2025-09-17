# Canvas Application Architecture

## 🎯 Executive Summary

A FigJam-style collaborative canvas built with **React 19**, **TypeScript**, **vanilla Konva.js** (not react-konva), **Zustand**, and **Tauri 2.x** for secure desktop runtime. The system delivers 60fps performance at scale through a strict four-layer Konva pipeline, RAF-batched updates, object pooling, and viewport culling.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                     │
├─────────────────────────────────────────────────────────┤
│  Rust Backend (Privileged)  │   WebView (Unprivileged)  │
│  - IPC Commands              │   - React 19 UI           │
│  - File System               │   - Konva.js Canvas       │
│  - Native APIs               │   - Zustand Store         │
│  - Security Layer            │   - TypeScript            │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend Framework**: React 19 with TypeScript
- **Canvas Engine**: Vanilla Konva.js (direct API, no react-konva)
- **State Management**: Zustand with Immer for immutability
- **Desktop Runtime**: Tauri 2.x with capability-based security
- **Build Tool**: Vite with performance-optimized chunking
- **Testing**: Vitest for unit/integration, Playwright for E2E

## 🎨 Core Principles

### 1. Performance First
- Maintain 60fps at scale with 1000+ nodes
- Fixed four-layer model with strict z-ordering
- RAF-batched updates and object pooling
- Viewport culling and spatial indexing

### 2. Accessibility & UX
- WCAG 2.1 AA compliance
- Full keyboard navigation
- Screen reader support via parallel DOM
- Deterministic, predictable behaviors

### 3. Security & Privacy
- Least-privilege Tauri capabilities
- Hardened IPC with validation
- CSP without unsafe-inline/eval
- Local-first data storage

### 4. Developer Experience
- Modular, testable architecture
- Clear separation of concerns
- Explicit performance budgets
- Comprehensive documentation

## 🎮 Interaction Specification

### Global Model

* **Stage & Layers**: One Konva Stage with four layers:

  1. **Background** – static grid (non-interactive, cached).
  2. **Main** – all committed content elements (shapes, text, stickies, connectors, images, tables, etc.).
  3. **Preview** – live/ephemeral ghosts while drawing, erasing, or resizing (listening: false).
  4. **Overlay** – selection handles, guides, Transformer, marquees, cursors. Always on top.

* **Transformer**:

  * Single Transformer instance on overlay.
  * Attaches/detaches as selection changes.
  * Supports corner/mid anchors, rotation, snapping, and keep-ratio modifiers (Shift).
  * Emits `transformstart/transform/transformend`.
  * Transforms applied via `scaleX/scaleY`, not width/height.
  * `boundBoxFunc` may constrain min/max sizes.
  * On transform-end: scale normalized back into width/height, scales reset to 1 to keep hit graphs consistent.

* **History**:

  * Creation, move/resize/rotate, typing, and multi-step operations are batched atomically.
  * Undo/redo entries are coherent: preview→commit→autoselect is one entry.
  * Rapid typing/cell edits coalesce.

* **Performance guardrails**:

  * Previews → preview layer only, commits → main.
  * `listening: false` and `perfectDraw: false` on previews.
  * `batchDraw` coalesced per frame.
  * Background cached.
  * Min-distance decimation for strokes.
  * Highlighter sits visually behind other content via z-policy but still in main.

### Toolbar and Cursors

* Selecting a tool sets **global input mode**, highlights icon, updates cursor, and may open an **options palette** (stroke, fill, thickness, color, etc.).
* Hover → tooltip + shortcut.
* Cursor modes:

  * Crosshair = creation tools.
  * Caret = text.
  * Grab/grabbing = pan.
* Switching tools preserves undoable context.

### Selection & Marquee

* Click selects. Shift/Ctrl toggles.
* Dragging empty space draws a **marquee rectangle** on overlay.
* On release, resolves via hit-test → attaches Transformer.
* Group transforms respect SmartGuides and grid.

### Pan and Zoom

* Space = pan (grab/grabbing cursor).
* Wheel zoom at pointer; pinch zoom supported.
* Clamped to min/max scale.
* Reset/fit available via HUD.
* Overlay adorners scale with zoom to remain consistent.

### Smart Guides & Snapping

* During drag/transform:

  * Compute edge/center snaps against grid + nearby elements.
  * Grid snap coarse, fine alignment applied after.
  * Guide lines render on overlay.
* Guides vanish on drag end.
* Thresholds/grid size configurable.

### Tool Behaviors

#### Drawing Tools (Pen / Marker / Highlighter)

* **Marker** = opaque stroke.
* **Highlighter** = semi-transparent, always visually beneath other content.
* **Preview** drawn on preview layer, commits to main as `Konva.Line`.
* Stroke logic: RAF-batched updates, min-distance decimation, optional pressure width modulation.
* Options: color + thin/thick stroke.
* **Shift** constrains straight lines.
* **Esc** exits tool.
* **Eraser**: destination-out compositing for strokes, commits in batches.

#### Rectangle / Circle / Ellipse / Triangle / Other Shapes

* Click → default shape at pointer (autoselect).
* Drag → live ghost, commits on mouseup.
* Resizing: anchors, Shift keeps ratio.
* Contextual bar: fill, stroke, dash, radius.
* Auto-grow: shapes can expand height when text is added (circles → ellipses).
* Alignment guides/snap during move/resize.

#### Sticky Note

* Click → default rounded square sticky (shadow + author attribution).
* Immediately opens DOM overlay text editor.
* Resizing rewraps text (no font scaling).
* Sticky size independent of content size.
* Options: sticky color palette.
* Duplication keeps content + style.
* Connectors snap to edges, reroute when sticky moves.

#### Text Tool

* Click → DOM overlay text editor at pointer.
* Commit → `Konva.Text` with measured geometry.
* **Behavior**:

  * Height is **fixed to single-line height** regardless of content.
  * Width **expands as text is entered** and **contracts as text is deleted**.
  * Text box always perfectly hugs the text content during editing and after commit.
  * Single-line constraint prevents vertical expansion, maintaining consistent text baseline.
* Implementation: Canvas measurement for width calculation, textarea overlay for editing.
* Contextual bar: font, size, weight, alignment, lists, links.
* Double-click existing text → re-enters edit mode.
* History batches rapid typing to reduce churn.

#### Image Tool

* On select: opens file picker.
* Placement: click = default aspect-correct size, or drag = ghost with aspect.
* Commit → main, autoselect.
* Transform-end normalizes scale → width/height, resets scale = 1.
* Contextual UI (future): crop/flip, link, caption.
* Supports snapping, connectors, guides.

#### Connector Tools (Line / Arrow)

* Two types: straight line, arrow with shared codebase.
* **Creation Pipeline**:

  * Click = start endpoint with 12px threshold anchor snapping (side/center).
  * Live preview on preview layer with dashed style.
  * Drag to target with real-time anchor detection.
  * Click/release = commit with final endpoint snapping.
* **Anchor System**: Element-to-element connections via side anchors (left, right, top, bottom, center).
* **Live Routing**: Dynamic re-routing when connected elements are dragged/transformed.
* **Endpoint Types**: Support for both free points and element-anchored connections.
* Implementation: ConnectorRenderer for rendering, LiveRoutingManager for dynamic updates.
* Styles: stroke, width, dash, caps/joins, opacity, arrow size.
* Auto-selects after creation, switches back to select tool.
* ESC cancels during creation.

#### Table Tool

* Click → default 2×3 table.
* Drag → ghost sized by pointer, commits on release.
* Commit → autoselect + opens first cell in DOM overlay editor.
* Table = one selectable element with Transformer.
* Transform-end scales column widths + row heights proportionally.
* Crisp grid + cell padding preserved.
* Navigation: arrows, Enter, Tab.
* Cell edits → DOM overlay, history batched.

#### Mindmap Tool

* Click → rounded node with default text, auto-enters edit.
* Enter while editing → spawns child node offset right + curved branch auto-drawn.
* Branches reroute live when nodes move/resize.
* SmartGuides align nodes.
* Multi-step (node + branch) batched atomically in history.
* Styles: tapered ribbons, curved connectors, rounded caps.
* Contextual bar: add child, rename, restyle branch thickness/curve.

#### Eraser Tool

* Cursor shows eraser width.
* Erases strokes via destination-out on preview, commits to main in batches.
* Alternative: select element + Delete.

#### Marquee / Lasso Selection

* Drag empty space → marquee rectangle on overlay.
* On release → selects enclosed elements, attaches Transformer.
* Shift/Ctrl adds/removes from selection.

### Accessibility & Keyboard

* Stage container: `role=application`, `aria-roledescription="Canvas"`.
* `aria-activedescendant` → virtual DOM list of elements.
* Live region announces selection + moves.
* Navigation: Tab/Shift-Tab cycles, arrow keys nudge, Delete removes.
* Global shortcuts: undo, redo, zoom, tool switching.

### FigJam Consistency Notes

* Tools mimic FigJam:

  * Single-click placement.
  * Marker/highlighter = thin/thick strokes.
  * Connectors snap and stay attached.
  * Sticky notes open text editor instantly.
* Stamps/emotes = optional future scope; temporary/static feedback with simple placement.

## 📐 Layering Model

### Four-Layer Konva Pipeline

```typescript
Stage
├── Background Layer (z-index: 0)
│   ├── Grid
│   ├── Guides
│   └── Static decorations
│   Properties: listening(false), cached, non-interactive
│
├── Main Layer (z-index: 1)
│   ├── Persistent elements
│   ├── Committed drawings
│   └── Text, shapes, images
│   Properties: listening(true), interactive
│
├── Preview Layer (z-index: 2)
│   ├── Active drawing strokes
│   ├── Shape previews
│   └── Temporary operations
│   Properties: FastLayer, listening(false) during draw
│
└── Overlay Layer (z-index: 3)
    ├── Selection handles
    ├── Transformers
    ├── Smart guides
    └── UI adorners
    Properties: Always on top, UI controls
```

### Layer Management (`CanvasLayerManager`)
- Constructs and owns the four layers
- Enforces strict z-ordering
- Manages HiDPI/DPR settings per layer
- Handles temporary layer moves for drag operations
- Implements highlighter z-policy (top of main)

## 🗄️ State Model

### Unified Store Architecture

```typescript
UnifiedCanvasStore
├── ElementModule
│   ├── elements: Map<ElementId, CanvasElement>  // O(1) lookup
│   ├── elementOrder: ElementId[]                // Draw order
│   └── CRUD operations
│
├── SelectionModule
│   ├── selectedElementIds: Set<ElementId>       // O(1) membership
│   ├── transformer lifecycle
│   └── Marquee selection
│
├── ViewportModule
│   ├── pan: { x, y }
│   ├── scale: number
│   └── Transform utilities
│
├── HistoryModule
│   ├── Batched undo/redo
│   ├── Operation deltas
│   └── Transaction support
│
├── DrawingModule
│   ├── Active stroke state
│   ├── Tool configuration
│   └── Pressure/velocity
│
├── UIModule
│   ├── Tool selection
│   ├── Colors & styles
│   └── Toolbar state
│
└── GuidesModule
    ├── Alignment guides
    ├── Grid settings
    └── Snapping config
```

### State Principles
- **Serializable**: No direct Konva node references in state
- **Immutable**: Immer for safe mutations
- **Testable**: Pure functions and predictable updates
- **Performant**: O(1) lookups, minimal re-renders
- **Element Types**: Extended union includes table, mindmap-node, mindmap-edge, image, connector
- **Data Storage**: Element-specific data stored in `data` field for complex elements

## 🎮 Event Routing & Tools

### Priority-Based Event System

```typescript
EventManager
├── Priority Queue
│   1. Active Tool Handler
│   2. Selection Manager
│   3. Viewport Controls
│   4. Default Handlers
│
├── Tool Interface
│   ├── onPointerDown/Move/Up
│   ├── onKeyDown/Up
│   ├── Priority level
│   └── Cleanup lifecycle
│
└── Event Flow
    Stage Event → Router → Active Tool → Fallback Chain
```

### Tool Registry
- **Drawing Tools**: Pen, Marker, Highlighter, Eraser
- **Shape Tools**: Rectangle, Ellipse, Triangle
- **Connection Tools**: Line Connector, Arrow Connector (with live routing and anchor snapping)
- **Creation Tools**: Text (fixed-height, content-hugging), Sticky Note, Image Upload
- **Content Tools**: Table (2×N grid), Mindmap (nodes + branches)
- **Navigation**: Pan, Zoom, Select

Each tool implements `ToolEventHandler` interface with pointer-first design and optional mouse/keyboard fallbacks.

## ✏️ Drawing Pipeline

### Direct Konva Drawing Flow

```typescript
1. PointerDown
   ├── Create Konva.Line on preview layer
   ├── Initialize with starting point
   └── Disable perfectDraw for performance

2. PointerMove (RAF-batched)
   ├── Append points with min-distance decimation
   ├── Optional pressure width modulation
   └── BatchDraw preview layer

3. PointerUp
   ├── Apply stroke filtering policies
   ├── Move to main layer
   ├── Update element store
   └── Push to history with batching
```

### Special Behaviors
- **Highlighter**: `globalCompositeOperation: 'multiply'`
- **Eraser**: `globalCompositeOperation: 'destination-out'`
- **Pressure**: Width modulation based on pointer pressure

## 🔲 Shapes & Elements

### Shape Creation Pipeline

```typescript
1. Tool Activation
   ├── Set cursor
   └── Register event handlers

2. Click-Drag Creation
   ├── Preview on preview layer
   ├── Normalize geometry (handle negative dimensions)
   └── Live update during drag

3. Commit on Release
   ├── Create element record
   ├── Move to main layer
   ├── Add to store atomically
   └── Enable selection
```

### Element Systems

#### Text System
- **Geometry**: Konva.Text for positioning and basic rendering
- **Editing**: DOM overlay textarea with fixed height, expanding width
- **Measurement**: Canvas context measurement for precise width calculation
- **Content Hugging**: Width dynamically adjusts to text content during editing and after commit
- **Single-Line Constraint**: Height remains fixed to font line height, preventing vertical expansion

#### Table System
- **Structure**: 2×N grid with white cells and gray borders
- **Creation**: Single-click placement with immediate editing
- **Navigation**: Keyboard navigation (Tab, arrows) with accessibility
- **Transform**: Proportional resize maintaining aspect ratio

#### Mindmap System
- **Nodes**: Rounded rectangles with text content
- **Branches**: Tapered Bézier curves with organic flow
- **Hierarchy**: Parent-child relationships with automatic positioning
- **Live Routing**: Real-time edge updates during node transforms
- **Child Spawning**: Enter key for rapid expansion

#### Image System
- **Upload**: File picker with data URL storage for portability
- **Preview**: Live drag-to-size with aspect ratio preservation
- **Rendering**: Async bitmap loading with Konva.Image nodes
- **Transform**: Scale normalization and aspect ratio constraints

#### Connector System
- **Variants**: Line and Arrow connectors with shared ConnectorTool base class
- **Anchor Snapping**: 12px threshold detection to element sides (left, right, top, bottom, center)
- **Endpoint Types**: ConnectorEndpointPoint (free x,y) and ConnectorEndpointElement (element + anchor)
- **Live Routing Manager**: Event-driven re-routing on drag/transform with RAF-batched updates
- **Preview Layer Integration**: Real-time dashed preview during creation
- **Service Architecture**: ConnectorService coordinates renderer and live routing
- **Tool Flow**: Click start → drag preview → click end → auto-select → switch to select tool

## 🎯 Selection & Transform

### Selection System

```typescript
SelectionManager
├── Click Selection
│   ├── Single click: Select one
│   ├── Ctrl/Cmd click: Toggle
│   └── Click empty: Clear
│
├── Marquee Selection
│   ├── Drag to create rectangle
│   ├── Intersect test with elements
│   └── Commit on release
│
└── Transformer
    ├── Single Konva.Transformer
    ├── Overlay layer positioning
    ├── Anchor configuration
    └── Keep-ratio modifiers
```

### Transform Features
- Rotation with 15° snapping (Shift)
- Proportional scaling (Shift)
- Multi-select group transform
- Boundary clamping
- Smart guides integration

## 📏 Smart Guides & Snapping

### Alignment System

```typescript
SmartGuides
├── Edge Alignment
│   ├── Left, Center, Right
│   └── Top, Middle, Bottom
│
├── Distance Guides
│   ├── Equal spacing
│   └── Distribution hints
│
├── Grid Snapping
│   ├── Coarse grid (first)
│   └── Fine alignment (second)
│
└── Visual Feedback
    ├── Guide lines on overlay
    ├── Snap indicators
    └── Distance labels
```

### Snapping Priority
1. Grid snap (if enabled)
2. Element edge/center alignment
3. Equal distance distribution
4. Free positioning

## 🖱️ Viewport Controls

### Navigation Features

```typescript
ViewportControls
├── Wheel Zoom
│   ├── Zoom at pointer position
│   ├── Clamped scale (0.1 - 5.0)
│   └── Smooth animation
│
├── Pan Controls
│   ├── Space + drag
│   ├── Middle mouse
│   └── Touch pad gestures
│
├── Pinch Zoom
│   ├── Touch support
│   ├── Center between fingers
│   └── Gesture recognition
│
└── Presets
    ├── Fit to content
    ├── Reset view (100%)
    └── Zoom to selection
```

## ⚡ Performance Strategies

### Optimization Techniques

#### 1. Object Pooling (`KonvaNodePool`)
```typescript
- Per-type factories with safe reset
- Bounded capacity with LRU eviction
- Pre-warming for common shapes
- Disposal and cleanup lifecycle
```

#### 2. RAF Batching (`RafBatcher`)
```typescript
- Frame-coalesced batchDraw calls
- Deduplication per layer
- Priority queue for operations
- 60fps frame budget enforcement
```

#### 3. Spatial Indexing (`QuadTree`)
```typescript
- Viewport culling acceleration
- Hit testing optimization
- Marquee selection resolution
- Eraser overlap detection
```

#### 4. Shape Caching
```typescript
- Complex shape caching
- HiDPI-aware cache scaling
- Invalidation on transform
- Memory-bounded cache size
```

### Performance Budgets
| Metric | Target | Measurement |
|--------|--------|-------------|
| Frame Rate | ≥60 FPS | RAF timing |
| Frame Time | ≤16.67ms | Performance.now() |
| Memory | ≤500MB peak | performance.memory |
| Layer Count | ≤4 layers | Stage children |
| Nodes/Layer | ≤1000 nodes | Layer children |

## ♿ Accessibility Model

### WCAG 2.1 AA Compliance

```typescript
Accessibility
├── Keyboard Navigation
│   ├── All tools keyboard-operable
│   ├── Tab order management
│   └── Escape key handling
│
├── Screen Reader Support
│   ├── ARIA live regions
│   ├── Tool announcements
│   ├── Status messages
│   └── Semantic HTML controls
│
├── Visual Accessibility
│   ├── High contrast mode
│   ├── Focus indicators
│   ├── Color blind friendly
│   └── Zoom to 400%
│
└── Alternative Input
    ├── Touch gestures
    ├── Voice control hooks
    └── Switch access support
```

### Canvas-Specific A11y
- Parallel DOM for canvas content
- Semantic controls mirror canvas operations
- Keyboard shortcuts with discovery UI
- Alternative text for visual elements

## 🔒 Security Architecture

### Tauri Security Model

```typescript
Security
├── Capability-Based Permissions
│   ├── Minimal exposed APIs
│   ├── Scoped file system access
│   ├── No shell execution
│   └── Validated IPC only
│
├── Content Security Policy
│   ├── No unsafe-inline/eval
│   ├── Self-hosted resources only
│   ├── HTTPS for external APIs
│   └── Strict source lists
│
├── Trust Boundaries
│   ├── Rust: Privileged operations
│   ├── WebView: Unprivileged UI
│   ├── IPC: Validated bridge
│   └── Serialized data only
│
└── Data Protection
    ├── Local-first storage
    ├── Encrypted preferences
    ├── No telemetry by default
    └── PII scrubbing in logs
```

## 🔌 Extensibility & Plugins

### Plugin Architecture

```typescript
PluginSystem
├── Plugin Interface
│   ├── Metadata & version
│   ├── Lifecycle hooks
│   ├── Event subscriptions
│   └── Store access
│
├── Plugin Categories
│   ├── Tools: Custom drawing tools
│   ├── Elements: New element types
│   ├── Import/Export: File formats
│   ├── Filters: Visual effects
│   ├── Analytics: Usage tracking
│   └── AI: Smart features
│
└── Plugin Manager
    ├── Registration & discovery
    ├── Dependency resolution
    ├── Sandbox execution
    └── Inter-plugin messaging
```

## 📁 File I/O & Serialization

### Data Model

```typescript
Serialization
├── Element Models
│   ├── ID-based references
│   ├── Geometry & transforms
│   ├── Styles & properties
│   ├── Element-specific data (tables, mindmaps, connectors)
│   ├── Hierarchical relationships (mindmap parent/child)
│   ├── Endpoint references (connector anchoring)
│   ├── File data URLs (images for portability)
│   └── No Konva references
│
├── History Format
│   ├── Operation deltas
│   ├── Batched transactions
│   ├── Timestamp metadata
│   └── Compression support
│
└── File Formats
    ├── Native: .canvas (JSON)
    ├── Export: SVG, PNG, PDF
    ├── Import: Images, SVG
    └── Interchange: JSON schema
```

## 🚀 Module Map

### Core Modules

| Module | Purpose | Location |
|--------|---------|----------|
| **CanvasLayerManager** | Four-layer construction, z-order, DPR | `/layers/CanvasLayerManager.ts` |
| **UnifiedCanvasStore** | Central Zustand store with modules | `/stores/unifiedCanvasStore.ts` |
| **TransformerManager** | Selection transformations | `/managers/TransformerManager.ts` |
| **DirectKonvaDrawing** | Pen/marker/highlighter drawing | `/utils/DirectKonvaDrawing.ts` |
| **KonvaNodePool** | Object pooling for performance | `/utils/performance/KonvaNodePool.ts` |
| **RafBatcher** | Frame-batched drawing | `/utils/performance/RafBatcher.ts` |
| **QuadTree** | Spatial indexing | `/utils/spatial/spatialQuadTree.ts` |
| **TextMeasurement** | Text layout calculations | `/utils/text/TextMeasurement.ts` |
| **SmartGuides** | Alignment and snapping | `/components/ui/SmartGuides.ts` |
| **EventManager** | Priority-based event routing | `/hooks/useCanvasEventManager.ts` |
| **SelectionManager** | Selection logic | `/hooks/useSelectionManager.ts` |
| **ViewportControls** | Pan, zoom, navigation | `/hooks/useViewportControls.ts` |
| **TauriOptimizations** | Desktop-specific optimizations | `/tauri/TauriCanvasOptimizations.ts` |

### Element Implementation Modules

| Module | Purpose | Location |
|--------|---------|-----------|
| **TableRenderer** | Table grid rendering on main layer | `/renderer/modules/TableRenderer.ts` |
| **TableTool** | Interactive table creation tool | `/components/tools/content/TableTool.tsx` |
| **MindmapRenderer** | Node and branch rendering with curves | `/renderer/modules/MindmapRenderer.ts` |
| **MindmapTool** | Interactive mindmap creation with spawning | `/components/tools/content/MindmapTool.tsx` |
| **MindmapRouting** | Bézier curve mathematics for branches | `/renderer/modules/mindmapRouting.ts` |
| **ImageRenderer** | Async image loading and display | `/renderer/modules/ImageRenderer.ts` |
| **ImageTool** | File picker and drag-to-size creation | `/components/tools/content/ImageTool.tsx` |
| **ImageLoader** | File-to-dataURL conversion utilities | `/utils/image/ImageLoader.ts` |
| **ConnectorRenderer** | Line/arrow rendering with endpoint resolution | `/renderer/modules/ConnectorRenderer.ts` |
| **ConnectorTool** | Base tool class for line and arrow creation | `/components/tools/connectors/ConnectorTool.ts` |
| **ConnectorToolWrapper** | React wrappers for LineTool and ArrowTool | `/components/tools/connectors/ConnectorToolWrapper.tsx` |
| **AnchorSnapping** | Element-side anchor detection with 12px threshold | `/utils/anchors/AnchorSnapping.ts` |
| **LiveRouting** | Dynamic connector re-routing system | `/utils/connectors/LiveRouting.ts` |
| **ConnectorService** | Integration service for rendering and routing | `/services/ConnectorService.ts` |
| **TextTool** | Fixed-height content-hugging text creation | `/components/tools/text/TextTool.ts` |
| **TextToolWrapper** | React wrapper for text tool integration | `/components/tools/text/TextToolWrapper.tsx` |
| **MindmapWire** | Live edge updates for mindmap transforms | `/renderer/modules/mindmapWire.ts` |

## 📊 Performance Monitoring

### Real-time Metrics

```typescript
PerformanceHUD
├── Frame Rate (FPS)
├── Frame Time (ms)
├── Memory Usage (MB)
├── Node Count
├── Layer Draw Calls
├── RAF Queue Size
└── Cache Hit Rate
```

### Production Budgets
- First Contentful Paint: ≤1.5s
- Time to Interactive: ≤3.0s
- Bundle Size: ≤4MB total
- Chunk Size: ≤1MB each

## 🧪 Testing Strategy

### Test Pyramid

```
        E2E Tests
       /    └─ UI flows, integration
      /  Integration Tests
     /   └─ Module interactions
    /  Unit Tests
   /   └─ Functions, components
  /  Performance Tests
 /   └─ Stress, benchmarks
```

### Test Coverage
- Unit: Store slices, utilities, hooks
- Integration: Canvas operations, tool flows
- E2E: User journeys, multi-tool workflows
- Performance: 1000+ nodes, rapid operations
- Accessibility: Keyboard, screen reader

## 🎯 Success Metrics

### Key Performance Indicators

| KPI | Target | Status |
|-----|--------|--------|
| **Frame Rate** | 60 FPS sustained | ✅ Achieved |
| **Memory** | <500MB peak | ✅ Optimized |
| **Bundle Size** | <4MB compressed | ✅ Met |
| **Accessibility** | WCAG 2.1 AA | ✅ Compliant |
| **Security** | OWASP ASVS Level 2 | ✅ Verified |
| **Test Coverage** | >80% | ✅ Covered |
| **Element Systems** | Tables, Mindmaps, Images, Connectors | ✅ Complete |
| **Live Routing** | Dynamic connection updates | ✅ Implemented |
| **Anchor Snapping** | 12px threshold element attachment | ✅ Implemented |
| **Text Tool** | Fixed-height content-hugging | ✅ Implemented |
| **File Handling** | Portable data URL storage | ✅ Integrated |

## 🔄 Development Workflow

### Component Composition

```typescript
Canvas Page
├── Toolbar (React)
├── NonReactCanvasStage
│   ├── Layer setup
│   ├── Event binding
│   └── DPR handling
├── Keyboard Shortcuts
├── Viewport Controls
└── Performance HUD
```

### Best Practices
1. **Never use react-konva** - Direct Konva API only
2. **RAF batch all updates** - Prevent frame thrashing
3. **Cap layers to 4** - Performance boundary
4. **Cache complex shapes** - Reduce redraw cost
5. **Disable unused listeners** - Minimize event overhead
6. **Pool frequent allocations** - Reduce GC pressure

## 🚨 Risks & Guardrails

### Performance Risks
- **Risk**: Too many layers → **Mitigation**: Hard cap at 4
- **Risk**: Unbounded nodes → **Mitigation**: Viewport culling
- **Risk**: Memory leaks → **Mitigation**: Cleanup lifecycles
- **Risk**: Frame drops → **Mitigation**: RAF batching

### Architecture Risks
- **Risk**: react-konva introduction → **Mitigation**: Linting rules
- **Risk**: State-node coupling → **Mitigation**: ID-based refs only
- **Risk**: Event handler leaks → **Mitigation**: Cleanup on unmount
- **Risk**: Plugin security → **Mitigation**: Sandboxed execution

## 📚 References & Resources

### Documentation
- [Konva.js Performance Guide](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [Tauri Security Best Practices](https://v2.tauri.app/security/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)

### Internal Docs
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
- [Performance Budgets](./src/features/canvas/utils/performance/ProductionPerformanceBudgets.ts)

## 🎬 Conclusion

This architecture delivers a **FigJam-style canvas** with:
- **Deterministic four-layer pipeline** for predictable performance
- **Zustand-driven state** with modular, testable slices
- **Event-delegated tools** with priority-based routing
- **Direct Konva drawing** without react-konva overhead
- **Smart guides & snapping** for precise alignment
- **Crisp HiDPI rendering** with per-layer DPR control
- **Production-grade practices** for security, performance, and accessibility
- **Complete element ecosystem** including tables, mindmaps, images, and connectors
- **Live re-routing systems** for dynamic connection updates
- **File handling pipeline** with portable data URL storage
- **Endpoint snapping** with 12px anchor detection
- **Hierarchical structures** with parent-child relationships

The blueprint ensures new contributors can locate responsibilities, reason about performance, and extend functionality without re-architecting the system. All major FigJam-style features are now implemented with production-ready quality.

---

*Last Updated: January 2025*
*Version: 2.1.0 - Enhanced Connector Tools with Live Routing and Fixed-Height Text Tool*