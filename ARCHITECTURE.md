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
- **Shape Tools**: Rectangle, Ellipse, Triangle, Line
- **Creation Tools**: Text, Sticky Note, Connector
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

### Text System
- **Geometry**: Konva.Text for positioning and basic rendering
- **Editing**: DOM overlay editor for rich text input
- **Measurement**: Offscreen canvas for layout calculations
- **Auto-size**: Dynamic resize based on content

### Connectors
- Curved path routing with Bezier curves
- Endpoint snapping to element boundaries
- Live re-routing on connected element transforms
- Anchor hints for connection points

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

The blueprint ensures new contributors can locate responsibilities, reason about performance, and extend functionality without re-architecting the system.

---

*Last Updated: January 2025*
*Version: 1.0.0*